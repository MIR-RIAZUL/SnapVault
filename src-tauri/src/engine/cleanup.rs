use std::fs;
use std::path::Path;
use walkdir::WalkDir;
use crate::error::Result;

/// Scans the destination drive's `.snapvault/chunks/` and `.snapvault/manifests/`
/// directories for leftover `.tmp` files from aborted snapshots, cable disconnects,
/// or system power losses, and safely removes them without touching valid `.chunk`
/// or `.json` manifest files.
pub fn cleanup_orphan_tmp_files(drive_root: &Path) -> Result<u64> {
    let mut cleaned_count = 0u64;
    let snapvault_dir = drive_root.join(".snapvault");
    if !snapvault_dir.exists() {
        return Ok(0);
    }

    let target_dirs = [
        snapvault_dir.join("chunks"),
        snapvault_dir.join("manifests"),
    ];

    for dir in &target_dirs {
        if !dir.exists() {
            continue;
        }

        for entry_res in WalkDir::new(dir).follow_links(false) {
            let entry = match entry_res {
                Ok(e) => e,
                Err(_) => continue,
            };

            if !entry.file_type().is_file() {
                continue;
            }

            let file_name = entry.file_name().to_string_lossy();
            if (file_name.contains(".tmp") || file_name.ends_with(".tmp"))
                && fs::remove_file(entry.path()).is_ok()
            {
                cleaned_count += 1;
            }
        }
    }

    Ok(cleaned_count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_cleanup_orphan_tmp_files() {
        let root = tempdir().expect("tempdir failed");
        let chunks_dir = root.path().join(".snapvault").join("chunks").join("a1").join("b2");
        let manifests_dir = root.path().join(".snapvault").join("manifests");

        fs::create_dir_all(&chunks_dir).unwrap();
        fs::create_dir_all(&manifests_dir).unwrap();

        // Create valid chunks and manifests
        let valid_chunk = chunks_dir.join("a1b2c3d4.chunk");
        let valid_manifest = manifests_dir.join("1.json");
        fs::write(&valid_chunk, b"valid chunk content").unwrap();
        fs::write(&valid_manifest, b"{}").unwrap();

        // Create orphan tmp files
        let orphan_chunk_tmp = chunks_dir.join("a1b2c3d4.chunk.tmp.12345");
        let orphan_manifest_tmp = manifests_dir.join("1.json.tmp.67890");
        let generic_tmp = chunks_dir.join("corrupted.tmp");
        fs::write(&orphan_chunk_tmp, b"partial chunk").unwrap();
        fs::write(&orphan_manifest_tmp, b"partial manifest").unwrap();
        fs::write(&generic_tmp, b"temp data").unwrap();

        let cleaned = cleanup_orphan_tmp_files(root.path()).expect("cleanup failed");
        assert_eq!(cleaned, 3, "Must clean exactly 3 orphan tmp files");

        // Verify valid files remain
        assert!(valid_chunk.exists(), "Valid chunk must NOT be removed");
        assert!(valid_manifest.exists(), "Valid manifest must NOT be removed");

        // Verify orphans are gone
        assert!(!orphan_chunk_tmp.exists());
        assert!(!orphan_manifest_tmp.exists());
        assert!(!generic_tmp.exists());
    }
}
