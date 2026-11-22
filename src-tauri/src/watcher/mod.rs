use std::collections::HashSet;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use chrono::{DateTime, Utc};
use rusqlite::params;
use tauri::{AppHandle, Emitter, Manager};

use crate::db::DatabaseManager;
use crate::engine::health::run_health_check;
use crate::engine::snapshot::execute_snapshot;
use crate::platform::apply_quiet_mode_priority;

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

struct ScheduledJob {
    id: i64,
    name: String,
    mount_path: String,
    interval_minutes: i64,
    last_run_at: Option<String>,
}

/// Starts the background scheduler and filesystem drive-watcher loop.
/// Respects job interval schedules, drive connection arrivals, pause state,
/// and schedules automatic weekly proof-of-restore health checks.
/// Mitigates RISK-003 with periodic reconciliation scans.
pub fn start_drive_watcher(app_handle: AppHandle) {
    std::thread::spawn(move || {
        // Run background thread in Quiet Mode to prevent interactive latency
        apply_quiet_mode_priority(true);

        let mut last_connected_drives = HashSet::new();

        loop {
            std::thread::sleep(Duration::from_secs(30));

            let state = app_handle.state::<WatcherState>();
            if state.is_paused() {
                continue;
            }

            let db = app_handle.state::<DatabaseManager>();

            // 1. Query active backup jobs
            let jobs: Vec<ScheduledJob> = match db.with_conn(|conn| {
                let mut stmt = conn.prepare(
                    "SELECT j.id, j.name, d.mount_path, j.interval_minutes, j.last_run_at 
                     FROM backup_jobs j 
                     JOIN drives d ON j.destination_drive_id = d.id 
                     WHERE j.is_active = 1;",
                )?;
                let rows = stmt.query_map([], |row| {
                    Ok(ScheduledJob {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        mount_path: row.get(2)?,
                        interval_minutes: row.get(3)?,
                        last_run_at: row.get(4)?,
                    })
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

            let now = Utc::now();

            for job in jobs {
                let path = Path::new(&job.mount_path);
                let is_connected = path.exists() && path.is_dir();

                if !is_connected {
                    last_connected_drives.remove(&job.mount_path);
                    continue;
                }

                let was_connected = last_connected_drives.contains(&job.mount_path);
                let mut should_backup = false;

                if !was_connected {
                    // Drive arrival event: USB drive was just reconnected!
                    let _ = app_handle.emit(
                        "drive-connected",
                        serde_json::json!({
                            "job_id": job.id,
                            "job_name": job.name,
                            "mount_path": job.mount_path
                        }),
                    );
                    should_backup = true;
                } else {
                    // Check interval schedule
                    if let Some(ref last_run_str) = job.last_run_at {
                        if let Ok(last_run) = DateTime::parse_from_rfc3339(last_run_str) {
                            let elapsed_mins = (now - last_run.with_timezone(&Utc)).num_minutes();
                            if elapsed_mins >= job.interval_minutes {
                                should_backup = true;
                            }
                        }
                    } else {
                        // Never run before
                        should_backup = true;
                    }
                }

                if should_backup {
                    let _ = execute_snapshot(&db, job.id, |_| {});
                }

                // Check weekly health check schedule (proof-of-restore)
                let should_health_check = db.with_conn(|conn| {
                    let mut stmt = conn.prepare(
                        "SELECT MAX(ran_at) FROM health_checks WHERE job_id = ?1;",
                    )?;
                    let latest_ran: Option<String> = stmt.query_row(params![job.id], |r| r.get(0))?;
                    if let Some(ran_str) = latest_ran {
                        if let Ok(last_check) = DateTime::parse_from_rfc3339(&ran_str) {
                            let days = (now - last_check.with_timezone(&Utc)).num_days();
                            return Ok(days >= 7);
                        }
                    }
                    Ok(true) // No prior health check
                }).unwrap_or(false);

                if should_health_check {
                    let _ = run_health_check(&db, job.id);
                }

                last_connected_drives.insert(job.mount_path);
            }
        }
    });
}
