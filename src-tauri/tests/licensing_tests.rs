use std::fs;
use std::sync::Mutex;
use tempfile::tempdir;
use chrono::Utc;
use rusqlite::params;

static INTEGRATION_ENV_MUTEX: Mutex<()> = Mutex::new(());

use snapvault_lib::db::DatabaseManager;
use snapvault_lib::engine::restore::{
    browse_snapshot_dir, preview_snapshot_file, restore_from_snapshot,
};
use snapvault_lib::engine::snapshot::execute_snapshot;
use snapvault_lib::licensing::{
    activate_license, get_license_status, verify_can_create_snapshot, LicenseState,
};

fn setup_test_environment() -> (tempfile::TempDir, tempfile::TempDir, DatabaseManager, i64) {
    let src_dir = tempdir().expect("src tempdir");
    let dest_dir = tempdir().expect("dest tempdir");
    let db = DatabaseManager::in_memory().expect("in-memory db");

    let now = Utc::now().to_rfc3339();
    let dest_path = dest_dir.path().to_string_lossy().to_string();
    let src_path = src_dir.path().to_string_lossy().to_string();

    let job_id = db
        .with_conn_mut(|conn| {
            conn.execute(
                "INSERT INTO drives (uuid, label, mount_path, role, filesystem, last_seen_at)
                 VALUES ('dest-uuid-license', 'Backup Drive', ?1, 'destination', 'NTFS', ?2);",
                params![dest_path, now],
            )?;
            let dest_id = conn.last_insert_rowid();

            conn.execute(
                "INSERT INTO backup_jobs (name, source_path, destination_drive_id, schedule_type)
                 VALUES ('License Test Job', ?1, ?2, 'manual');",
                params![src_path, dest_id],
            )?;
            Ok(conn.last_insert_rowid())
        })
        .expect("setup failed");

    (src_dir, dest_dir, db, job_id)
}

#[test]
fn test_licensing_fresh_install_lifecycle_and_trial_active() {
    let _guard = INTEGRATION_ENV_MUTEX.lock().unwrap();
    std::env::remove_var("SNAPVAULT_LICENSE_OVERRIDE");
    let (_src, _dest, db, _job_id) = setup_test_environment();

    let status = get_license_status(&db).expect("status");
    assert_eq!(status.state, LicenseState::TRIAL_ACTIVE);
    assert_eq!(status.days_remaining, 14);
    assert!(!status.is_licensed);
    assert!(status.permanent_restore_unlocked);

    // Snapshot allowed during active trial
    assert!(verify_can_create_snapshot(&db).is_ok());
}

#[test]
fn test_licensing_permanent_restore_guarantee_when_trial_expired() {
    let _guard = INTEGRATION_ENV_MUTEX.lock().unwrap();
    std::env::remove_var("SNAPVAULT_LICENSE_OVERRIDE");
    let (src_dir, _dest_dir, db, job_id) = setup_test_environment();

    // 1. While in trial, create a file and run a successful snapshot
    let doc_path = src_dir.path().join("guaranteed_document.txt");
    fs::write(&doc_path, "Crucial user data created during trial").unwrap();

    let snap_res = execute_snapshot(&db, job_id, |_| {}).expect("snapshot should succeed");
    let snap_id = snap_res.snapshot_id;

    // 2. Simulate trial expiration via SNAPVAULT_LICENSE_OVERRIDE
    std::env::set_var("SNAPVAULT_LICENSE_OVERRIDE", "TRIAL_EXPIRED");

    let status = get_license_status(&db).expect("status");
    assert_eq!(status.state, LicenseState::TRIAL_EXPIRED);
    assert_eq!(status.days_remaining, 0);
    assert!(!status.is_licensed);
    assert!(status.permanent_restore_unlocked);

    // 3. New snapshot creation MUST be blocked
    let block_err = verify_can_create_snapshot(&db);
    assert!(block_err.is_err(), "Snapshot creation must be blocked when trial expired");
    assert!(block_err.unwrap_err().to_string().contains("14-day free trial has expired"));

    // 4. CRITICAL TRUST RULE: Permanent Restore Guarantee
    // File browsing MUST remain 100% unlocked
    let browse_items = browse_snapshot_dir(&db, snap_id, "").expect("browse must remain unlocked");
    assert_eq!(browse_items.len(), 1);
    assert_eq!(browse_items[0].name, "guaranteed_document.txt");

    // Previewing file content MUST remain 100% unlocked
    let preview = preview_snapshot_file(&db, snap_id, "guaranteed_document.txt", None)
        .expect("preview must remain unlocked");
    assert_eq!(preview.snapshot_content.as_deref(), Some("Crucial user data created during trial"));

    // Restoring file to disk MUST remain 100% unlocked
    let restore_target_dir = tempdir().expect("restore dir");
    let restore_stats = restore_from_snapshot(
        &db,
        snap_id,
        Some("guaranteed_document.txt"),
        restore_target_dir.path(),
        true,
    )
    .expect("restore must remain 100% unlocked even when trial expired");

    assert_eq!(restore_stats.files_restored, 1);
    let restored_file = restore_target_dir.path().join("guaranteed_document.txt");
    let restored_bytes = fs::read(&restored_file).expect("read restored file");
    assert_eq!(restored_bytes, b"Crucial user data created during trial");

    // 5. Upgrade / Activate License unlocks new snapshots immediately
    std::env::remove_var("SNAPVAULT_LICENSE_OVERRIDE");
    assert!(activate_license(&db, "STORE-PURCHASE-RECEIPT-KEY").unwrap());

    let post_activation = get_license_status(&db).expect("status post activation");
    assert_eq!(post_activation.state, LicenseState::LICENSED);
    assert!(post_activation.is_licensed);
    assert!(verify_can_create_snapshot(&db).is_ok());
}
