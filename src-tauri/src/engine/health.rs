use std::fs::File;
use std::io::Read;
use std::path::PathBuf;
use chrono::{DateTime, Utc};
use rand::seq::SliceRandom;
use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db::DatabaseManager;
use crate::engine::chunker::get_chunk_absolute_path;
use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailedFileDetail {
    pub path: String,
    pub expected_hash: String,
    pub actual_hash: Option<String>,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResult {
    pub id: i64,
    pub job_id: i64,
    pub snapshot_id: i64,
    pub ran_at: String,
    pub files_tested: i64,
    pub bytes_tested: i64,
    pub files_passed: i64,
    pub files_failed: i64,
    pub failed_details: Vec<FailedFileDetail>,
    pub duration_ms: i64,
    pub status: String, // "PASS" | "DEGRADED" | "FAIL"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatusSummary {
    pub has_checked: bool,
    pub latest_check: Option<HealthCheckResult>,
    pub is_stale: bool,
    pub days_since_last_backup: Option<i64>,
}

/// Runs a Proof-of-Restore health drill on the latest COMMITTED snapshot for the given job.
/// Samples up to 25 random files, reassembles chunks in memory, and cryptographically verifies BLAKE3 digests.
pub fn run_health_check(db: &DatabaseManager, job_id: i64) -> Result<HealthCheckResult> {
    let start_time = Utc::now();

    // 1. Fetch latest committed snapshot ID and destination drive root
    let (snapshot_id, dest_root_str) = db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT s.id, d.mount_path 
             FROM snapshots s
             JOIN backup_jobs j ON s.job_id = j.id
             JOIN drives d ON j.destination_drive_id = d.id
             WHERE s.job_id = ?1 AND s.status = 'COMMITTED'
             ORDER BY s.started_at DESC LIMIT 1;",
        )?;
        let res = stmt.query_row(params![job_id], |row| {
            let s_id: i64 = row.get(0)?;
            let d_mount: String = row.get(1)?;
            Ok((s_id, d_mount))
        })?;
        Ok(res)
    })?;

    let dest_store_root = PathBuf::from(&dest_root_str);

    // 2. Query all active (non-deleted) file entries in the snapshot
    let all_files: Vec<(String, i64, String, String)> = db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT relative_path, file_size, file_blake3_hash, chunk_hashes
             FROM file_entries
             WHERE snapshot_id = ?1 AND is_deleted = 0;",
        )?;
        let rows = stmt.query_map(params![snapshot_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })?;
        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    })?;

    if all_files.is_empty() {
        // No files to test, clean pass
        let ran_at = Utc::now().to_rfc3339();
        let duration_ms = (Utc::now() - start_time).num_milliseconds();

        let inserted_id = db.with_conn_mut(|conn| {
            conn.execute(
                "INSERT INTO health_checks (job_id, snapshot_id, ran_at, files_tested, bytes_tested, files_passed, files_failed, failed_details, duration_ms, status)
                 VALUES (?1, ?2, ?3, 0, 0, 0, 0, '[]', ?4, 'PASS');",
                params![job_id, snapshot_id, ran_at, duration_ms],
            )?;
            Ok(conn.last_insert_rowid())
        })?;

        return Ok(HealthCheckResult {
            id: inserted_id,
            job_id,
            snapshot_id,
            ran_at,
            files_tested: 0,
            bytes_tested: 0,
            files_passed: 0,
            files_failed: 0,
            failed_details: Vec::new(),
            duration_ms,
            status: "PASS".to_string(),
        });
    }

    // 3. Sample up to 25 files randomly
    let mut rng = rand::thread_rng();
    let mut sampled_files = all_files.clone();
    if sampled_files.len() > 25 {
        sampled_files.shuffle(&mut rng);
        sampled_files.truncate(25);
    }

    let mut files_tested = 0i64;
    let mut bytes_tested = 0i64;
    let mut files_passed = 0i64;
    let mut files_failed = 0i64;
    let mut failed_details = Vec::new();

    // 4. Verify each file's chunk chain and BLAKE3 hash
    for (rel_path, file_size, expected_hash, chunk_hashes_json) in sampled_files {
        files_tested += 1;
        let chunk_hashes: Vec<String> = match serde_json::from_str(&chunk_hashes_json) {
            Ok(hashes) => hashes,
            Err(e) => {
                files_failed += 1;
                failed_details.push(FailedFileDetail {
                    path: rel_path,
                    expected_hash,
                    actual_hash: None,
                    error: format!("Corrupted chunk metadata: {}", e),
                });
                continue;
            }
        };

        let mut buffer = Vec::with_capacity(file_size.max(0) as usize);
        let mut read_error: Option<String> = None;

        for h in &chunk_hashes {
            let chunk_path = get_chunk_absolute_path(&dest_store_root, h);
            if !chunk_path.exists() {
                read_error = Some(format!("Chunk file missing on disk: {}", h));
                break;
            }
            match File::open(&chunk_path) {
                Ok(mut f) => {
                    if let Err(e) = f.read_to_end(&mut buffer) {
                        read_error = Some(format!("Failed to read chunk {}: {}", h, e));
                        break;
                    }
                }
                Err(e) => {
                    read_error = Some(format!("Failed to open chunk {}: {}", h, e));
                    break;
                }
            }
        }

        if let Some(err) = read_error {
            files_failed += 1;
            failed_details.push(FailedFileDetail {
                path: rel_path,
                expected_hash,
                actual_hash: None,
                error: err,
            });
            continue;
        }

        // Verify hash
        let mut hasher = blake3::Hasher::new();
        hasher.update(&buffer);
        let computed_hash = hasher.finalize().to_hex().to_string();

        if computed_hash == expected_hash {
            files_passed += 1;
            bytes_tested += file_size;
        } else {
            files_failed += 1;
            failed_details.push(FailedFileDetail {
                path: rel_path,
                expected_hash,
                actual_hash: Some(computed_hash),
                error: "BLAKE3 cryptographic digest mismatch".to_string(),
            });
        }
    }

    let status = if files_failed == 0 {
        "PASS".to_string()
    } else if files_passed > 0 {
        "DEGRADED".to_string()
    } else {
        "FAIL".to_string()
    };

    let ran_at = Utc::now().to_rfc3339();
    let duration_ms = (Utc::now() - start_time).num_milliseconds();
    let failed_details_json = serde_json::to_string(&failed_details)
        .unwrap_or_else(|_| "[]".to_string());

    // 5. Log audit trail to health_checks table
    let inserted_id = db.with_conn_mut(|conn| {
        conn.execute(
            "INSERT INTO health_checks (job_id, snapshot_id, ran_at, files_tested, bytes_tested, files_passed, files_failed, failed_details, duration_ms, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10);",
            params![
                job_id,
                snapshot_id,
                ran_at,
                files_tested,
                bytes_tested,
                files_passed,
                files_failed,
                failed_details_json,
                duration_ms,
                status
            ],
        )?;
        Ok(conn.last_insert_rowid())
    })?;

    Ok(HealthCheckResult {
        id: inserted_id,
        job_id,
        snapshot_id,
        ran_at,
        files_tested,
        bytes_tested,
        files_passed,
        files_failed,
        failed_details,
        duration_ms,
        status,
    })
}

