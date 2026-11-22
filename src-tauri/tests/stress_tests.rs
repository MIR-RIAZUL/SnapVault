use chrono::Utc;
use rusqlite::params;
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;
use tempfile::tempdir;

use snapvault_lib::db::DatabaseManager;
use snapvault_lib::engine::cleanup::cleanup_orphan_tmp_files;
use snapvault_lib::engine::path_helper::to_extended_length_path;
use snapvault_lib::engine::restore::restore_from_snapshot;
use snapvault_lib::engine::snapshot::execute_snapshot;

fn setup_test_drive_and_job(
    db: &DatabaseManager,
    source_dir: &Path,
    dest_dir: &Path,
) -> (i64, i64) {
    db.with_conn_mut(|conn| {
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO drives (uuid, label, mount_path, role, filesystem, last_seen_at)
             VALUES (?1, 'Stress Dest Drive', ?2, 'destination', 'NTFS', ?3);",
            params!["stress-dest-uuid", dest_dir.to_string_lossy(), now],
        )?;
        let dest_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO backup_jobs (name, source_path, destination_drive_id, schedule_type, interval_minutes, is_active)
             VALUES ('Stress Backup Job', ?1, ?2, 'interval', 60, 1);",
            params![source_dir.to_string_lossy(), dest_id],
        )?;
        let job_id = conn.last_insert_rowid();

        Ok((dest_id, job_id))
    })
    .expect("setup drive and job")
}

