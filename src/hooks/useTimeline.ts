import { useState, useEffect, useCallback, useMemo } from "react";
import { listSnapshots } from "@/lib/ipc";
import type { Snapshot } from "@/types/ipc";

export type ZoomFilter = "hours" | "days" | "weeks" | "all";

export interface UseTimelineReturn {
  snapshots: Snapshot[];
  filteredSnapshots: Snapshot[];
  selectedSnapshot: Snapshot | null;
  previousSnapshot: Snapshot | null;
  selectedIndex: number;
  loading: boolean;
  error: string | null;
  zoomFilter: ZoomFilter;
  setZoomFilter: (zoom: ZoomFilter) => void;
  selectSnapshot: (snap: Snapshot) => void;
  selectIndex: (index: number) => void;
  selectNext: () => void;
  selectPrevious: () => void;
  refresh: () => Promise<void>;
}

export function useTimeline(jobId?: number): UseTimelineReturn {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [zoomFilter, setZoomFilter] = useState<ZoomFilter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!jobId) {
      setSnapshots([]);
      setSelectedId(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const all = await listSnapshots(jobId);
      // Filter only COMMITTED snapshots and sort chronologically (oldest to newest)
      const committed = all
        .filter((s) => s.status === "COMMITTED")
        .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());

      setSnapshots(committed);
      if (committed.length > 0) {
        // Select newest snapshot by default if none selected or if selected snapshot is missing
        setSelectedId((prev) => {
          if (prev && committed.some((s) => s.id === prev)) {
            return prev;
          }
          return committed[committed.length - 1].id;
        });
      } else {
        setSelectedId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredSnapshots = useMemo(() => {
    if (snapshots.length === 0) return [];
    if (zoomFilter === "all") return snapshots;

    const now = Date.now();
    const cutoffHours = zoomFilter === "hours" ? 24 : zoomFilter === "days" ? 24 * 7 : 24 * 30;
    const cutoffTime = now - cutoffHours * 60 * 60 * 1000;

    const filtered = snapshots.filter((s) => new Date(s.started_at).getTime() >= cutoffTime);
    // If filter returns empty (e.g. all snapshots older than filter), fallback to returning all
    return filtered.length > 0 ? filtered : snapshots;
  }, [snapshots, zoomFilter]);

  const selectedIndex = useMemo(() => {
    if (!selectedId || filteredSnapshots.length === 0) return -1;
    return filteredSnapshots.findIndex((s) => s.id === selectedId);
  }, [filteredSnapshots, selectedId]);

  const selectedSnapshot = useMemo(() => {
    if (selectedIndex >= 0 && selectedIndex < filteredSnapshots.length) {
      return filteredSnapshots[selectedIndex];
    }
    if (filteredSnapshots.length > 0) {
      return filteredSnapshots[filteredSnapshots.length - 1];
    }
    return null;
  }, [filteredSnapshots, selectedIndex]);

  const previousSnapshot = useMemo(() => {
    if (selectedIndex > 0) {
      return filteredSnapshots[selectedIndex - 1];
    }
    return null;
  }, [filteredSnapshots, selectedIndex]);

  const selectSnapshot = useCallback((snap: Snapshot) => {
    setSelectedId(snap.id);
  }, []);

  const selectIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < filteredSnapshots.length) {
        setSelectedId(filteredSnapshots[index].id);
      }
    },
    [filteredSnapshots]
  );

  const selectNext = useCallback(() => {
    if (selectedIndex < filteredSnapshots.length - 1) {
      selectIndex(selectedIndex + 1);
    }
  }, [selectedIndex, filteredSnapshots.length, selectIndex]);

  const selectPrevious = useCallback(() => {
    if (selectedIndex > 0) {
      selectIndex(selectedIndex - 1);
    }
  }, [selectedIndex, selectIndex]);

  // Keyboard navigation listener (Arrow Left and Right)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        selectPrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        selectNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectPrevious, selectNext]);

  return {
    snapshots,
    filteredSnapshots,
    selectedSnapshot,
    previousSnapshot,
    selectedIndex,
    loading,
    error,
    zoomFilter,
    setZoomFilter,
    selectSnapshot,
    selectIndex,
    selectNext,
    selectPrevious,
    refresh,
  };
}
