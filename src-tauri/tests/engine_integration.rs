use std::fs;
use std::path::Path;
use tempfile::tempdir;
use chrono::{Duration, Utc};
use rusqlite::params;

use snapvault_lib::db::DatabaseManager;
use snapvault_lib::engine::prune::prune_and_garbage_collect;
use snapvault_lib::engine::restore::{
    browse_snapshot_dir, diff_snapshots, restore_from_snapshot, DiffKind,
};
use snapvault_lib::engine::snapshot::execute_snapshot;

fn setup_test_job(
    db: &DatabaseManager,
    source_path: &str,
    dest_path: &str,
) -> (i64, i64) {
    db.with_conn_mut(|conn| {
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO drives (uuid, label, mount_path, role, filesystem, last_seen_at)
             VALUES ('dest-uuid-1', 'Backup Drive', ?1, 'destination', 'NTFS', ?2);",
            params![dest_path, now],
        )?;
        let dest_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO backup_jobs (name, source_path, destination_drive_id, schedule_type)
             VALUES ('Test Job', ?1, ?2, 'manual');",
            params![source_path, dest_id],
        )?;
        let job_id = conn.last_insert_rowid();

        Ok((dest_id, job_id))
    })
    .expect("setup test job failed")
}

#[test]
fn test_1_snapshot_dedup_and_diff_changes() {
    let source_temp = tempdir().expect("source tempdir");
    let dest_temp = tempdir().expect("dest tempdir");
    let db_temp = tempdir().expect("db tempdir");

    let db_path = db_temp.path().join("test.db");
    let db = DatabaseManager::new(&db_path).expect("db init");

    let source_dir = source_temp.path();
    let dest_dir = dest_temp.path();

    let (_dest_id, job_id) = setup_test_job(
        &db,
        &source_dir.to_string_lossy(),
        &dest_dir.to_string_lossy(),
    );

    // Initial files
    fs::write(source_dir.join("file1.txt"), b"Hello SnapVault world content A").unwrap();
    fs::write(source_dir.join("file2.txt"), b"File 2 will be deleted later").unwrap();
    fs::create_dir_all(source_dir.join("sub")).unwrap();
    fs::write(source_dir.join("sub").join("file3.txt"), b"Persistent unchanged file in subfolder").unwrap();

    // 1. First snapshot
    let manifest1 = execute_snapshot(&db, job_id, |_| {}).expect("first snapshot must succeed");
    assert_eq!(manifest1.total_files, 3);
    assert!(manifest1.new_bytes_stored > 0);

    // Verify browse_snapshot_dir
    let root_items = browse_snapshot_dir(&db, manifest1.snapshot_id, "").expect("browse root");
    assert_eq!(root_items.len(), 3); // "sub" (dir), "file1.txt", "file2.txt"
    assert!(root_items.iter().any(|i| i.name == "sub" && i.is_dir));
    assert!(root_items.iter().any(|i| i.name == "file1.txt" && !i.is_dir));

    let sub_items = browse_snapshot_dir(&db, manifest1.snapshot_id, "sub").expect("browse sub");
    assert_eq!(sub_items.len(), 1);
    assert_eq!(sub_items[0].name, "file3.txt");

    // 2. Modify file1, delete file2, add file4
    fs::write(source_dir.join("file1.txt"), b"Modified content in file 1").unwrap();
    fs::remove_file(source_dir.join("file2.txt")).unwrap();
    fs::write(source_dir.join("file4.txt"), b"Brand new file 4").unwrap();

    // 3. Second snapshot
    let manifest2 = execute_snapshot(&db, job_id, |_| {}).expect("second snapshot must succeed");
    assert_eq!(manifest2.total_files, 3); // file1, sub/file3, file4
    assert!(manifest2.dedup_saved_bytes > 0, "file3 should be deduplicated");

    // 4. Verify diff_snapshots
    let diffs = diff_snapshots(&db, manifest1.snapshot_id, manifest2.snapshot_id).expect("diff must succeed");

    let file1_diff = diffs.iter().find(|d| d.relative_path == "file1.txt").expect("file1 in diff");
    assert_eq!(file1_diff.kind, DiffKind::MODIFIED);

    let file2_diff = diffs.iter().find(|d| d.relative_path == "file2.txt").expect("file2 in diff");
    assert_eq!(file2_diff.kind, DiffKind::DELETED);

    let file4_diff = diffs.iter().find(|d| d.relative_path == "file4.txt").expect("file4 in diff");
    assert_eq!(file4_diff.kind, DiffKind::ADDED);

    let file3_diff = diffs.iter().find(|d| d.relative_path == "sub/file3.txt").expect("file3 in diff");
    assert_eq!(file3_diff.kind, DiffKind::UNCHANGED);
}