#[test]
fn test_stress_500_plus_nested_deep_long_paths_and_unicode_files() {
    let source_temp = tempdir().expect("source tempdir failed");
    let dest_temp = tempdir().expect("dest tempdir failed");
    let restore_temp = tempdir().expect("restore tempdir failed");

    let source_dir = source_temp.path();
    let dest_dir = dest_temp.path();
    let restore_dir = restore_temp.path();

    let db = DatabaseManager::in_memory().expect("in-memory db");
    let (_dest_id, job_id) = setup_test_drive_and_job(&db, source_dir, dest_dir);

    // 1. Generate 500 numbered files across 10 nested directories
    for folder_idx in 0..10 {
        let folder = source_dir.join(format!("folder_{:02}", folder_idx));
        fs::create_dir_all(&folder).unwrap();

        for file_idx in 0..50 {
            let file_num = folder_idx * 50 + file_idx;
            let file_path = folder.join(format!("file_{:03}.txt", file_num));
            let content = format!("Payload data for item {} in folder {:02}\n", file_num, folder_idx);
            fs::write(file_path, content).unwrap();
        }
    }

    // 2. Generate deep Windows extended-length path (> 260 characters)
    let deep_dir = source_dir
        .join("level_1_very_long_directory_name_for_testing_extended_windows_paths_11111111111111111111")
        .join("level_2_nested_subfolder_with_more_long_characters_for_length_22222222222222222222")
        .join("level_3_deep_hierarchy_folder_path_33333333333333333333")
        .join("level_4_deepest_leaf_folder_path_44444444444444444444");

    let extended_deep_dir = to_extended_length_path(&deep_dir);
    fs::create_dir_all(&extended_deep_dir).expect("failed to create deep directory");

    let deep_file_path = deep_dir.join("deep_extended_document_with_very_long_name_exceeding_windows_max_path_limit_2026.txt");
    let deep_content = "This file resides inside a path structure exceeding 260 characters on Windows NTFS.\n";
    let extended_deep_file = to_extended_length_path(&deep_file_path);
    fs::write(&extended_deep_file, deep_content).expect("failed to write deep file");

    let full_path_len = deep_file_path.to_string_lossy().len();
    assert!(
        full_path_len > 200,
        "Deep path length should be substantial (actual: {})",
        full_path_len
    );

    // 3. Generate Unicode files (Bengali, Japanese, spaces & emojis)
    let bengali_dir = source_dir.join("বাংলা_ডকুমেন্টস");
    fs::create_dir_all(to_extended_length_path(&bengali_dir)).unwrap();
    let bengali_file = bengali_dir.join("আমার_সোনার_বাংলা.txt");
    let bengali_content = "আমার সোনার বাংলা, আমি তোমায় ভালোবাসি। চিরদিন তোমার আকাশ, তোমার বাতাস, আমার প্রাণে বাজায় বাঁশি।\n";
    fs::write(to_extended_length_path(&bengali_file), bengali_content).unwrap();

    let japanese_dir = source_dir.join("日本語_フォルダ");
    fs::create_dir_all(to_extended_length_path(&japanese_dir)).unwrap();
    let japanese_file = japanese_dir.join("スナップボルト_要件定義書_2026.docx");
    let japanese_content = "SnapVaultはWindows 11向けの完全オフラインバックアップソリューションです。\n";
    fs::write(to_extended_length_path(&japanese_file), japanese_content).unwrap();

    let emoji_dir = source_dir.join("Photos & Documents 📸");
    fs::create_dir_all(to_extended_length_path(&emoji_dir)).unwrap();
    let emoji_file = emoji_dir.join("Summer Vacation 🏖️ 2026 🎉.dat");
    let emoji_content = vec![0xAB, 0xCD, 0xEF, 0x42, 0x99, 0x11, 0x33];
    fs::write(to_extended_length_path(&emoji_file), &emoji_content).unwrap();

    // Total files = 500 numbered + 1 deep + 3 unicode = 504 files
    let manifest = execute_snapshot(&db, job_id, |_| {}).expect("execute_snapshot failed");
    assert_eq!(manifest.total_files, 504, "Expected exactly 504 files in manifest");

    // Restore all 504 files into restore_dir
    let restore_result = restore_from_snapshot(&db, manifest.snapshot_id, None, restore_dir, true)
        .expect("restore_from_snapshot failed");

    assert_eq!(restore_result.files_restored, 504);
    assert_eq!(restore_result.failed_files.len(), 0);

    // Byte-for-byte verification of deep and Unicode files
    let restored_bengali = restore_dir.join("বাংলা_ডকুমেন্টস").join("আমার_সোনার_বাংলা.txt");
    let mut read_bengali = String::new();
    File::open(to_extended_length_path(&restored_bengali))
        .unwrap()
        .read_to_string(&mut read_bengali)
        .unwrap();
    assert_eq!(read_bengali, bengali_content);

    let restored_japanese = restore_dir.join("日本語_フォルダ").join("スナップボルト_要件定義書_2026.docx");
    let mut read_japanese = String::new();
    File::open(to_extended_length_path(&restored_japanese))
        .unwrap()
        .read_to_string(&mut read_japanese)
        .unwrap();
    assert_eq!(read_japanese, japanese_content);

    let restored_emoji = restore_dir.join("Photos & Documents 📸").join("Summer Vacation 🏖️ 2026 🎉.dat");
    let mut read_emoji = Vec::new();
    File::open(to_extended_length_path(&restored_emoji))
        .unwrap()
        .read_to_end(&mut read_emoji)
        .unwrap();
    assert_eq!(read_emoji, emoji_content);

    let restored_deep = restore_dir
        .join("level_1_very_long_directory_name_for_testing_extended_windows_paths_11111111111111111111")
        .join("level_2_nested_subfolder_with_more_long_characters_for_length_22222222222222222222")
        .join("level_3_deep_hierarchy_folder_path_33333333333333333333")
        .join("level_4_deepest_leaf_folder_path_44444444444444444444")
        .join("deep_extended_document_with_very_long_name_exceeding_windows_max_path_limit_2026.txt");
    let mut read_deep = String::new();
    File::open(to_extended_length_path(&restored_deep))
        .unwrap()
        .read_to_string(&mut read_deep)
        .unwrap();
    assert_eq!(read_deep, deep_content);
}

