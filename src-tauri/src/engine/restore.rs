use std::collections::{HashMap, HashSet};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db::DatabaseManager;
use crate::engine::chunker::get_chunk_absolute_path;
use crate::error::{Result, SnapVaultError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreResult {
    pub files_restored: u64,
    pub bytes_restored: u64,
    pub restored_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DiffKind {
    ADDED,
    MODIFIED,
    DELETED,
    UNCHANGED,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotDiffItem {
    pub relative_path: String,
    pub kind: DiffKind,
    pub old_size: Option<i64>,
    pub new_size: Option<i64>,
    pub old_hash: Option<String>,
    pub new_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotDirEntry {
    pub name: String,
    pub relative_path: String,
    pub is_dir: bool,
    pub file_size: i64,
    pub modified_at: String,
    pub file_hash: Option<String>,
}

/// Reassembles chunks for a single file or directory from a COMMITTED snapshot
pub fn restore_from_snapshot(
    db: &DatabaseManager,
    snapshot_id: i64,
    target_rel_path: Option<&str>,
    target_restore_dir: &Path,
    overwrite: bool,
) -> Result<RestoreResult> {
    // 1. Verify snapshot is COMMITTED and fetch destination drive root
    let (status, dest_root_str) = db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT s.status, d.mount_path 
             FROM snapshots s 
             JOIN backup_jobs j ON s.job_id = j.id 
             JOIN drives d ON j.destination_drive_id = d.id 
             WHERE s.id = ?1;",
        )?;
        let res = stmt.query_row(params![snapshot_id], |row| {
            let s: String = row.get(0)?;
            let d: String = row.get(1)?;
            Ok((s, d))
        })?;
        Ok(res)
    })?;

    if status != "COMMITTED" {
        return Err(SnapVaultError::General(format!(
            "Cannot restore from uncommitted snapshot (status: {})",
            status
        )));
    }

    let dest_store_root = PathBuf::from(&dest_root_str);

    // 2. Query file entries
    let file_entries: Vec<(String, i64, String, String)> = db.with_conn(|conn| {
        let mut list = Vec::new();
        if let Some(p) = target_rel_path {
            if !p.is_empty() {
                let prefix = format!("{}%", p.trim_end_matches('/'));
                let mut stmt = conn.prepare(
                    "SELECT relative_path, file_size, file_blake3_hash, chunk_hashes 
                     FROM file_entries 
                     WHERE snapshot_id = ?1 AND (relative_path = ?2 OR relative_path LIKE ?3);",
                )?;
                let rows = stmt.query_map(params![snapshot_id, p, prefix], |row| {
                    Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
                })?;
                for r in rows {
                    list.push(r?);
                }
                return Ok(list);
            }
        }

        let mut stmt = conn.prepare(
            "SELECT relative_path, file_size, file_blake3_hash, chunk_hashes 
             FROM file_entries 
             WHERE snapshot_id = ?1;",
        )?;
        let rows = stmt.query_map(params![snapshot_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })?;
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    })?;

    if file_entries.is_empty() {
        return Err(SnapVaultError::General(
            "No matching file entries found for restore in snapshot".to_string(),
        ));
    }

    fs::create_dir_all(target_restore_dir)?;

    let mut files_restored = 0u64;
    let mut bytes_restored = 0u64;
    let mut restored_paths = Vec::new();

    for (rel_path, _file_size, expected_hash, chunk_hashes_json) in file_entries {
        let chunk_hashes: Vec<String> = serde_json::from_str(&chunk_hashes_json)
            .unwrap_or_default();

        let mut file_destination = target_restore_dir.join(&rel_path);

        // Conflict resolution if destination file exists and overwrite is false
        if file_destination.exists() && !overwrite {
            file_destination = get_conflict_safe_path(&file_destination);
        }

        if let Some(parent) = file_destination.parent() {
            fs::create_dir_all(parent)?;
        }

        let temp_reconstruct_path = file_destination.with_extension(format!("tmp.{}", Uuid::new_v4()));

        {
            let mut out_file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temp_reconstruct_path)?;

            let mut hasher = blake3::Hasher::new();

            for chunk_hash in &chunk_hashes {
                let chunk_file_path = get_chunk_absolute_path(&dest_store_root, chunk_hash);
                if !chunk_file_path.exists() {
                    let _ = fs::remove_file(&temp_reconstruct_path);
                    return Err(SnapVaultError::General(format!(
                        "Missing chunk {} on storage media during restore",
                        chunk_hash
                    )));
                }

                let mut chunk_file = File::open(&chunk_file_path)?;
                let mut chunk_buf = Vec::new();
                chunk_file.read_to_end(&mut chunk_buf)?;

                hasher.update(&chunk_buf);
                out_file.write_all(&chunk_buf)?;
            }

            out_file.sync_all()?;

            let computed_hash = hasher.finalize().to_hex().to_string();
            if computed_hash != expected_hash {
                let _ = fs::remove_file(&temp_reconstruct_path);
                return Err(SnapVaultError::General(format!(
                    "Integrity verification failed for {}: expected {}, computed {}",
                    rel_path, expected_hash, computed_hash
                )));
            }
        }

        // Atomic rename of reconstructed file
        if file_destination.exists() && overwrite {
            let _ = fs::remove_file(&file_destination);
        }
        fs::rename(&temp_reconstruct_path, &file_destination)?;

        let restored_bytes = fs::metadata(&file_destination).map(|m| m.len()).unwrap_or(0);
        files_restored += 1;
        bytes_restored += restored_bytes;
        restored_paths.push(file_destination.to_string_lossy().to_string());
    }

    Ok(RestoreResult {
        files_restored,
        bytes_restored,
        restored_paths,
    })
}