#[test]
fn test_2_simulated_interruption_and_resumption() {
    let source_temp = tempdir().expect("source tempdir");
    let dest_temp = tempdir().expect("dest tempdir");
    let db_temp = tempdir().expect("db tempdir");

    let db_path = db_temp.path().join("test.db");
    let db = DatabaseManager::new(&db_path).expect("db init");

    let source_dir = source_temp.path();
    let dest_dir = dest_temp.path();

    let (_dest_id, job_id) = setup_test_job(
        &db,
        &source_dir.to_string_lossy(),
        &dest_dir.to_string_lossy(),
    );

    // Initial backup
    fs::write(source_dir.join("sample.txt"), b"Initial stable backup data").unwrap();
    let snap1 = execute_snapshot(&db, job_id, |_| {}).expect("initial snapshot");
    assert_eq!(snap1.total_files, 1);

    // Point destination drive to an invalid non-existent path to simulate unplugged drive
    db.with_conn_mut(|conn| {
        conn.execute(
            "UPDATE drives SET mount_path = 'Z:\\NonExistentDrive_Unplugged' WHERE role = 'destination';",
            [],
        )?;
        Ok(())
    }).unwrap();

    // Re-run snapshot: should fail with unplug safety
    let fail_res = execute_snapshot(&db, job_id, |_| {});
    assert!(fail_res.is_err(), "Must report error when drive is unplugged");

    // Check database: prior snapshot must remain COMMITTED
    let snap1_status: String = db.with_conn(|conn| {
        let s: String = conn.query_row(
            "SELECT status FROM snapshots WHERE id = ?1;",
            params![snap1.snapshot_id],
            |row| row.get(0),
        )?;
        Ok(s)
    }).unwrap();
    assert_eq!(snap1_status, "COMMITTED", "Prior snapshot must remain COMMITTED");

    // Restore destination path and re-run: should succeed cleanly via chunk dedup
    db.with_conn_mut(|conn| {
        conn.execute(
            "UPDATE drives SET mount_path = ?1 WHERE role = 'destination';",
            params![dest_dir.to_string_lossy()],
        )?;
        Ok(())
    }).unwrap();

    let resume_snap = execute_snapshot(&db, job_id, |_| {}).expect("resumed snapshot must succeed");
    assert_eq!(resume_snap.total_files, 1);
}

#[test]
fn test_3_restore_byte_identity_and_conflict_naming() {
    let source_temp = tempdir().expect("source tempdir");
    let dest_temp = tempdir().expect("dest tempdir");
    let restore_temp = tempdir().expect("restore tempdir");
    let db_temp = tempdir().expect("db tempdir");

    let db_path = db_temp.path().join("test.db");
    let db = DatabaseManager::new(&db_path).expect("db init");

    let source_dir = source_temp.path();
    let dest_dir = dest_temp.path();
    let restore_dir = restore_temp.path();

    let (_dest_id, job_id) = setup_test_job(
        &db,
        &source_dir.to_string_lossy(),
        &dest_dir.to_string_lossy(),
    );

    // Create 64 KB of patterned test data
    let test_data = (0..65536).map(|i| (i % 256) as u8).collect::<Vec<u8>>();
    let expected_hash = blake3::hash(&test_data).to_hex().to_string();

    fs::write(source_dir.join("document.bin"), &test_data).unwrap();

    let snap = execute_snapshot(&db, job_id, |_| {}).expect("snapshot");

    // Restore single file
    let res = restore_from_snapshot(
        &db,
        snap.snapshot_id,
        Some("document.bin"),
        restore_dir,
        false,
    ).expect("restore single file");

    assert_eq!(res.files_restored, 1);
    let restored_file_path = restore_dir.join("document.bin");
    assert!(restored_file_path.exists());

    let restored_bytes = fs::read(&restored_file_path).unwrap();
    let restored_hash = blake3::hash(&restored_bytes).to_hex().to_string();
    assert_eq!(restored_hash, expected_hash, "Restored file must be byte-for-byte identical");

    // Restore again with overwrite = false -> conflict resolution file created
    let res_conflict = restore_from_snapshot(
        &db,
        snap.snapshot_id,
        Some("document.bin"),
        restore_dir,
        false,
    ).expect("conflict restore");

    assert_eq!(res_conflict.files_restored, 1);
    assert_eq!(res_conflict.restored_paths.len(), 1);
    assert!(res_conflict.restored_paths[0].contains("(restored "), "Conflict name must include '(restored '");
    assert!(Path::new(&res_conflict.restored_paths[0]).exists());
    assert!(restored_file_path.exists(), "Original restored file must still exist");

    // Restore with overwrite = true
    let res_overwrite = restore_from_snapshot(
        &db,
        snap.snapshot_id,
        Some("document.bin"),
        restore_dir,
        true,
    ).expect("overwrite restore");
    assert_eq!(res_overwrite.files_restored, 1);
}

