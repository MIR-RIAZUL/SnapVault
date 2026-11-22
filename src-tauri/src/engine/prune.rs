use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Duration, Utc};
use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db::DatabaseManager;
use crate::engine::chunker::get_chunk_absolute_path;
use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PruneResult {
    pub snapshots_evaluated: usize,
    pub snapshots_deleted: usize,
    pub chunks_deleted: usize,
    pub bytes_reclaimed: u64,
}

struct SnapshotMeta {
    id: i64,
    completed_at: DateTime<Utc>,
    is_locked_readonly: bool,
}

/// Applies GFS retention policy and purges orphaned chunks
pub fn prune_and_garbage_collect(
    db: &DatabaseManager,
    job_id: i64,
) -> Result<PruneResult> {
    // 1. Fetch destination drive mount path
    let dest_root_str: String = db.with_conn(|conn| {
        let path: String = conn.query_row(
            "SELECT d.mount_path 
             FROM backup_jobs j 
             JOIN drives d ON j.destination_drive_id = d.id 
             WHERE j.id = ?1;",
            params![job_id],
            |row| row.get(0),
        )?;
        Ok(path)
    })?;

    let dest_store_root = PathBuf::from(&dest_root_str);

    // 2. Fetch all COMMITTED snapshots for the job
    let snapshots: Vec<SnapshotMeta> = db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, COALESCE(completed_at, started_at), is_locked_readonly 
             FROM snapshots 
             WHERE job_id = ?1 AND status = 'COMMITTED' 
             ORDER BY COALESCE(completed_at, started_at) DESC;",
        )?;
        let rows = stmt.query_map(params![job_id], |row| {
            let id: i64 = row.get(0)?;
            let ts_str: String = row.get(1)?;
            let locked_raw: i64 = row.get(2)?;
            let dt = DateTime::parse_from_rfc3339(&ts_str)
                .map(|d| d.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now());
            Ok(SnapshotMeta {
                id,
                completed_at: dt,
                is_locked_readonly: locked_raw == 1,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    })?;

    let total_evaluated = snapshots.len();
    if total_evaluated == 0 {
        return Ok(PruneResult {
            snapshots_evaluated: 0,
            snapshots_deleted: 0,
            chunks_deleted: 0,
            bytes_reclaimed: 0,
        });
    }

    let now = Utc::now();
    let one_day_ago = now - Duration::hours(24);
    let thirty_days_ago = now - Duration::days(30);

    let mut keep_ids = HashSet::new();
    let mut hourly_buckets = HashSet::new();
    let mut daily_buckets = HashSet::new();
    let mut weekly_buckets = HashSet::new();

    // Evaluate GFS buckets (from newest to oldest)
    for s in &snapshots {
        let (is_hourly, is_daily, bucket) = if s.completed_at >= one_day_ago {
            (true, false, s.completed_at.format("%Y-%m-%d-%H").to_string())
        } else if s.completed_at >= thirty_days_ago {
            (false, true, s.completed_at.format("%Y-%m-%d").to_string())
        } else {
            (false, false, s.completed_at.format("%Y-W%W").to_string())
        };

        // Rule: NEVER prune locked snapshots
        if s.is_locked_readonly {
            keep_ids.insert(s.id);
            if is_hourly {
                hourly_buckets.insert(bucket);
            } else if is_daily {
                daily_buckets.insert(bucket);
            } else {
                weekly_buckets.insert(bucket);
            }
            continue;
        }

        if is_hourly {
            if hourly_buckets.insert(bucket) {
                keep_ids.insert(s.id);
            }
        } else if is_daily {
            if daily_buckets.insert(bucket) {
                keep_ids.insert(s.id);
            }
        } else {
            if weekly_buckets.insert(bucket) {
                keep_ids.insert(s.id);
            }
        }
    }

    // Identify snapshot IDs to delete
    let delete_ids: Vec<i64> = snapshots
        .iter()
        .filter(|s| !keep_ids.contains(&s.id))
        .map(|s| s.id)
        .collect();

    let snapshots_deleted_count = delete_ids.len();

    // 3. Delete expired snapshots (foreign keys cascade to file_entries)
    if !delete_ids.is_empty() {
        db.with_conn_mut(|conn| {
            let tx = conn.transaction()?;
            for id in &delete_ids {
                tx.execute("DELETE FROM snapshots WHERE id = ?1;", params![id])?;
            }
            tx.commit()?;
            Ok(())
        })?;
    }

    // 4. Garbage Collect Orphan Chunks
    // A chunk is orphaned if no file_entries across ANY snapshot reference its hash
    let (chunks_deleted_count, bytes_reclaimed) = garbage_collect_orphans(db, &dest_store_root)?;

    Ok(PruneResult {
        snapshots_evaluated: total_evaluated,
        snapshots_deleted: snapshots_deleted_count,
        chunks_deleted: chunks_deleted_count,
        bytes_reclaimed,
    })
}

fn garbage_collect_orphans(db: &DatabaseManager, dest_store_root: &Path) -> Result<(usize, u64)> {
    // Collect all chunk hashes currently referenced in active file_entries
    let referenced_hashes: HashSet<String> = db.with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT chunk_hashes FROM file_entries;")?;
        let rows = stmt.query_map([], |row| {
            let json_str: String = row.get(0)?;
            Ok(json_str)
        })?;

        let mut set = HashSet::new();
        for r in rows {
            let json = r?;
            if let Ok(hashes) = serde_json::from_str::<Vec<String>>(&json) {
                for h in hashes {
                    set.insert(h);
                }
            }
        }
        Ok(set)
    })?;

    // Collect all chunks in the chunks table
    let all_db_chunks: HashMap<String, i64> = db.with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT chunk_hash, size_bytes FROM chunks;")?;
        let rows = stmt.query_map([], |row| {
            let hash: String = row.get(0)?;
            let size: i64 = row.get(1)?;
            Ok((hash, size))
        })?;

        let mut map = HashMap::new();
        for r in rows {
            let (h, s) = r?;
            map.insert(h, s);
        }
        Ok(map)
    })?;

    let mut chunks_deleted = 0usize;
    let mut bytes_reclaimed = 0u64;
    let mut orphan_hashes = Vec::new();

    for (hash, size) in all_db_chunks {
        if !referenced_hashes.contains(&hash) {
            orphan_hashes.push(hash.clone());
            bytes_reclaimed += size as u64;

            // Remove physical chunk file on storage media
            let chunk_path = get_chunk_absolute_path(dest_store_root, &hash);
            if chunk_path.exists() {
                let _ = fs::remove_file(chunk_path);
            }
            chunks_deleted += 1;
        }
    }

    // Delete orphan records from chunks table in SQLite
    if !orphan_hashes.is_empty() {
        db.with_conn_mut(|conn| {
            let tx = conn.transaction()?;
            for h in &orphan_hashes {
                tx.execute("DELETE FROM chunks WHERE chunk_hash = ?1;", params![h])?;
            }
            tx.commit()?;
            Ok(())
        })?;
    }

    Ok((chunks_deleted, bytes_reclaimed))
}
