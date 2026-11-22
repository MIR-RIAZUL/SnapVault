use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::db::models::{BackupJob, Drive, Snapshot};
use crate::db::DatabaseManager;
use crate::engine::prune::{prune_and_garbage_collect, PruneResult};
use crate::engine::restore::{
    browse_snapshot_dir, diff_snapshots, preview_snapshot_file as engine_preview_snapshot_file,
    restore_from_snapshot, FilePreviewResponse, RestoreResult, SnapshotDiffItem, SnapshotDirEntry,
};
use crate::engine::snapshot::{execute_snapshot, SnapshotManifest, SnapshotProgress};

#[derive(Debug, Clone, Serialize)]
pub struct PingDbResponse {
    pub status: String,
    pub table_count: usize,
    pub schema_version: u32,
    pub journal_mode: String,
    pub database_path: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RegisterDriveInput {
    pub label: String,
    pub mount_path: String,
    pub role: String, // "source" | "destination"
    pub filesystem: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateBackupJobInput {
    pub name: String,
    pub source_path: String,
    pub destination_drive_id: i64,
    pub schedule_type: Option<String>,
    pub interval_minutes: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RestoreEntryInput {
    pub snapshot_id: i64,
    pub target_rel_path: Option<String>,
    pub restore_dir: String,
    pub overwrite: Option<bool>,
}

#[tauri::command]
pub fn ping_db(db: State<'_, DatabaseManager>) -> Result<PingDbResponse, String> {
    let db_status = db.get_status().map_err(|e| e.to_string())?;
    Ok(PingDbResponse {
        status: "SnapVault Ready — SQLite WAL Connected (6 tables)".to_string(),
        table_count: db_status.table_count,
        schema_version: db_status.schema_version,
        journal_mode: db_status.journal_mode,
        database_path: db_status.database_path,
    })
}

#[tauri::command]
pub fn register_drive(
    db: State<'_, DatabaseManager>,
    input: RegisterDriveInput,
) -> Result<Drive, String> {
    let now = Utc::now().to_rfc3339();
    let fs_type = input.filesystem.unwrap_or_else(|| "NTFS".to_string());
    let drive_uuid = format!("drive-{}", Uuid::new_v4());

    db.with_conn_mut(|conn| {
        conn.execute(
            "INSERT INTO drives (uuid, label, mount_path, role, filesystem, total_bytes, free_bytes, is_active, last_seen_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, 0, 1, ?6);",
            params![drive_uuid, input.label, input.mount_path, input.role, fs_type, now],
        )?;

        let id = conn.last_insert_rowid();
        Ok(Drive {
            id,
            uuid: drive_uuid,
            label: input.label,
            mount_path: input.mount_path,
            role: input.role,
            filesystem: fs_type,
            total_bytes: 0,
            free_bytes: 0,
            is_active: true,
            last_seen_at: now.clone(),
            created_at: now,
        })
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_drives(db: State<'_, DatabaseManager>) -> Result<Vec<Drive>, String> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, uuid, label, mount_path, role, filesystem, total_bytes, free_bytes, is_active, last_seen_at, created_at 
             FROM drives ORDER BY id ASC;",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Drive {
                id: row.get(0)?,
                uuid: row.get(1)?,
                label: row.get(2)?,
                mount_path: row.get(3)?,
                role: row.get(4)?,
                filesystem: row.get(5)?,
                total_bytes: row.get(6)?,
                free_bytes: row.get(7)?,
                is_active: row.get::<_, i64>(8)? == 1,
                last_seen_at: row.get(9)?,
                created_at: row.get(10)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_backup_job(
    db: State<'_, DatabaseManager>,
    input: CreateBackupJobInput,
) -> Result<BackupJob, String> {
    let now = Utc::now().to_rfc3339();
    let sched = input.schedule_type.unwrap_or_else(|| "interval".to_string());
    let interval = input.interval_minutes.unwrap_or(60);

    db.with_conn_mut(|conn| {
        conn.execute(
            "INSERT INTO backup_jobs (name, source_path, destination_drive_id, schedule_type, interval_minutes, is_active, enable_emergency_mirror)
             VALUES (?1, ?2, ?3, ?4, ?5, 1, 0);",
            params![input.name, input.source_path, input.destination_drive_id, sched, interval],
        )?;

        let id = conn.last_insert_rowid();
        Ok(BackupJob {
            id,
            name: input.name,
            source_path: input.source_path,
            destination_drive_id: input.destination_drive_id,
            schedule_type: sched,
            interval_minutes: interval,
            is_active: true,
            enable_emergency_mirror: false,
            last_run_at: None,
            next_run_at: None,
            created_at: now,
        })
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_backup_jobs(db: State<'_, DatabaseManager>) -> Result<Vec<BackupJob>, String> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, source_path, destination_drive_id, schedule_type, interval_minutes, is_active, enable_emergency_mirror, last_run_at, next_run_at, created_at 
             FROM backup_jobs ORDER BY id ASC;",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(BackupJob {
                id: row.get(0)?,
                name: row.get(1)?,
                source_path: row.get(2)?,
                destination_drive_id: row.get(3)?,
                schedule_type: row.get(4)?,
                interval_minutes: row.get(5)?,
                is_active: row.get::<_, i64>(6)? == 1,
                enable_emergency_mirror: row.get::<_, i64>(7)? == 1,
                last_run_at: row.get(8)?,
                next_run_at: row.get(9)?,
                created_at: row.get(10)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn run_snapshot(
    app: AppHandle,
    db: State<'_, DatabaseManager>,
    job_id: i64,
) -> Result<SnapshotManifest, String> {
    execute_snapshot(&db, job_id, |prog: SnapshotProgress| {
        let _ = app.emit("snapshot-progress", &prog);
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_snapshots(
    db: State<'_, DatabaseManager>,
    job_id: i64,
) -> Result<Vec<Snapshot>, String> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, job_id, status, started_at, completed_at, total_files, total_bytes, 
                    new_chunks_count, new_bytes_stored, files_modified, files_deleted, 
                    tripwire_triggered, is_locked_readonly, error_message 
             FROM snapshots 
             WHERE job_id = ?1 
             ORDER BY id DESC;",
        )?;

        let rows = stmt.query_map(params![job_id], |row| {
            Ok(Snapshot {
                id: row.get(0)?,
                job_id: row.get(1)?,
                status: row.get(2)?,
                started_at: row.get(3)?,
                completed_at: row.get(4)?,
                total_files: row.get(5)?,
                total_bytes: row.get(6)?,
                new_chunks_count: row.get(7)?,
                new_bytes_stored: row.get(8)?,
                files_modified: row.get(9)?,
                files_deleted: row.get(10)?,
                tripwire_triggered: row.get::<_, i64>(11)? == 1,
                is_locked_readonly: row.get::<_, i64>(12)? == 1,
                error_message: row.get(13)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn browse_snapshot_dir_command(
    db: State<'_, DatabaseManager>,
    snapshot_id: i64,
    dir_rel_path: String,
) -> Result<Vec<SnapshotDirEntry>, String> {
    browse_snapshot_dir(&db, snapshot_id, &dir_rel_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn diff_snapshot_files(
    db: State<'_, DatabaseManager>,
    snapshot_a_id: i64,
    snapshot_b_id: i64,
) -> Result<Vec<SnapshotDiffItem>, String> {
    diff_snapshots(&db, snapshot_a_id, snapshot_b_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn restore_entry(
    db: State<'_, DatabaseManager>,
    input: RestoreEntryInput,
) -> Result<RestoreResult, String> {
    let target_path = std::path::PathBuf::from(&input.restore_dir);
    let rel_path_ref = input.target_rel_path.as_deref();
    let overwrite = input.overwrite.unwrap_or(false);

    restore_from_snapshot(&db, input.snapshot_id, rel_path_ref, &target_path, overwrite)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn prune_snapshots(
    db: State<'_, DatabaseManager>,
    job_id: i64,
) -> Result<PruneResult, String> {
    prune_and_garbage_collect(&db, job_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn preview_snapshot_file(
    db: State<'_, DatabaseManager>,
    snapshot_id: i64,
    rel_path: String,
    current_source_root: Option<String>,
) -> Result<FilePreviewResponse, String> {
    engine_preview_snapshot_file(&db, snapshot_id, &rel_path, current_source_root.as_deref())
        .map_err(|e| e.to_string())
}
