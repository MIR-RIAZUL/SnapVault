import { useState, useEffect, useCallback, useMemo } from "react";
import { browseSnapshotDir, diffSnapshotFiles } from "@/lib/ipc";
import type { DiffKind, SnapshotDirEntry, SnapshotDiffItem } from "@/types/ipc";

export interface EnhancedDirEntry extends SnapshotDirEntry {
  diffKind?: DiffKind;
  isDeletedHistorical?: boolean;
}

export interface Breadcrumb {
  label: string;
  path: string;
}

export interface UseSnapshotTreeReturn {
  currentPath: string;
  breadcrumbs: Breadcrumb[];
  entries: EnhancedDirEntry[];
  filteredEntries: EnhancedDirEntry[];
  searchFilter: string;
  showDeleted: boolean;
  loading: boolean;
  error: string | null;
  setSearchFilter: (query: string) => void;
  setShowDeleted: (show: boolean) => void;
  navigateToDir: (relPath: string) => void;
  navigateUp: () => void;
  refresh: () => Promise<void>;
}

export function useSnapshotTree(
  snapshotId?: number | null,
  previousSnapshotId?: number | null
): UseSnapshotTreeReturn {
  const [currentPath, setCurrentPath] = useState<string>("");
  const [rawEntries, setRawEntries] = useState<SnapshotDirEntry[]>([]);
  const [diffMap, setDiffMap] = useState<Map<string, SnapshotDiffItem>>(new Map());
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [showDeleted, setShowDeleted] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // When snapshot changes, reset to root or keep current path
  useEffect(() => {
    // If snapshot changes, keep currentPath but trigger refresh
  }, [snapshotId]);

  const refresh = useCallback(async () => {
    if (!snapshotId) {
      setRawEntries([]);
      setDiffMap(new Map());
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch directory entries
      const entriesPromise = browseSnapshotDir(snapshotId, currentPath);

      // 2. Fetch diff if previous snapshot exists
      const diffPromise = previousSnapshotId
        ? diffSnapshotFiles(previousSnapshotId, snapshotId)
        : Promise.resolve<SnapshotDiffItem[]>([]);

      const [entriesResult, diffResult] = await Promise.all([entriesPromise, diffPromise]);

      setRawEntries(entriesResult);

      const dMap = new Map<string, SnapshotDiffItem>();
      for (const item of diffResult) {
        dMap.set(item.relative_path, item);
      }
      setDiffMap(dMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [snapshotId, previousSnapshotId, currentPath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Compute breadcrumbs
  const breadcrumbs = useMemo<Breadcrumb[]>(() => {
    const list: Breadcrumb[] = [{ label: "Root", path: "" }];
    if (!currentPath) return list;

    const parts = currentPath.split("/").filter(Boolean);
    let cumulative = "";
    for (const part of parts) {
      cumulative = cumulative ? `${cumulative}/${part}` : part;
      list.push({ label: part, path: cumulative });
    }
    return list;
  }, [currentPath]);

  // Merge directory entries with diff status and include deleted entries if applicable
  const entries = useMemo<EnhancedDirEntry[]>(() => {
    const list: EnhancedDirEntry[] = [];
    const directRelPaths = new Set<string>();

    for (const item of rawEntries) {
      directRelPaths.add(item.relative_path);
      const diff = diffMap.get(item.relative_path);
      list.push({
        ...item,
        diffKind: diff ? diff.kind : previousSnapshotId ? "UNCHANGED" : "ADDED",
        isDeletedHistorical: false,
      });
    }

    // Add deleted items that were in previous snapshot in this same directory
    if (showDeleted && previousSnapshotId) {
      const normalizedPrefix = currentPath ? `${currentPath.trimEnd()}/` : "";
      for (const [diffPath, diffItem] of diffMap.entries()) {
        if (diffItem.kind === "DELETED") {
          // Check if it belongs in current directory
          if (
            (normalizedPrefix === "" && !diffPath.includes("/")) ||
            (normalizedPrefix !== "" &&
              diffPath.startsWith(normalizedPrefix) &&
              !diffPath.slice(normalizedPrefix.length).includes("/"))
          ) {
            if (!directRelPaths.has(diffPath)) {
              const name = diffPath.split("/").pop() || diffPath;
              list.push({
                name,
                relative_path: diffPath,
                is_dir: false,
                file_size: diffItem.old_size || 0,
                modified_at: "Deleted in this snapshot",
                file_hash: diffItem.old_hash,
                diffKind: "DELETED",
                isDeletedHistorical: true,
              });
            }
          }
        }
      }
    }

    // Sort folders first, then files
    return list.sort((a, b) => {
      if (a.is_dir === b.is_dir) {
        return a.name.localeCompare(b.name);
      }
      return a.is_dir ? -1 : 1;
    });
  }, [rawEntries, diffMap, previousSnapshotId, showDeleted, currentPath]);

  const filteredEntries = useMemo(() => {
    if (!searchFilter.trim()) return entries;
    const lower = searchFilter.toLowerCase();
    return entries.filter(
      (e) => e.name.toLowerCase().includes(lower) || e.relative_path.toLowerCase().includes(lower)
    );
  }, [entries, searchFilter]);

  const navigateToDir = (relPath: string) => {
    setCurrentPath(relPath.trim());
  };

  const navigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join("/"));
  };

  return {
    currentPath,
    breadcrumbs,
    entries,
    filteredEntries,
    searchFilter,
    showDeleted,
    loading,
    error,
    setSearchFilter,
    setShowDeleted,
    navigateToDir,
    navigateUp,
    refresh,
  };
}
