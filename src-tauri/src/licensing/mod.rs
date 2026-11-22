use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::db::DatabaseManager;
use crate::error::{Result, SnapVaultError};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[allow(non_camel_case_types)]
pub enum LicenseState {
    TRIAL_ACTIVE,
    TRIAL_EXPIRED,
    LICENSED,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseStatusDto {
    pub state: LicenseState,
    pub is_licensed: bool,
    pub days_remaining: u32,
    pub first_run_at: String,
    pub is_msix: bool,
    pub permanent_restore_unlocked: bool,
}

/// Detects whether SnapVault is currently executing inside an MSIX package
/// with Windows Store Package Identity.
pub fn is_packaged_msix() -> bool {
    #[cfg(windows)]
    {
        extern "system" {
            fn GetCurrentPackageFullName(
                package_full_name_length: *mut u32,
                package_full_name: *mut u16,
            ) -> i32;
        }
        let mut len = 0u32;
        // If not running inside an MSIX package, returns APPMODEL_ERROR_NO_PACKAGE (15700)
        let res = unsafe { GetCurrentPackageFullName(&mut len, std::ptr::null_mut()) };
        // 122 is ERROR_INSUFFICIENT_BUFFER which indicates a valid package identity is present
        res == 122 || res == 0
    }
    #[cfg(not(windows))]
    {
        false
    }
}

/// Retrieves or creates the first-run UTC timestamp in SQLite app_settings
pub fn get_or_init_first_run_at(db: &DatabaseManager) -> Result<DateTime<Utc>> {
    let now = Utc::now();
    let now_str = now.to_rfc3339();

    let stored: Option<String> = db.with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT value FROM app_settings WHERE key = 'first_run_at';")?;
        let mut rows = stmt.query([])?;
        if let Some(r) = rows.next()? {
            Ok(Some(r.get(0)?))
        } else {
            Ok(None)
        }
    })?;

    if let Some(ts_str) = stored {
        if let Ok(dt) = DateTime::parse_from_rfc3339(&ts_str) {
            return Ok(dt.with_timezone(&Utc));
        }
    }

    // Persist first run timestamp
    db.with_conn_mut(|conn| {
        conn.execute(
            "INSERT INTO app_settings (key, value) VALUES ('first_run_at', ?1)
             ON CONFLICT(key) DO UPDATE SET value = ?1 WHERE value IS NULL;",
            [&now_str],
        )?;
        Ok(())
    })?;

    Ok(now)
}

/// Computes the active license status: TRIAL_ACTIVE, TRIAL_EXPIRED, or LICENSED.
pub fn get_license_status(db: &DatabaseManager) -> Result<LicenseStatusDto> {
    let is_msix = is_packaged_msix();

    // 1. Support deterministic test overrides via environment variable
    if let Ok(override_val) = std::env::var("SNAPVAULT_LICENSE_OVERRIDE") {
        match override_val.trim().to_uppercase().as_str() {
            "LICENSED" => {
                return Ok(LicenseStatusDto {
                    state: LicenseState::LICENSED,
                    is_licensed: true,
                    days_remaining: 0,
                    first_run_at: Utc::now().to_rfc3339(),
                    is_msix,
                    permanent_restore_unlocked: true,
                });
            }
            "TRIAL_EXPIRED" => {
                return Ok(LicenseStatusDto {
                    state: LicenseState::TRIAL_EXPIRED,
                    is_licensed: false,
                    days_remaining: 0,
                    first_run_at: Utc::now().to_rfc3339(),
                    is_msix,
                    permanent_restore_unlocked: true,
                });
            }
            "TRIAL_ACTIVE" => {
                return Ok(LicenseStatusDto {
                    state: LicenseState::TRIAL_ACTIVE,
                    is_licensed: false,
                    days_remaining: 14,
                    first_run_at: Utc::now().to_rfc3339(),
                    is_msix,
                    permanent_restore_unlocked: true,
                });
            }
            _ => {}
        }
    }

    // 2. Check if permanent license key is stored in SQLite
    let license_val: Option<String> = db.with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT value FROM app_settings WHERE key = 'license_status';")?;
        let mut rows = stmt.query([])?;
        if let Some(r) = rows.next()? {
            Ok(Some(r.get(0)?))
        } else {
            Ok(None)
        }
    })?;

    if let Some(status) = license_val {
        if status.eq_ignore_ascii_case("LICENSED") {
            return Ok(LicenseStatusDto {
                state: LicenseState::LICENSED,
                is_licensed: true,
                days_remaining: 0,
                first_run_at: Utc::now().to_rfc3339(),
                is_msix,
                permanent_restore_unlocked: true,
            });
        }
    }

    // 3. Compute 14-day trial countdown from first-run timestamp
    let first_run = get_or_init_first_run_at(db)?;
    let now = Utc::now();
    let elapsed_days = (now - first_run).num_days();

    if elapsed_days >= 14 {
        Ok(LicenseStatusDto {
            state: LicenseState::TRIAL_EXPIRED,
            is_licensed: false,
            days_remaining: 0,
            first_run_at: first_run.to_rfc3339(),
            is_msix,
            permanent_restore_unlocked: true,
        })
    } else {
        let days_remaining = (14 - elapsed_days) as u32;
        Ok(LicenseStatusDto {
            state: LicenseState::TRIAL_ACTIVE,
            is_licensed: false,
            days_remaining,
            first_run_at: first_run.to_rfc3339(),
            is_msix,
            permanent_restore_unlocked: true,
        })
    }
}