#[test]
fn test_default_exclusion_patterns_skip_unwanted_files() {
    let source_temp = tempdir().expect("source tempdir failed");
    let dest_temp = tempdir().expect("dest tempdir failed");

    let source_dir = source_temp.path();
    let dest_dir = dest_temp.path();

    let db = DatabaseManager::in_memory().expect("in-memory db");
    let (_dest_id, job_id) = setup_test_drive_and_job(&db, source_dir, dest_dir);

    // Legitimate files that MUST be backed up
    let real_file1 = source_dir.join("src").join("main.rs");
    let real_file2 = source_dir.join("docs").join("guide.md");
    let real_file3 = source_dir.join("data.json");
    fs::create_dir_all(real_file1.parent().unwrap()).unwrap();
    fs::create_dir_all(real_file2.parent().unwrap()).unwrap();
    fs::write(&real_file1, "fn main() { println!(\"Hello\"); }").unwrap();
    fs::write(&real_file2, "# SnapVault User Guide").unwrap();
    fs::write(&real_file3, "{\"status\": \"ok\"}").unwrap();

    // Excluded files that MUST be skipped by default
    let nm_file = source_dir.join("node_modules").join("react").join("index.js");
    let git_file = source_dir.join(".git").join("objects").join("0a").join("123456");
    let office_lock = source_dir.join("docs").join("~$guide.md");
    let tmp_file = source_dir.join("scratch.tmp");
    let thumbs_file = source_dir.join("src").join("Thumbs.db");
    let recycle_file = source_dir.join("$RECYCLE.BIN").join("old.txt");
    let sys_vol_file = source_dir.join("System Volume Information").join("meta.log");

    fs::create_dir_all(nm_file.parent().unwrap()).unwrap();
    fs::create_dir_all(git_file.parent().unwrap()).unwrap();
    fs::create_dir_all(recycle_file.parent().unwrap()).unwrap();
    fs::create_dir_all(sys_vol_file.parent().unwrap()).unwrap();

    fs::write(&nm_file, "module.exports = {};").unwrap();
    fs::write(&git_file, "blob data").unwrap();
    fs::write(&office_lock, "office lock").unwrap();
    fs::write(&tmp_file, "temporary data").unwrap();
    fs::write(&thumbs_file, "binary cache").unwrap();
    fs::write(&recycle_file, "deleted data").unwrap();
    fs::write(&sys_vol_file, "system volume data").unwrap();

    let manifest = execute_snapshot(&db, job_id, |_| {}).expect("execute_snapshot failed");

    // Only the 3 legitimate files should be backed up
    assert_eq!(manifest.total_files, 3);

    let recorded_paths: Vec<String> = manifest.files.into_iter().map(|f| f.relative_path).collect();
    assert!(recorded_paths.iter().any(|p| p.ends_with("main.rs")));
    assert!(recorded_paths.iter().any(|p| p.ends_with("guide.md")));
    assert!(recorded_paths.iter().any(|p| p.ends_with("data.json")));

    // Verify none of the excluded paths exist in manifest
    assert!(!recorded_paths.iter().any(|p| p.contains("node_modules")));
    assert!(!recorded_paths.iter().any(|p| p.contains(".git/objects")));
    assert!(!recorded_paths.iter().any(|p| p.contains("~$")));
    assert!(!recorded_paths.iter().any(|p| p.ends_with(".tmp")));
    assert!(!recorded_paths.iter().any(|p| p.ends_with("Thumbs.db")));
    assert!(!recorded_paths.iter().any(|p| p.contains("$RECYCLE.BIN")));
    assert!(!recorded_paths.iter().any(|p| p.contains("System Volume Information")));
}

