pub mod commands;
pub mod db;
pub mod engine;
pub mod error;
pub mod licensing;
pub mod platform;
pub mod watcher;

use db::{default_db_path, DatabaseManager};
use commands::{
    browse_snapshot_dir_command, create_backup_job, diff_snapshot_files, list_backup_jobs,
    list_drives, list_snapshots, ping_db, prune_snapshots, register_drive, restore_entry,
    run_snapshot,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = default_db_path();
    let db_manager = DatabaseManager::new(&db_path)
        .expect("Failed to initialize SnapVault SQLite database");

    tauri::Builder::default()
        .manage(db_manager)
        .invoke_handler(tauri::generate_handler![
            ping_db,
            register_drive,
            list_drives,
            create_backup_job,
            list_backup_jobs,
            run_snapshot,
            list_snapshots,
            browse_snapshot_dir_command,
            diff_snapshot_files,
            restore_entry,
            prune_snapshots
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
