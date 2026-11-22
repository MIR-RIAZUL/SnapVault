import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { restoreEntry } from "@/lib/ipc";
import type { RestoreResult } from "@/types/ipc";

export interface UseRestoreReturn {
  restoring: boolean;
  lastResult: RestoreResult | null;
  error: string | null;
  restoreToOriginal: (snapshotId: number, relPath?: string) => Promise<RestoreResult | null>;
  restoreToCustom: (snapshotId: number, relPath?: string) => Promise<RestoreResult | null>;
  clearStatus: () => void;
}

export function useRestore(defaultRestoreDir?: string): UseRestoreReturn {
  const [restoring, setRestoring] = useState(false);
  const [lastResult, setLastResult] = useState<RestoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearStatus = () => {
    setLastResult(null);
    setError(null);
  };

  const restoreToOriginal = async (
    snapshotId: number,
    relPath?: string
  ): Promise<RestoreResult | null> => {
    if (!defaultRestoreDir) {
      setError("Original source directory is not configured for this job.");
      return null;
    }
    setRestoring(true);
    setError(null);
    try {
      const result = await restoreEntry({
        snapshot_id: snapshotId,
        target_rel_path: relPath,
        restore_dir: defaultRestoreDir,
        overwrite: false, // conflict-safe non-destructive naming
      });
      setLastResult(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    } finally {
      setRestoring(false);
    }
  };

  const restoreToCustom = async (
    snapshotId: number,
    relPath?: string
  ): Promise<RestoreResult | null> => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Destination Folder for Restore",
      });

      if (!selected || typeof selected !== "string") {
        return null; // user cancelled
      }

      setRestoring(true);
      setError(null);
      const result = await restoreEntry({
        snapshot_id: snapshotId,
        target_rel_path: relPath,
        restore_dir: selected,
        overwrite: false,
      });
      setLastResult(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    } finally {
      setRestoring(false);
    }
  };

  return {
    restoring,
    lastResult,
    error,
    restoreToOriginal,
    restoreToCustom,
    clearStatus,
  };
}
