use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbStatus {
    pub connected: bool,
    pub journal_mode: String,
    pub foreign_keys: bool,
    pub schema_version: u32,
    pub table_count: usize,
    pub database_path: String,
}

pub fn get_db_status(conn: &Connection, db_path: &str) -> Result<DbStatus> {
    let journal_mode: String = conn.query_row("PRAGMA journal_mode;", [], |row| row.get(0))?;
    let foreign_keys_raw: i64 = conn.query_row("PRAGMA foreign_keys;", [], |row| row.get(0))?;
    let schema_version: u32 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations;",
        [],
        |row| row.get(0),
    ).unwrap_or(0);
    let table_count = crate::db::schema::count_tables(conn)?;

    Ok(DbStatus {
        connected: true,
        journal_mode,
        foreign_keys: foreign_keys_raw == 1,
        schema_version,
        table_count,
        database_path: db_path.to_string(),
    })
}
