use std::path::Path;

pub const DEFAULT_EXCLUSION_PRESETS: &[&str] = &[
    "node_modules",
    ".git/objects",
    "*.tmp",
    "~$*",
    "Thumbs.db",
    "$RECYCLE.BIN",
    "System Volume Information",
];

pub fn get_default_exclusions() -> Vec<String> {
    DEFAULT_EXCLUSION_PRESETS
        .iter()
        .map(|s| s.to_string())
        .collect()
}

/// Determines whether a relative or absolute file path matches any exclusion pattern.
pub fn is_path_excluded(path_str: &str, exclusion_patterns: &[String]) -> bool {
    let normalized = path_str.replace('\\', "/");
    let file_name = Path::new(&normalized)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    for pattern in exclusion_patterns {
        let pat = pattern.trim().replace('\\', "/");
        if pat.is_empty() {
            continue;
        }

        // 1. Wildcard suffix (e.g. *.tmp)
        if let Some(suffix) = pat.strip_prefix('*') {
            if file_name.ends_with(suffix) || normalized.ends_with(suffix) {
                return true;
            }
        }

        // 2. Wildcard prefix (e.g. ~$*)
        if let Some(prefix) = pat.strip_suffix('*') {
            if file_name.starts_with(prefix) || normalized.starts_with(prefix) {
                return true;
            }
        }

        // 3. Exact segment match in path (e.g. node_modules, .git/objects)
        if normalized.starts_with(&pat)
            || normalized.ends_with(&pat)
            || normalized.contains(&format!("/{}/", pat))
            || normalized.starts_with(&format!("{}/", pat))
            || normalized.ends_with(&format!("/{}", pat))
        {
            return true;
        }

        // 4. Exact filename match (e.g. Thumbs.db)
        if file_name.eq_ignore_ascii_case(&pat) {
            return true;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_exclusions_match_node_modules() {
        let defaults = get_default_exclusions();
        assert!(is_path_excluded("my_app/node_modules/react/index.js", &defaults));
        assert!(is_path_excluded("node_modules/package.json", &defaults));
        assert!(!is_path_excluded("src/components/node_modules_viewer.tsx", &defaults));
    }

    #[test]
    fn test_default_exclusions_match_git_objects() {
        let defaults = get_default_exclusions();
        assert!(is_path_excluded(".git/objects/4b/825dc642cb6eb9a060e54bf8d69288fbee4904", &defaults));
        assert!(!is_path_excluded("src/.git_helpers.rs", &defaults));
    }

    #[test]
    fn test_default_exclusions_match_tmp_and_office_locks() {
        let defaults = get_default_exclusions();
        assert!(is_path_excluded("documents/scratch.tmp", &defaults));
        assert!(is_path_excluded("work/~$Quarterly_Report.docx", &defaults));
        assert!(is_path_excluded("~$Presentation.pptx", &defaults));
        assert!(!is_path_excluded("documents/important_notes.txt", &defaults));
    }

    #[test]
    fn test_default_exclusions_match_system_files() {
        let defaults = get_default_exclusions();
        assert!(is_path_excluded("Thumbs.db", &defaults));
        assert!(is_path_excluded("Photos/Thumbs.db", &defaults));
        assert!(is_path_excluded("$RECYCLE.BIN/S-1-5-21-deleted.txt", &defaults));
        assert!(is_path_excluded("System Volume Information/tracking.log", &defaults));
    }
}
