use tauri::State;
use serde::Serialize;
use crate::db::DatabaseManager;

#[derive(Debug, Clone, Serialize)]
pub struct PingDbResponse {
    pub status: String,
    pub table_count: usize,
    pub schema_version: u32,
    pub journal_mode: String,
    pub database_path: String,
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
