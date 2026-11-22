use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use walkdir::WalkDir;

use crate::db::DatabaseManager;
use crate::engine::chunker::{chunk_and_store_file, FileChunkingResult};
use crate::error::{Result, SnapVaultError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotProgress {
    pub job_id: i64,
    pub snapshot_id: i64,
    pub current_file: String,
    pub files_processed: u64,
    pub bytes_processed: u64,
    pub dedup_saved_bytes: u64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotManifest {
    pub snapshot_id: i64,
    pub job_id: i64,
    pub started_at: String,
    pub completed_at: String,
    pub total_files: u64,
    pub total_bytes: u64,
    pub new_bytes_stored: u64,
    pub dedup_saved_bytes: u64,
    pub files: Vec<ManifestFileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestFileEntry {
    pub relative_path: String,
    pub file_size: u64,
    pub modified_at: String,
    pub file_blake3_hash: String,
    pub chunk_hashes: Vec<String>,
}

struct PendingDbEntry {
    relative_path: String,
    file_size: i64,
    modified_at: String,
    file_blake3_hash: String,
    chunk_hashes_json: String,
    chunk_records: Vec<(String, usize)>, // (hash, size)
}

/// Executes a snapshot job with atomic commit and unplug-safe semantics
pub fn execute_snapshot<F>(
    db: &DatabaseManager,
    job_id: i64,
    mut progress_callback: F,
) -> Result<SnapshotManifest>
where
    F: FnMut(SnapshotProgress),
{
    // 1. Fetch job and drive details
    let (source_path_str, dest_root_str) = db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT j.source_path, d.mount_path 
             FROM backup_jobs j 
             JOIN drives d ON j.destination_drive_id = d.id 
             WHERE j.id = ?1 AND j.is_active = 1;",
        )?;
        let res = stmt.query_row(params![job_id], |row| {
            let s: String = row.get(0)?;
            let d: String = row.get(1)?;
            Ok((s, d))
        })?;
        Ok(res)
    })?;

    let source_path = PathBuf::from(&source_path_str);
    let dest_root = PathBuf::from(&dest_root_str);

    if !source_path.exists() {
        return Err(SnapVaultError::General(format!(
            "Source directory does not exist: {}",
            source_path.display()
        )));
    }

    if !dest_root.exists() {
        return Err(SnapVaultError::General(format!(
            "Destination drive is not connected or accessible: {}",
            dest_root.display()
        )));
    }

    // 2. Insert PENDING snapshot in database
    let started_at = Utc::now().to_rfc3339();
    let snapshot_id: i64 = db.with_conn_mut(|conn| {
        conn.execute(
            "INSERT INTO snapshots (job_id, status, started_at, is_locked_readonly) 
             VALUES (?1, 'PENDING', ?2, 0);",
            params![job_id, started_at],
        )?;
        Ok(conn.last_insert_rowid())
    })?;

    let mut files_processed = 0u64;
    let mut bytes_processed = 0u64;
    let mut total_new_bytes = 0u64;
    let mut total_new_chunks = 0u64;
    let mut total_dedup_saved = 0u64;
    let mut manifest_entries = Vec::new();
    let mut pending_db_batch: Vec<PendingDbEntry> = Vec::new();

    // 3. Walk directory tree
    let walker = WalkDir::new(&source_path).follow_links(false);

    let run_result: Result<()> = (|| {
        for entry_res in walker {
            let entry = match entry_res {
                Ok(e) => e,
                Err(err) => {
                    eprintln!("Warning: skipping unreadable filesystem item: {}", err);
                    continue;
                }
            };

            // Only process regular files
            if !entry.file_type().is_file() {
                continue;
            }

            let full_file_path = entry.path();
            let relative_path = match full_file_path.strip_prefix(&source_path) {
                Ok(p) => p.to_string_lossy().replace('\\', "/"),
                Err(_) => full_file_path.file_name().unwrap_or_default().to_string_lossy().to_string(),
            };

            let metadata = match fs::metadata(full_file_path) {
                Ok(m) => m,
                Err(err) => {
                    eprintln!("Warning: could not read metadata for {}: {}", full_file_path.display(), err);
                    continue;
                }
            };

            let modified_at = metadata
                .modified()
                .map(|t| chrono::DateTime::<Utc>::from(t).to_rfc3339())
                .unwrap_or_else(|_| Utc::now().to_rfc3339());

            // Chunk and store
            let chunk_res: FileChunkingResult = match chunk_and_store_file(full_file_path, &dest_root) {
                Ok(res) => res,
                Err(err) => {
                    // Check if it's a destination drive I/O failure (unplugged) vs source read failure
                    if !dest_root.exists() {
                        return Err(SnapVaultError::Io(std::io::Error::new(
                            std::io::ErrorKind::NotFound,
                            "Destination drive disconnected mid-backup",
                        )));
                    }
                    eprintln!("Warning: could not chunk file {}: {}", full_file_path.display(), err);
                    continue;
                }
            };

            files_processed += 1;
            bytes_processed += chunk_res.file_size;
            total_new_bytes += chunk_res.new_bytes;
            total_new_chunks += chunk_res.new_chunks as u64;
            total_dedup_saved += chunk_res.dedup_saved_bytes;

            let chunk_hashes: Vec<String> = chunk_res.chunks.iter().map(|c| c.hash.clone()).collect();
            let chunk_hashes_json = serde_json::to_string(&chunk_hashes)
                .unwrap_or_else(|_| "[]".to_string());

            manifest_entries.push(ManifestFileEntry {
                relative_path: relative_path.clone(),
                file_size: chunk_res.file_size,
                modified_at: modified_at.clone(),
                file_blake3_hash: chunk_res.file_hash.clone(),
                chunk_hashes,
            });

            pending_db_batch.push(PendingDbEntry {
                relative_path: relative_path.clone(),
                file_size: chunk_res.file_size as i64,
                modified_at,
                file_blake3_hash: chunk_res.file_hash,
                chunk_hashes_json,
                chunk_records: chunk_res.chunks.into_iter().map(|c| (c.hash, c.size)).collect(),
            });

            // Flush in batches of 1,000 items to SQLite
            if pending_db_batch.len() >= 1000 {
                flush_batch(db, snapshot_id, &mut pending_db_batch)?;
            }

            progress_callback(SnapshotProgress {
                job_id,
                snapshot_id,
                current_file: relative_path,
                files_processed,
                bytes_processed,
                dedup_saved_bytes: total_dedup_saved,
                status: "RUNNING".to_string(),
            });
        }

        // Flush any remaining items in the batch
        if !pending_db_batch.is_empty() {
            flush_batch(db, snapshot_id, &mut pending_db_batch)?;
        }

        Ok(())
    })();

    // 4. Handle failure vs success
    if let Err(e) = run_result {
        // Unplug-safe: mark snapshot INTERRUPTED without corrupting prior snapshots
        let err_str = e.to_string();
        let _ = db.with_conn_mut(|conn| {
            conn.execute(
                "UPDATE snapshots SET status = 'INTERRUPTED', error_message = ?1 WHERE id = ?2;",
                params![err_str, snapshot_id],
            )?;
            Ok(())
        });
        return Err(e);
    }

    // 5. Atomic commit: write manifest to .snapvault/manifests/<snapshot_id>.json
    let completed_at = Utc::now().to_rfc3339();
    let manifest = SnapshotManifest {
        snapshot_id,
        job_id,
        started_at,
        completed_at: completed_at.clone(),
        total_files: files_processed,
        total_bytes: bytes_processed,
        new_bytes_stored: total_new_bytes,
        dedup_saved_bytes: total_dedup_saved,
        files: manifest_entries,
    };

    let manifests_dir = dest_root.join(".snapvault").join("manifests");
    fs::create_dir_all(&manifests_dir)?;

    let target_manifest_path = manifests_dir.join(format!("{}.json", snapshot_id));
    let temp_manifest_path = manifests_dir.join(format!("{}.json.tmp.{}", snapshot_id, Uuid::new_v4()));

    let manifest_bytes = serde_json::to_vec_pretty(&manifest)
        .map_err(SnapVaultError::Serialization)?;

    {
        let mut f = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_manifest_path)?;
        f.write_all(&manifest_bytes)?;
        f.sync_all()?;
    }
    fs::rename(&temp_manifest_path, &target_manifest_path)?;

    // 6. Compute diff against previous committed snapshot for tripwire & statistics
    let (files_modified, files_deleted, prev_snap_id) = {
        let prev_files = db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT s.id FROM snapshots s 
                 WHERE s.job_id = ?1 AND s.status = 'COMMITTED' AND s.id != ?2
                 ORDER BY s.started_at DESC LIMIT 1;",
            )?;
            let mut rows = stmt.query(params![job_id, snapshot_id])?;
            if let Some(r) = rows.next()? {
                let p_id: i64 = r.get(0)?;
                let mut fstmt = conn.prepare(
                    "SELECT relative_path, file_blake3_hash FROM file_entries WHERE snapshot_id = ?1 AND is_deleted = 0;",
                )?;
                let frows = fstmt.query_map(params![p_id], |frow| {
                    Ok((frow.get::<_, String>(0)?, frow.get::<_, String>(1)?))
                })?;
                let mut map = std::collections::HashMap::new();
                for fr in frows {
                    let (p, h) = fr?;
                    map.insert(p, h);
                }
                Ok((Some(p_id), map))
            } else {
                Ok((None, std::collections::HashMap::new()))
            }
        })?;

        let (p_id, prev_map) = prev_files;
        if prev_map.is_empty() {
            (0i64, 0i64, p_id)
        } else {
            let mut current_map = std::collections::HashMap::new();
            for m in &manifest.files {
                current_map.insert(m.relative_path.clone(), m.file_blake3_hash.clone());
            }

            let mut deleted = 0i64;
            let mut modified = 0i64;

            for (p, old_hash) in &prev_map {
                if let Some(new_hash) = current_map.get(p) {
                    if new_hash != old_hash {
                        modified += 1;
                    }
                } else {
                    deleted += 1;
                }
            }
            (modified, deleted, p_id)
        }
    };

    // 7. Evaluate Tripwire
    let tripwire_triggered = if prev_snap_id.is_some() {
        let tripwire_eval = crate::engine::tripwire::evaluate_tripwire_safety_brake(
            db,
            job_id,
            files_deleted,
            files_modified,
        )?;
        tripwire_eval.triggered
    } else {
        false
    };

    // 8. Plain-File Emergency Mirror check
    let enable_mirror = db.with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT enable_emergency_mirror FROM backup_jobs WHERE id = ?1;")?;
        let res: i64 = stmt.query_row(params![job_id], |r| r.get(0))?;
        Ok(res == 1)
    })?;

    if enable_mirror {
        let file_paths: Vec<String> = manifest.files.iter().map(|f| f.relative_path.clone()).collect();
        let src_path = std::path::Path::new(&source_path_str);
        let _ = crate::engine::mirror::sync_plain_file_mirror(&dest_root, src_path, &file_paths);
    }

    // 9. Update snapshot status to COMMITTED in SQLite
    db.with_conn_mut(|conn| {
        let tx = conn.transaction()?;
        tx.execute(
            "UPDATE snapshots SET 
                status = 'COMMITTED', 
                completed_at = ?1,
                total_files = ?2,
                total_bytes = ?3,
                new_chunks_count = ?4,
                new_bytes_stored = ?5,
                files_modified = ?6,
                files_deleted = ?7,
                tripwire_triggered = ?8
             WHERE id = ?9;",
            params![
                completed_at,
                files_processed as i64,
                bytes_processed as i64,
                total_new_chunks as i64,
                total_new_bytes as i64,
                files_modified,
                files_deleted,
                if tripwire_triggered { 1 } else { 0 },
                snapshot_id
            ],
        )?;

        tx.execute(
            "UPDATE backup_jobs SET last_run_at = ?1 WHERE id = ?2;",
            params![completed_at, job_id],
        )?;

        tx.commit()?;
        Ok(())
    })?;

    progress_callback(SnapshotProgress {
        job_id,
        snapshot_id,
        current_file: String::new(),
        files_processed,
        bytes_processed,
        dedup_saved_bytes: total_dedup_saved,
        status: "COMMITTED".to_string(),
    });

    Ok(manifest)
}

fn flush_batch(
    db: &DatabaseManager,
    snapshot_id: i64,
    batch: &mut Vec<PendingDbEntry>,
) -> Result<()> {
    db.with_conn_mut(|conn| {
        let tx = conn.transaction()?;

        for item in batch.drain(..) {
            tx.execute(
                "INSERT INTO file_entries 
                    (snapshot_id, relative_path, file_size, modified_at, file_blake3_hash, chunk_hashes, is_deleted)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0);",
                params![
                    snapshot_id,
                    item.relative_path,
                    item.file_size,
                    item.modified_at,
                    item.file_blake3_hash,
                    item.chunk_hashes_json
                ],
            )?;

            for (hash, size) in item.chunk_records {
                tx.execute(
                    "INSERT INTO chunks (chunk_hash, size_bytes, reference_count) 
                     VALUES (?1, ?2, 1) 
                     ON CONFLICT(chunk_hash) DO UPDATE SET reference_count = reference_count + 1;",
                    params![hash, size as i64],
                )?;
            }
        }

        tx.commit()?;
        Ok(())
    })
}
