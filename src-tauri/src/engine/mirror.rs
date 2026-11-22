use std::collections::HashSet;
use std::fs::{self, File};
use std::path::Path;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{Result, SnapVaultError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MirrorSyncResult {
    pub files_copied: u64,
    pub files_removed: u64,
    pub bytes_copied: u64,
    pub mirror_path: String,
}

/// Synchronizes a plain, uncompressed, unchunked directory tree directly to the target drive
/// at `<drive_root>/SnapVault_Latest_Readable/` using atomic writes (`.tmp` -> `sync_all` -> `rename`).
/// Allows users to open, copy, or browse their latest files directly in Windows Explorer without SnapVault.
pub fn sync_plain_file_mirror(
    dest_drive_root: &Path,
    source_root: &Path,
    file_rel_paths: &[String],
) -> Result<MirrorSyncResult> {
    let mirror_dir = dest_drive_root.join("SnapVault_Latest_Readable");
    fs::create_dir_all(&mirror_dir).map_err(SnapVaultError::Io)?;

    let mut active_mirror_files = HashSet::new();
    let mut files_copied = 0u64;
    let mut bytes_copied = 0u64;

    for rel in file_rel_paths {
        let normalized = rel.replace('/', "\\");
        let src_file = source_root.join(&normalized);
        let dst_file = mirror_dir.join(&normalized);

        active_mirror_files.insert(dst_file.clone());

        if !src_file.exists() || !src_file.is_file() {
            continue;
        }

        let src_meta = fs::metadata(&src_file).map_err(SnapVaultError::Io)?;
        let src_len = src_meta.len();

        let need_copy = if dst_file.exists() {
            if let Ok(dst_meta) = fs::metadata(&dst_file) {
                dst_meta.len() != src_len
            } else {
                true
            }
        } else {
            true
        };

        if need_copy {
            if let Some(parent) = dst_file.parent() {
                fs::create_dir_all(parent).map_err(SnapVaultError::Io)?;
            }

            // Atomic copy pattern
            let tmp_name = format!(
                "{}.tmp.{}",
                dst_file.file_name().unwrap_or_default().to_string_lossy(),
                Uuid::new_v4()
            );
            let tmp_path = dst_file.with_file_name(tmp_name);

            {
                let mut reader = File::open(&src_file).map_err(SnapVaultError::Io)?;
                let mut writer = File::create(&tmp_path).map_err(SnapVaultError::Io)?;
                std::io::copy(&mut reader, &mut writer).map_err(SnapVaultError::Io)?;
                writer.sync_all().map_err(SnapVaultError::Io)?;
            }

            fs::rename(&tmp_path, &dst_file).map_err(SnapVaultError::Io)?;
            files_copied += 1;
            bytes_copied += src_len;
        }
    }

    // Clean deleted files in mirror_dir that are no longer part of current snapshot
    let mut files_removed = 0u64;
    for entry in walkdir::WalkDir::new(&mirror_dir)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            let path = entry.path().to_path_buf();
            // Do not delete internal temporary files
            if path.file_name().unwrap_or_default().to_string_lossy().contains(".tmp.") {
                continue;
            }
            if !active_mirror_files.contains(&path) {
                let _ = fs::remove_file(&path);
                files_removed += 1;
            }
        }
    }

    Ok(MirrorSyncResult {
        files_copied,
        files_removed,
        bytes_copied,
        mirror_path: mirror_dir.to_string_lossy().to_string(),
    })
}
