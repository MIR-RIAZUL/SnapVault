use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Drive {
    pub id: i64,
    pub uuid: String,
    pub label: String,
    pub mount_path: String,
    pub role: String, // "source" | "destination"
    pub filesystem: String,
    pub total_bytes: i64,
    pub free_bytes: i64,
    pub is_active: bool,
    pub last_seen_at: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupJob {
    pub id: i64,
    pub name: String,
    pub source_path: String,
    pub destination_drive_id: i64,
    pub schedule_type: String, // "continuous" | "interval" | "daily" | "manual"
    pub interval_minutes: i64,
    pub is_active: bool,
    pub enable_emergency_mirror: bool,
    pub last_run_at: Option<String>,
    pub next_run_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub id: i64,
    pub job_id: i64,
    pub status: String, // "PENDING" | "COMMITTED" | "INTERRUPTED" | "FAILED" | "TRIPWIRE_PAUSED"
    pub started_at: String,
    pub completed_at: Option<String>,
    pub total_files: i64,
    pub total_bytes: i64,
    pub new_chunks_count: i64,
    pub new_bytes_stored: i64,
    pub files_modified: i64,
    pub files_deleted: i64,
    pub tripwire_triggered: bool,
    pub is_locked_readonly: bool,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub id: i64,
    pub snapshot_id: i64,
    pub relative_path: String,
    pub file_size: i64,
    pub modified_at: String,
    pub file_blake3_hash: String,
    pub chunk_hashes: String, // JSON array string
    pub is_deleted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkRecord {
    pub chunk_hash: String,
    pub size_bytes: i64,
    pub reference_count: i64,
    pub first_seen_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheck {
    pub id: i64,
    pub job_id: i64,
    pub snapshot_id: i64,
    pub ran_at: String,
    pub files_tested: i64,
    pub bytes_tested: i64,
    pub files_passed: i64,
    pub files_failed: i64,
    pub failed_details: Option<String>,
    pub duration_ms: i64,
    pub status: String, // "PASS" | "DEGRADED" | "FAIL"
}
