pub mod models;
pub mod queries;
pub mod schema;

use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use crate::error::Result;

pub struct DatabaseManager {
    conn: Mutex<Connection>,
    path: PathBuf,
}

impl DatabaseManager {
    pub fn new(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut conn = Connection::open(path)?;
        schema::run_migrations(&mut conn)?;

        Ok(Self {
            conn: Mutex::new(conn),
            path: path.to_path_buf(),
        })
    }

    pub fn in_memory() -> Result<Self> {
        let mut conn = Connection::open_in_memory()?;
        schema::run_migrations(&mut conn)?;

        Ok(Self {
            conn: Mutex::new(conn),
            path: PathBuf::from(":memory:"),
        })
    }

    pub fn get_status(&self) -> Result<queries::DbStatus> {
        let conn = self.conn.lock().map_err(|e| crate::error::SnapVaultError::Lock(e.to_string()))?;
        let status = queries::get_db_status(&conn, &self.path.to_string_lossy())?;
        Ok(status)
    }

    pub fn with_conn<F, R>(&self, f: F) -> Result<R>
    where
        F: FnOnce(&Connection) -> Result<R>,
    {
        let conn = self.conn.lock().map_err(|e| crate::error::SnapVaultError::Lock(e.to_string()))?;
        f(&conn)
    }

    pub fn with_conn_mut<F, R>(&self, f: F) -> Result<R>
    where
        F: FnOnce(&mut Connection) -> Result<R>,
    {
        let mut conn = self.conn.lock().map_err(|e| crate::error::SnapVaultError::Lock(e.to_string()))?;
        f(&mut conn)
    }
}

pub fn default_db_path() -> PathBuf {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        PathBuf::from(local_app_data).join("SnapVault").join("snapvault.db")
    } else {
        PathBuf::from(".snapvault").join("snapvault.db")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_schema_creates_all_six_tables() {
        let db = DatabaseManager::in_memory().expect("in-memory db must initialize");
        let status = db.get_status().expect("get_status must succeed");
        assert_eq!(status.table_count, 6, "Expected 6 domain tables in schema");
        assert_eq!(status.schema_version, 1, "Expected schema version 1");
    }

    #[test]
    fn test_foreign_key_enforcement() {
        let db = DatabaseManager::in_memory().expect("in-memory db must initialize");
        let result = db.with_conn(|conn| {
            // Attempting to insert a backup_job referencing non-existent drive_id 999
            conn.execute(
                "INSERT INTO backup_jobs (name, source_path, destination_drive_id) VALUES ('Test Job', 'C:\\Data', 999);",
                [],
            )?;
            Ok(())
        });

        assert!(result.is_err(), "Foreign key constraint must reject non-existent drive_id");
    }

    #[test]
    fn test_idempotent_migrations() {
        let db = DatabaseManager::in_memory().expect("in-memory db must initialize");
        // Re-running migrations on the same connection should succeed cleanly without schema errors
        let res = db.with_conn_mut(|conn| {
            let ver = schema::run_migrations(conn)?;
            Ok(ver)
        });
        assert_eq!(res.expect("re-migration must succeed"), 1);
        let status = db.get_status().expect("status check after re-migration");
        assert_eq!(status.table_count, 6);
    }

    #[test]
    fn test_file_backed_wal_mode() {
        let temp_dir = std::env::temp_dir().join("snapvault_test_wal");
        let _ = std::fs::remove_dir_all(&temp_dir);
        let db_path = temp_dir.join("test_wal.db");

        let db = DatabaseManager::new(&db_path).expect("file-backed db must initialize");
        let status = db.get_status().expect("get_status must succeed");

        assert_eq!(status.journal_mode.to_lowercase(), "wal", "File db must run in WAL mode");
        assert!(status.foreign_keys, "Foreign keys must be enabled");
        assert_eq!(status.table_count, 6);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_drive_insertion_and_query() {
        let db = DatabaseManager::in_memory().expect("in-memory db must initialize");
        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO drives (uuid, label, mount_path, role, filesystem, total_bytes, free_bytes, last_seen_at)
                 VALUES ('uuid-1234', 'Primary SSD', 'C:\\', 'source', 'NTFS', 1000000000, 500000000, '2026-11-23T00:00:00Z');",
                [],
            )?;
            let label: String = conn.query_row(
                "SELECT label FROM drives WHERE uuid = 'uuid-1234';",
                [],
                |row| row.get(0),
            )?;
            assert_eq!(label, "Primary SSD");
            Ok(())
        }).expect("drive query must succeed");
    }
}