fn get_conflict_safe_path(target: &Path) -> PathBuf {
    let timestamp = Utc::now().format("%Y-%m-%d_%H%M%S").to_string();
    let file_stem = target.file_stem().map(|s| s.to_string_lossy()).unwrap_or_default();
    let extension = target.extension().map(|e| e.to_string_lossy()).unwrap_or_default();

    let parent = target.parent().unwrap_or_else(|| Path::new(""));
    let new_file_name = if extension.is_empty() {
        format!("{} (restored {})", file_stem, timestamp)
    } else {
        format!("{} (restored {}).{}", file_stem, timestamp, extension)
    };

    parent.join(new_file_name)
}

/// Diff two snapshots, tagging files as ADDED, MODIFIED, DELETED, or UNCHANGED
pub fn diff_snapshots(
    db: &DatabaseManager,
    snapshot_a_id: i64,
    snapshot_b_id: i64,
) -> Result<Vec<SnapshotDiffItem>> {
    let files_a = fetch_snapshot_files(db, snapshot_a_id)?;
    let files_b = fetch_snapshot_files(db, snapshot_b_id)?;

    let mut diffs = Vec::new();
    let mut all_paths = HashSet::new();

    for p in files_a.keys() {
        all_paths.insert(p.clone());
    }
    for p in files_b.keys() {
        all_paths.insert(p.clone());
    }

    let mut sorted_paths: Vec<String> = all_paths.into_iter().collect();
    sorted_paths.sort();

    for path in sorted_paths {
        match (files_a.get(&path), files_b.get(&path)) {
            (Some(entry_a), Some(entry_b)) => {
                if entry_a.0 == entry_b.0 {
                    diffs.push(SnapshotDiffItem {
                        relative_path: path,
                        kind: DiffKind::UNCHANGED,
                        old_size: Some(entry_a.1),
                        new_size: Some(entry_b.1),
                        old_hash: Some(entry_a.0.clone()),
                        new_hash: Some(entry_b.0.clone()),
                    });
                } else {
                    diffs.push(SnapshotDiffItem {
                        relative_path: path,
                        kind: DiffKind::MODIFIED,
                        old_size: Some(entry_a.1),
                        new_size: Some(entry_b.1),
                        old_hash: Some(entry_a.0.clone()),
                        new_hash: Some(entry_b.0.clone()),
                    });
                }
            }
            (None, Some(entry_b)) => {
                diffs.push(SnapshotDiffItem {
                    relative_path: path,
                    kind: DiffKind::ADDED,
                    old_size: None,
                    new_size: Some(entry_b.1),
                    old_hash: None,
                    new_hash: Some(entry_b.0.clone()),
                });
            }
            (Some(entry_a), None) => {
                diffs.push(SnapshotDiffItem {
                    relative_path: path,
                    kind: DiffKind::DELETED,
                    old_size: Some(entry_a.1),
                    new_size: None,
                    old_hash: Some(entry_a.0.clone()),
                    new_hash: None,
                });
            }
            (None, None) => {}
        }
    }

    Ok(diffs)
}

