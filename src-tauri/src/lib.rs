pub mod commands;
pub mod db;
pub mod engine;
pub mod error;
pub mod licensing;
pub mod platform;
pub mod watcher;

use db::{default_db_path, DatabaseManager};
use commands::ping_db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = default_db_path();
    let db_manager = DatabaseManager::new(&db_path)
        .expect("Failed to initialize SnapVault SQLite database");

    tauri::Builder::default()
        .manage(db_manager)
        .invoke_handler(tauri::generate_handler![ping_db])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