#[test]
fn test_4_gfs_pruning_and_orphan_chunk_gc() {
    let source_temp = tempdir().expect("source tempdir");
    let dest_temp = tempdir().expect("dest tempdir");
    let db_temp = tempdir().expect("db tempdir");

    let db_path = db_temp.path().join("test.db");
    let db = DatabaseManager::new(&db_path).expect("db init");

    let source_dir = source_temp.path();
    let dest_dir = dest_temp.path();

    let (_dest_id, job_id) = setup_test_job(
        &db,
        &source_dir.to_string_lossy(),
        &dest_dir.to_string_lossy(),
    );

    // Snapshot 1: Unique file, 40 days ago, LOCKED
    fs::write(source_dir.join("locked_file.txt"), b"Secret immutable archive data").unwrap();
    let snap1 = execute_snapshot(&db, job_id, |_| {}).expect("snap 1");

    let time_40d_ago = (Utc::now() - Duration::days(40)).to_rfc3339();
    db.with_conn_mut(|conn| {
        conn.execute(
            "UPDATE snapshots SET completed_at = ?1, is_locked_readonly = 1 WHERE id = ?2;",
            params![time_40d_ago, snap1.snapshot_id],
        )?;
        Ok(())
    }).unwrap();

    // Snapshot 2: Unique file, 40 days ago, NOT LOCKED (will be deleted by GFS)
    fs::write(source_dir.join("temp_old.txt"), b"Temporary data that should expire").unwrap();
    fs::remove_file(source_dir.join("locked_file.txt")).unwrap();
    let snap2 = execute_snapshot(&db, job_id, |_| {}).expect("snap 2");

    db.with_conn_mut(|conn| {
        conn.execute(
            "UPDATE snapshots SET completed_at = ?1, is_locked_readonly = 0 WHERE id = ?2;",
            params![time_40d_ago, snap2.snapshot_id],
        )?;
        Ok(())
    }).unwrap();

    // Snapshot 3: Recent snapshot (today)
    fs::write(source_dir.join("today.txt"), b"Fresh file from today").unwrap();
    fs::remove_file(source_dir.join("temp_old.txt")).unwrap();
    let snap3 = execute_snapshot(&db, job_id, |_| {}).expect("snap 3");

    // Run GFS Pruning & Garbage Collection
    let prune_res = prune_and_garbage_collect(&db, job_id).expect("prune must succeed");
    assert!(prune_res.snapshots_deleted >= 1, "Snap 2 should be deleted");

    // Verify Snapshot 1 (LOCKED) still exists
    let snap1_exists: bool = db.with_conn(|conn| {
        let count: i64 = conn.query_row(
            "SELECT count(*) FROM snapshots WHERE id = ?1;",
            params![snap1.snapshot_id],
            |row| row.get(0),
        )?;
        Ok(count == 1)
    }).unwrap();
    assert!(snap1_exists, "Locked snapshot 1 must NEVER be pruned");

    // Verify Snapshot 2 (UNLOCKED expired) was deleted
    let snap2_exists: bool = db.with_conn(|conn| {
        let count: i64 = conn.query_row(
            "SELECT count(*) FROM snapshots WHERE id = ?1;",
            params![snap2.snapshot_id],
            |row| row.get(0),
        )?;
        Ok(count == 1)
    }).unwrap();
    assert!(!snap2_exists, "Expired snapshot 2 must be pruned");

    // Verify Snapshot 3 still exists
    let snap3_exists: bool = db.with_conn(|conn| {
        let count: i64 = conn.query_row(
            "SELECT count(*) FROM snapshots WHERE id = ?1;",
            params![snap3.snapshot_id],
            |row| row.get(0),
        )?;
        Ok(count == 1)
    }).unwrap();
    assert!(snap3_exists, "Recent snapshot 3 must be retained");
}