#[test]
fn test_orphan_tmp_cleanup_preserves_valid_chunks() {
    let dest_temp = tempdir().expect("dest tempdir failed");
    let dest_dir = dest_temp.path();

    let chunks_dir = dest_dir.join(".snapvault").join("chunks").join("3a").join("7b");
    let manifests_dir = dest_dir.join(".snapvault").join("manifests");
    fs::create_dir_all(&chunks_dir).unwrap();
    fs::create_dir_all(&manifests_dir).unwrap();

    // Valid production files
    let chunk1 = chunks_dir.join("3a7b1122.chunk");
    let chunk2 = chunks_dir.join("3a7b3344.chunk");
    let manifest1 = manifests_dir.join("1.json");
    fs::write(&chunk1, b"chunk payload 1").unwrap();
    fs::write(&chunk2, b"chunk payload 2").unwrap();
    fs::write(&manifest1, b"{\"id\": 1}").unwrap();

    // Abandoned .tmp files from simulated crash/unplug
    let tmp_chunk1 = chunks_dir.join("3a7b1122.chunk.tmp.uuid1");
    let tmp_chunk2 = chunks_dir.join("staging.tmp");
    let tmp_manifest = manifests_dir.join("1.json.tmp.uuid2");
    fs::write(&tmp_chunk1, b"partial").unwrap();
    fs::write(&tmp_chunk2, b"corrupted").unwrap();
    fs::write(&tmp_manifest, b"incomplete json").unwrap();

    let swept_count = cleanup_orphan_tmp_files(dest_dir).expect("cleanup failed");
    assert_eq!(swept_count, 3, "Must clean up exactly 3 orphaned tmp files");

    // Confirm valid files exist
    assert!(chunk1.exists());
    assert!(chunk2.exists());
    assert!(manifest1.exists());

    // Confirm tmp files are gone
    assert!(!tmp_chunk1.exists());
    assert!(!tmp_chunk2.exists());
    assert!(!tmp_manifest.exists());
}

#[test]
fn test_corrupt_chunk_during_batch_restore_reports_failure_and_restores_healthy_files() {
    let source_temp = tempdir().expect("source tempdir failed");
    let dest_temp = tempdir().expect("dest tempdir failed");
    let restore_temp = tempdir().expect("restore tempdir failed");

    let source_dir = source_temp.path();
    let dest_dir = dest_temp.path();
    let restore_dir = restore_temp.path();

    let db = DatabaseManager::in_memory().expect("in-memory db");
    let (_dest_id, job_id) = setup_test_drive_and_job(&db, source_dir, dest_dir);

    // Create 10 files
    for i in 0..10 {
        let p = source_dir.join(format!("doc_{:02}.txt", i));
        fs::write(p, format!("Content of document {:02}\n", i)).unwrap();
    }

    let manifest = execute_snapshot(&db, job_id, |_| {}).expect("execute_snapshot failed");
    assert_eq!(manifest.total_files, 10);

    // Corrupt doc_04's chunk
    let doc_04_entry = manifest.files.iter().find(|f| f.relative_path.ends_with("doc_04.txt")).unwrap();
    let target_chunk_hash = &doc_04_entry.chunk_hashes[0];
    let chunk_path = dest_dir
        .join(".snapvault")
        .join("chunks")
        .join(&target_chunk_hash[0..2])
        .join(&target_chunk_hash[2..4])
        .join(format!("{}.chunk", target_chunk_hash));

    assert!(chunk_path.exists());
    fs::write(&chunk_path, b"CORRUPTED_GARBAGE_DATA_THAT_FAILS_BLAKE3").unwrap();

    // Run batch restore of entire snapshot
    let restore_result = restore_from_snapshot(&db, manifest.snapshot_id, None, restore_dir, true)
        .expect("batch restore must complete without panicking");

    // 9 healthy files must be restored successfully
    assert_eq!(restore_result.files_restored, 9);
    assert_eq!(restore_result.failed_files.len(), 1);

    // Check failed file report
    let fail_report = &restore_result.failed_files[0];
    assert!(fail_report.contains("doc_04.txt"));
    assert!(fail_report.contains("Integrity verification failed"));

    // Verify a healthy file was restored correctly
    let healthy_doc_01 = restore_dir.join("doc_01.txt");
    assert!(healthy_doc_01.exists());
    let mut healthy_content = String::new();
    File::open(healthy_doc_01).unwrap().read_to_string(&mut healthy_content).unwrap();
    assert_eq!(healthy_content, "Content of document 01\n");
}
