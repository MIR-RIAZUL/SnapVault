use std::collections::HashSet;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

use crate::db::DatabaseManager;
use crate::engine::snapshot::execute_snapshot;

pub struct WatcherState {
    pub is_paused: AtomicBool,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self::new()
    }
}

impl WatcherState {
    pub fn new() -> Self {
        Self {
            is_paused: AtomicBool::new(false),
        }
    }

    pub fn set_paused(&self, paused: bool) {
        self.is_paused.store(paused, Ordering::SeqCst);
    }

    pub fn is_paused(&self) -> bool {
        self.is_paused.load(Ordering::SeqCst)
    }
}

/// Starts the lightweight background drive-watcher polling loop.
/// Detects USB drive reconnections and triggers due backups when not paused.
pub fn start_drive_watcher(app_handle: AppHandle) {
    std::thread::spawn(move || {
        let mut last_connected_drives = HashSet::new();

        loop {
            std::thread::sleep(Duration::from_secs(30));

            let state = app_handle.state::<WatcherState>();
            if state.is_paused() {
                continue;
            }

            let db = app_handle.state::<DatabaseManager>();

            // Query active backup jobs and their destination drives
            let jobs: Vec<(i64, String, String, Option<String>)> = match db.with_conn(|conn| {
                let mut stmt = conn.prepare(
                    "SELECT j.id, j.name, d.mount_path, j.last_run_at 
                     FROM backup_jobs j 
                     JOIN drives d ON j.destination_drive_id = d.id 
                     WHERE j.is_active = 1;",
                )?;
                let rows = stmt.query_map([], |row| {
                    Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
                })?;
                let mut list = Vec::new();
                for r in rows {
                    list.push(r?);
                }
                Ok(list)
            }) {
                Ok(j) => j,
                Err(_) => continue,
            };

            for (job_id, job_name, mount_path, _last_run) in jobs {
                let path = Path::new(&mount_path);
                let is_connected = path.exists() && path.is_dir();

                if is_connected && !last_connected_drives.contains(&mount_path) {
                    // Drive was just plugged in / reconnected!
                    let _ = app_handle.emit(
                        "drive-connected",
                        serde_json::json!({
                            "job_id": job_id,
                            "job_name": job_name,
                            "mount_path": mount_path
                        }),
                    );

                    // Execute snapshot automatically upon drive reconnect
                    let _ = execute_snapshot(&db, job_id, |_| {});
                }

                if is_connected {
                    last_connected_drives.insert(mount_path);
                } else {
                    last_connected_drives.remove(&mount_path);
                }
            }
        }
    });
}