/// Enforces the Critical Trust Rule:
/// Creating new snapshots is only permitted while TRIAL_ACTIVE or LICENSED.
/// Once expired, snapshots are blocked, but ALL visual browsing and file restores
/// remain 100% UNLOCKED FOREVER.
pub fn verify_can_create_snapshot(db: &DatabaseManager) -> Result<()> {
    let license = get_license_status(db)?;
    if license.state == LicenseState::TRIAL_EXPIRED {
        return Err(SnapVaultError::General(
            "Your 14-day free trial has expired. Upgrade to SnapVault ($19.99 one-time purchase) to create new snapshots. Your existing backups and visual restore capabilities remain permanently active and free forever.".to_string(),
        ));
    }
    Ok(())
}

/// Stores a license activation key in SQLite app_settings
pub fn activate_license(db: &DatabaseManager, license_key: &str) -> Result<bool> {
    if license_key.trim().is_empty() {
        return Ok(false);
    }

    db.with_conn_mut(|conn| {
        let tx = conn.transaction()?;
        tx.execute(
            "INSERT INTO app_settings (key, value) VALUES ('license_status', 'LICENSED')
             ON CONFLICT(key) DO UPDATE SET value = 'LICENSED';",
            [],
        )?;
        tx.execute(
            "INSERT INTO app_settings (key, value) VALUES ('license_key', ?1)
             ON CONFLICT(key) DO UPDATE SET value = ?1;",
            [license_key.trim()],
        )?;
        tx.commit()?;
        Ok(true)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    static ENV_MUTEX: Mutex<()> = Mutex::new(());

    #[test]
    fn test_fresh_install_trial_starts_active_with_14_days() {
        let _guard = ENV_MUTEX.lock().unwrap();
        let db = DatabaseManager::in_memory().expect("in-memory db");
        std::env::remove_var("SNAPVAULT_LICENSE_OVERRIDE");

        let status = get_license_status(&db).expect("status failed");
        assert_eq!(status.state, LicenseState::TRIAL_ACTIVE);
        assert_eq!(status.days_remaining, 14);
        assert!(!status.is_licensed);
        assert!(status.permanent_restore_unlocked);

        // Verify can create snapshot
        assert!(verify_can_create_snapshot(&db).is_ok());
    }

    #[test]
    fn test_env_override_trial_expired_blocks_snapshots() {
        let _guard = ENV_MUTEX.lock().unwrap();
        let db = DatabaseManager::in_memory().expect("in-memory db");
        std::env::set_var("SNAPVAULT_LICENSE_OVERRIDE", "TRIAL_EXPIRED");

        let status = get_license_status(&db).expect("status failed");
        assert_eq!(status.state, LicenseState::TRIAL_EXPIRED);
        assert_eq!(status.days_remaining, 0);
        assert!(!status.is_licensed);
        assert!(status.permanent_restore_unlocked);

        // Snapshot creation must be blocked
        let check = verify_can_create_snapshot(&db);
        assert!(check.is_err(), "Expired trial must block snapshot creation");
        assert!(check.unwrap_err().to_string().contains("14-day free trial has expired"));

        std::env::remove_var("SNAPVAULT_LICENSE_OVERRIDE");
    }

    #[test]
    fn test_sqlite_expired_trial_after_14_days() {
        let _guard = ENV_MUTEX.lock().unwrap();
        let db = DatabaseManager::in_memory().expect("in-memory db");
        std::env::remove_var("SNAPVAULT_LICENSE_OVERRIDE");

        let past_date = (Utc::now() - chrono::Duration::days(15)).to_rfc3339();
        db.with_conn_mut(|conn| {
            conn.execute(
                "INSERT INTO app_settings (key, value) VALUES ('first_run_at', ?1);",
                [&past_date],
            )?;
            Ok(())
        })
        .unwrap();

        let status = get_license_status(&db).expect("status failed");
        assert_eq!(status.state, LicenseState::TRIAL_EXPIRED);
        assert_eq!(status.days_remaining, 0);
        assert!(!status.is_licensed);
        assert!(verify_can_create_snapshot(&db).is_err());
    }

    #[test]
    fn test_env_override_licensed_unlocks_all_operations() {
        let _guard = ENV_MUTEX.lock().unwrap();
        let db = DatabaseManager::in_memory().expect("in-memory db");
        std::env::set_var("SNAPVAULT_LICENSE_OVERRIDE", "LICENSED");

        let status = get_license_status(&db).expect("status failed");
        assert_eq!(status.state, LicenseState::LICENSED);
        assert!(status.is_licensed);
        assert!(status.permanent_restore_unlocked);
        assert!(verify_can_create_snapshot(&db).is_ok());

        std::env::remove_var("SNAPVAULT_LICENSE_OVERRIDE");
    }

    #[test]
    fn test_activation_persists_licensed_status() {
        let _guard = ENV_MUTEX.lock().unwrap();
        let db = DatabaseManager::in_memory().expect("in-memory db");
        std::env::remove_var("SNAPVAULT_LICENSE_OVERRIDE");

        assert!(activate_license(&db, "SNAPVAULT-V1-MSSTORE-KEY").unwrap());

        let status = get_license_status(&db).expect("status failed");
        assert_eq!(status.state, LicenseState::LICENSED);
        assert!(status.is_licensed);
        assert!(verify_can_create_snapshot(&db).is_ok());
    }
}
