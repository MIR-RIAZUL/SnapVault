use rusqlite::{Connection, Result};

pub const CURRENT_SCHEMA_VERSION: u32 = 1;

pub const MIGRATION_V1_SQL: &str = r#"
-- Table 1: drives
CREATE TABLE IF NOT EXISTS drives (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid            TEXT NOT NULL UNIQUE,
    label           TEXT NOT NULL,
    mount_path      TEXT NOT NULL,
    role            TEXT NOT NULL CHECK(role IN ('source', 'destination')),
    filesystem      TEXT NOT NULL DEFAULT 'NTFS',
    total_bytes     INTEGER NOT NULL DEFAULT 0,
    free_bytes      INTEGER NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    last_seen_at    TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_drives_uuid ON drives(uuid);
CREATE INDEX IF NOT EXISTS idx_drives_role ON drives(role);

-- Table 2: backup_jobs
CREATE TABLE IF NOT EXISTS backup_jobs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT NOT NULL,
    source_path         TEXT NOT NULL,
    destination_drive_id INTEGER NOT NULL REFERENCES drives(id) ON DELETE RESTRICT,
    schedule_type       TEXT NOT NULL DEFAULT 'interval' 
                        CHECK(schedule_type IN ('continuous', 'interval', 'daily', 'manual')),
    interval_minutes    INTEGER NOT NULL DEFAULT 60,
    is_active           INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    enable_emergency_mirror INTEGER NOT NULL DEFAULT 0 CHECK(enable_emergency_mirror IN (0, 1)),
    last_run_at         TEXT,
    next_run_at         TEXT,
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_backup_jobs_active ON backup_jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_dest ON backup_jobs(destination_drive_id);

-- Table 3: snapshots
CREATE TABLE IF NOT EXISTS snapshots (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id              INTEGER NOT NULL REFERENCES backup_jobs(id) ON DELETE CASCADE,
    status              TEXT NOT NULL CHECK(status IN ('PENDING', 'COMMITTED', 'INTERRUPTED', 'FAILED', 'TRIPWIRE_PAUSED')),
    started_at          TEXT NOT NULL,
    completed_at        TEXT,
    total_files         INTEGER NOT NULL DEFAULT 0,
    total_bytes         INTEGER NOT NULL DEFAULT 0,
    new_chunks_count    INTEGER NOT NULL DEFAULT 0,
    new_bytes_stored    INTEGER NOT NULL DEFAULT 0,
    files_modified      INTEGER NOT NULL DEFAULT 0,
    files_deleted       INTEGER NOT NULL DEFAULT 0,
    tripwire_triggered  INTEGER NOT NULL DEFAULT 0 CHECK(tripwire_triggered IN (0, 1)),
    is_locked_readonly  INTEGER NOT NULL DEFAULT 0 CHECK(is_locked_readonly IN (0, 1)),
    error_message       TEXT
);

CREATE INDEX IF NOT EXISTS idx_snapshots_job_started ON snapshots(job_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_status ON snapshots(status);

-- Table 4: file_entries
CREATE TABLE IF NOT EXISTS file_entries (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id         INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    relative_path       TEXT NOT NULL,
    file_size           INTEGER NOT NULL,
    modified_at         TEXT NOT NULL,
    file_blake3_hash    TEXT NOT NULL,
    chunk_hashes        TEXT NOT NULL,
    is_deleted          INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_file_entries_snapshot_path ON file_entries(snapshot_id, relative_path);
CREATE INDEX IF NOT EXISTS idx_file_entries_hash ON file_entries(file_blake3_hash);

-- Table 5: chunks
CREATE TABLE IF NOT EXISTS chunks (
    chunk_hash          TEXT PRIMARY KEY,
    size_bytes          INTEGER NOT NULL,
    reference_count     INTEGER NOT NULL DEFAULT 1,
    first_seen_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_chunks_refcount ON chunks(reference_count);

-- Table 6: health_checks
CREATE TABLE IF NOT EXISTS health_checks (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id              INTEGER NOT NULL REFERENCES backup_jobs(id) ON DELETE CASCADE,
    snapshot_id         INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    ran_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    files_tested        INTEGER NOT NULL,
    bytes_tested        INTEGER NOT NULL,
    files_passed        INTEGER NOT NULL,
    files_failed        INTEGER NOT NULL,
    failed_details      TEXT,
    duration_ms         INTEGER NOT NULL,
    status              TEXT NOT NULL CHECK(status IN ('PASS', 'DEGRADED', 'FAIL'))
);

CREATE INDEX IF NOT EXISTS idx_health_checks_ran ON health_checks(job_id, ran_at DESC);
"#;

pub fn initialize_pragmas(conn: &Connection) -> Result<()> {
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "busy_timeout", 5000)?;
    Ok(())
}

pub fn run_migrations(conn: &mut Connection) -> Result<u32> {
    initialize_pragmas(conn)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );",
        [],
    )?;

    let current_version: u32 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get(0),
    )?;

    if current_version < 1 {
        let tx = conn.transaction()?;
        tx.execute_batch(MIGRATION_V1_SQL)?;
        tx.execute(
            "INSERT INTO schema_migrations (version) VALUES (1);",
            [],
        )?;
        tx.commit()?;
    }

    Ok(CURRENT_SCHEMA_VERSION)
}

pub fn count_tables(conn: &Connection) -> Result<usize> {
    // Count application domain tables (excluding sqlite internal tables and schema_migrations)
    let count: usize = conn.query_row(
        "SELECT count(*) FROM sqlite_master WHERE type='table' AND name IN ('drives', 'backup_jobs', 'snapshots', 'file_entries', 'chunks', 'health_checks');",
        [],
        |row| row.get(0),
    )?;
    Ok(count)
}