/// Retrieves latest health status summary and computes backup staleness
pub fn get_latest_health_status(db: &DatabaseManager, job_id: i64) -> Result<HealthStatusSummary> {
    // 1. Fetch latest health check
    let latest_check: Option<HealthCheckResult> = db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, job_id, snapshot_id, ran_at, files_tested, bytes_tested, files_passed, files_failed, failed_details, duration_ms, status
             FROM health_checks
             WHERE job_id = ?1
             ORDER BY ran_at DESC LIMIT 1;",
        )?;
        let mut rows = stmt.query(params![job_id])?;
        if let Some(row) = rows.next()? {
            let details_json: String = row.get(8)?;
            let failed_details: Vec<FailedFileDetail> =
                serde_json::from_str(&details_json).unwrap_or_default();
            Ok(Some(HealthCheckResult {
                id: row.get(0)?,
                job_id: row.get(1)?,
                snapshot_id: row.get(2)?,
                ran_at: row.get(3)?,
                files_tested: row.get(4)?,
                bytes_tested: row.get(5)?,
                files_passed: row.get(6)?,
                files_failed: row.get(7)?,
                failed_details,
                duration_ms: row.get(9)?,
                status: row.get(10)?,
            }))
        } else {
            Ok(None)
        }
    })?;

    // 2. Check backup staleness (7+ days since latest committed snapshot)
    let latest_snapshot_date: Option<String> = db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT started_at FROM snapshots WHERE job_id = ?1 AND status = 'COMMITTED' ORDER BY started_at DESC LIMIT 1;",
        )?;
        let mut rows = stmt.query(params![job_id])?;
        if let Some(row) = rows.next()? {
            let d: String = row.get(0)?;
            Ok(Some(d))
        } else {
            Ok(None)
        }
    })?;

    let mut is_stale = false;
    let mut days_since: Option<i64> = None;

    if let Some(dt_str) = latest_snapshot_date {
        if let Ok(dt) = DateTime::parse_from_rfc3339(&dt_str) {
            let now = Utc::now();
            let duration = now.signed_duration_since(dt.with_timezone(&Utc));
            let days = duration.num_days();
            days_since = Some(days);
            if days >= 7 {
                is_stale = true;
            }
        }
    } else {
        // Never backed up
        is_stale = true;
    }

    Ok(HealthStatusSummary {
        has_checked: latest_check.is_some(),
        latest_check,
        is_stale,
        days_since_last_backup: days_since,
    })
}
