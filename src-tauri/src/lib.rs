pub mod commands;
pub mod db;
pub mod engine;
pub mod error;
pub mod licensing;
pub mod platform;
pub mod watcher;

use db::{default_db_path, DatabaseManager};
use platform::setup_tray;
use watcher::{start_drive_watcher, WatcherState};
use commands::{
    browse_snapshot_dir_command, create_backup_job, diff_snapshot_files, get_latest_health_status,
    list_backup_jobs, list_drives, list_snapshots, pause_backups, ping_db, preview_snapshot_file,
    prune_snapshots, register_drive, restore_entry, resume_backups, run_health_check, run_snapshot,
    toggle_plain_mirror, unlock_tripwire_snapshot,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = default_db_path();
    let db_manager = DatabaseManager::new(&db_path)
        .expect("Failed to initialize SnapVault SQLite database");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(db_manager)
        .manage(WatcherState::new())
        .setup(|app| {
            let _ = setup_tray(app);
            start_drive_watcher(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
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
            prune_snapshots,
            preview_snapshot_file,
            run_health_check,
            get_latest_health_status,
            unlock_tripwire_snapshot,
            toggle_plain_mirror,
            pause_backups,
            resume_backups
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
