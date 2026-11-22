use std::path::{Path, PathBuf};

/// Normalizes a path for Windows filesystem operations, handling extended-length
/// paths (`\\?\` prefix) when paths exceed MAX_PATH (260 characters) or contain
/// special characters, while leaving non-Windows platforms untouched.
pub fn to_extended_length_path(path: &Path) -> PathBuf {
    #[cfg(windows)]
    {
        let normalized = path.to_string_lossy().replace('/', "\\");

        // If already using extended-length syntax or device syntax, return as-is
        if normalized.starts_with(r"\\?\") || normalized.starts_with(r"\\.\") {
            return PathBuf::from(normalized);
        }

        // Only convert absolute paths
        if path.is_absolute() {
            // Check for UNC paths: \\server\share\... -> \\?\UNC\server\share\...
            if normalized.starts_with(r"\\") {
                let trimmed = normalized.trim_start_matches(r"\\");
                return PathBuf::from(format!(r"\\?\UNC\{}", trimmed));
            }

            // Normal drive letter path: C:\... -> \\?\C:\...
            return PathBuf::from(format!(r"\\?\{}", normalized));
        }

        // For relative paths, return normalized
        PathBuf::from(normalized)
    }

    #[cfg(not(windows))]
    {
        path.to_path_buf()
    }
}

/// Checks whether a filesystem entry is an NTFS symlink, directory junction, or reparse point.
/// SnapVault deliberately avoids following symlinks to prevent infinite directory recursion loops.
pub fn is_symlink_or_junction(path: &Path) -> bool {
    if let Ok(metadata) = std::fs::symlink_metadata(path) {
        if metadata.file_type().is_symlink() {
            return true;
        }

        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x00000400;
            if (metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT) != 0 {
                return true;
            }
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extended_path_formatting() {
        let p = Path::new(r"C:\Users\SnapVault\Documents\Project\Data.txt");
        let extended = to_extended_length_path(p);
        let s = extended.to_string_lossy();
        assert!(s.starts_with(r"\\?\C:\") || !cfg!(windows));
    }

    #[test]
    fn test_already_extended_path_not_duplicated() {
        let p = Path::new(r"\\?\C:\Data\Test.txt");
        let extended = to_extended_length_path(p);
        assert_eq!(extended, PathBuf::from(r"\\?\C:\Data\Test.txt"));
    }

    #[test]
    fn test_unicode_path_normalization() {
        // Bengali, Japanese, spaces, and emoji
        let p = Path::new(r"C:\SnapVault\বাংলা_ডকুমেন্ট\日本語_フォルダ\📸_vacation 2026\file.dat");
        let extended = to_extended_length_path(p);
        let s = extended.to_string_lossy();
        assert!(s.contains("বাংলা_ডকুমেন্ট"));
        assert!(s.contains("日本語_フォルダ"));
        assert!(s.contains("📸_vacation 2026"));
    }

    #[test]
    fn test_relative_path_untouched() {
        let p = Path::new("relative/folder/file.txt");
        let extended = to_extended_length_path(p);
        assert_eq!(extended, PathBuf::from("relative/folder/file.txt"));
    }
}