fn fetch_snapshot_files(db: &DatabaseManager, snapshot_id: i64) -> Result<HashMap<String, (String, i64)>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT relative_path, file_blake3_hash, file_size 
             FROM file_entries 
             WHERE snapshot_id = ?1;",
        )?;
        let rows = stmt.query_map(params![snapshot_id], |row| {
            let path: String = row.get(0)?;
            let hash: String = row.get(1)?;
            let size: i64 = row.get(2)?;
            Ok((path, (hash, size)))
        })?;

        let mut map = HashMap::new();
        for r in rows {
            let (p, data) = r?;
            map.insert(p, data);
        }
        Ok(map)
    })
}

/// Browses immediate child files and directories for a snapshot directory path
pub fn browse_snapshot_dir(
    db: &DatabaseManager,
    snapshot_id: i64,
    dir_rel_path: &str,
) -> Result<Vec<SnapshotDirEntry>> {
    let clean_dir = dir_rel_path.trim_matches('/').replace('\\', "/");
    let prefix = if clean_dir.is_empty() {
        String::new()
    } else {
        format!("{}/", clean_dir)
    };

    let entries = db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT relative_path, file_size, modified_at, file_blake3_hash 
             FROM file_entries 
             WHERE snapshot_id = ?1;",
        )?;
        let rows = stmt.query_map(params![snapshot_id], |row| {
            let p: String = row.get(0)?;
            let size: i64 = row.get(1)?;
            let mtime: String = row.get(2)?;
            let hash: String = row.get(3)?;
            Ok((p, size, mtime, hash))
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    })?;

    let mut direct_files = Vec::new();
    let mut direct_dirs = HashMap::<String, (i64, String)>::new();

    for (rel_path, size, mtime, hash) in entries {
        if !prefix.is_empty() && !rel_path.starts_with(&prefix) {
            continue;
        }

        let remainder = if prefix.is_empty() {
            &rel_path
        } else {
            &rel_path[prefix.len()..]
        };

        if let Some(slash_idx) = remainder.find('/') {
            // It's in a subdirectory
            let sub_name = &remainder[..slash_idx];
            let sub_rel = if prefix.is_empty() {
                sub_name.to_string()
            } else {
                format!("{}{}", prefix, sub_name)
            };

            let entry = direct_dirs.entry(sub_rel).or_insert((0, mtime.clone()));
            entry.0 += size;
        } else {
            // It's a direct file
            direct_files.push(SnapshotDirEntry {
                name: remainder.to_string(),
                relative_path: rel_path,
                is_dir: false,
                file_size: size,
                modified_at: mtime,
                file_hash: Some(hash),
            });
        }
    }

    let mut result = Vec::new();

    for (dir_path, (total_size, mtime)) in direct_dirs {
        let name = dir_path.rsplit('/').next().unwrap_or(&dir_path).to_string();
        result.push(SnapshotDirEntry {
            name,
            relative_path: dir_path,
            is_dir: true,
            file_size: total_size,
            modified_at: mtime,
            file_hash: None,
        });
    }

    result.extend(direct_files);
    result.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.cmp(&b.name)
        } else if a.is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(result)
}
