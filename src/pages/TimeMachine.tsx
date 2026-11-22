import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  FileText,
  FileCode,
  Image as ImageIcon,
  ArrowUp,
  Search,
  Lock,
  Clock,
  RotateCw,
  AlertCircle,
} from "lucide-react";
import { useTimeline, type ZoomFilter } from "@/hooks/useTimeline";
import { useSnapshotTree, type EnhancedDirEntry } from "@/hooks/useSnapshotTree";
import { RestoreDrawer } from "@/components/RestoreDrawer";
import type { BackupJob } from "@/types/ipc";

interface TimeMachineProps {
  jobs: BackupJob[];
  selectedJobId?: number;
  onSelectJob: (jobId: number) => void;
}

export const TimeMachine: React.FC<TimeMachineProps> = ({
  jobs,
  selectedJobId,
  onSelectJob,
}) => {
  const currentJobId = selectedJobId || (jobs.length > 0 ? jobs[0].id : undefined);
  const currentJob = jobs.find((j) => j.id === currentJobId);

  // Timeline Hook
  const {
    filteredSnapshots,
    selectedSnapshot,
    previousSnapshot,
    selectedIndex,
    loading: timelineLoading,
    error: timelineError,
    zoomFilter,
    setZoomFilter,
    selectIndex,
    selectNext,
    selectPrevious,
    refresh: refreshTimeline,
  } = useTimeline(currentJobId);

  // Snapshot Directory Tree Hook
  const {
    currentPath,
    breadcrumbs,
    filteredEntries,
    searchFilter,
    showDeleted,
    loading: treeLoading,
    error: treeError,
    setSearchFilter,
    setShowDeleted,
    navigateToDir,
    navigateUp,
    refresh: refreshTree,
  } = useSnapshotTree(selectedSnapshot?.id, previousSnapshot?.id);

  // Restore Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inspectEntry, setInspectEntry] = useState<EnhancedDirEntry | null>(null);

  const handleInspectFile = (entry: EnhancedDirEntry) => {
    if (entry.is_dir) {
      navigateToDir(entry.relative_path);
    } else {
      setInspectEntry(entry);
      setDrawerOpen(true);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (entry: EnhancedDirEntry) => {
    if (entry.is_dir) {
      return <Folder className="w-4 h-4 text-sky-400 flex-shrink-0" />;
    }
    const ext = entry.name.split(".").pop()?.toLowerCase();
    if (["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico"].includes(ext || "")) {
      return <ImageIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    }
    if (["ts", "tsx", "js", "jsx", "rs", "json", "html", "css", "py", "sql"].includes(ext || "")) {
      return <FileCode className="w-4 h-4 text-indigo-400 flex-shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />;
  };

  const renderDiffBadge = (kind?: string) => {
    switch (kind) {
      case "ADDED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Added
          </span>
        );
      case "MODIFIED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Modified
          </span>
        );
      case "DELETED":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Deleted
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-normal text-slate-500">
            Unchanged
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Top Header & Job Bar */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-sky-400" />
            <h1 className="text-lg font-bold text-white tracking-tight">Time Machine</h1>
          </div>

          {jobs.length > 1 && (
            <select
              value={currentJobId}
              onChange={(e) => onSelectJob(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.name}
                </option>
              ))}
            </select>
          )}

          {currentJob && (
            <div className="hidden md:flex items-center space-x-1.5 text-xs text-slate-400 font-mono">
              <span className="text-slate-600">•</span>
              <span className="truncate max-w-sm">{currentJob.source_path}</span>
            </div>
          )}
        </div>

        {/* Zoom Filter Tabs & Refresh */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              refreshTimeline();
              refreshTree();
            }}
            disabled={timelineLoading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-colors"
            title="Refresh Timeline"
          >
            <RotateCw className={`w-3.5 h-3.5 ${timelineLoading ? "animate-spin" : ""}`} />
          </button>

          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {(["hours", "days", "weeks", "all"] as ZoomFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setZoomFilter(filter)}
                className={`px-3 py-1 rounded capitalize transition-colors ${
                  zoomFilter === filter
                    ? "bg-sky-600 text-white font-medium"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {timelineError && (
        <div className="px-6 py-2 bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-xs">
          {timelineError}
        </div>
      )}

      {/* Visual Timeline Scrubber Bar */}
      <div className="px-6 py-4 bg-slate-950 border-b border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={selectPrevious}
              disabled={selectedIndex <= 0}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous Snapshot [Left Arrow]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={selectNext}
              disabled={selectedIndex >= filteredSnapshots.length - 1}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next Snapshot [Right Arrow]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {selectedSnapshot ? (
              <div className="flex items-center space-x-2 text-xs">
                <span className="font-semibold text-white">
                  Snapshot #{selectedSnapshot.id}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-sky-400 font-medium">
                  {new Date(selectedSnapshot.started_at).toLocaleString()}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 font-mono">
                  {selectedSnapshot.total_files} files ({formatBytes(selectedSnapshot.total_bytes)})
                </span>
                {selectedSnapshot.is_locked_readonly && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    <Lock className="w-3 h-3" />
                    Locked GFS
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-slate-500">No committed snapshots found</span>
            )}
          </div>

          <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
            {filteredSnapshots.length > 0
              ? `${selectedIndex + 1} of ${filteredSnapshots.length} snapshots (Use [←] and [→] keys)`
              : "0 snapshots"}
          </div>
        </div>

        {/* Horizontal Timeline Track */}
        {filteredSnapshots.length > 0 && (
          <div className="relative pt-2 pb-1">
            <div className="h-1.5 w-full bg-slate-800 rounded-full relative flex items-center justify-between">
              {filteredSnapshots.map((snap, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={snap.id}
                    onClick={() => selectIndex(idx)}
                    className={`group relative -top-0.5 flex flex-col items-center focus:outline-none transition-all ${
                      isSelected ? "scale-125 z-10" : "hover:scale-110"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                        isSelected
                          ? "bg-sky-400 border-white shadow-lg shadow-sky-500/50"
                          : snap.is_locked_readonly
                          ? "bg-amber-400 border-slate-900"
                          : "bg-slate-600 border-slate-900 group-hover:bg-sky-400"
                      }`}
                    />
                    {/* Tooltip on hover */}
                    <span className="absolute -bottom-6 hidden group-hover:block whitespace-nowrap text-[10px] bg-slate-900 text-slate-200 px-2 py-0.5 rounded border border-slate-700 shadow-md">
                      {new Date(snap.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* File Explorer Pane */}
      <div className="flex-1 flex flex-col bg-slate-900/50 overflow-hidden">
        {/* Explorer Toolbar: Breadcrumbs, Search, Show Deleted Toggle */}
        <div className="px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/70">
          {/* Breadcrumbs Navigation */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-300 overflow-x-auto py-1">
            <button
              onClick={navigateUp}
              disabled={!currentPath}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-400 hover:text-white transition-colors"
              title="Go Up One Folder"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>

            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.path}>
                {idx > 0 && <span className="text-slate-600">/</span>}
                <button
                  onClick={() => navigateToDir(crumb.path)}
                  className={`px-2 py-1 rounded transition-colors ${
                    idx === breadcrumbs.length - 1
                      ? "text-sky-400 font-semibold bg-sky-500/10"
                      : "hover:bg-slate-800 text-slate-300"
                  }`}
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Search Filter & Show Deleted Toggle */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter files..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 w-44"
              />
            </div>

            <label className="flex items-center space-x-2 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="rounded bg-slate-950 border-slate-800 text-sky-500 focus:ring-0 w-3.5 h-3.5"
              />
              <span>Show Deleted</span>
            </label>
          </div>
        </div>

        {/* File Table */}
        <div className="flex-1 overflow-y-auto">
          {treeLoading && (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-500">
              <RotateCw className="w-6 h-6 animate-spin text-sky-500" />
              <p className="text-xs">Loading snapshot directory...</p>
            </div>
          )}

          {treeError && (
            <div className="p-8 text-center text-xs text-rose-400">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
              <p>Failed to load snapshot contents: {treeError}</p>
            </div>
          )}

          {!treeLoading && !treeError && (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-3 px-6 font-medium">Name</th>
                  <th className="py-3 px-4 font-medium w-28">Status</th>
                  <th className="py-3 px-4 font-medium w-28">Size</th>
                  <th className="py-3 px-4 font-medium w-44">Modified Date</th>
                  <th className="py-3 px-6 font-medium text-right w-28">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 font-mono">
                {filteredEntries.map((entry) => (
                  <tr
                    key={entry.relative_path}
                    onClick={() => handleInspectFile(entry)}
                    className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                      entry.isDeletedHistorical ? "opacity-60 bg-rose-500/5" : ""
                    }`}
                  >
                    {/* Name */}
                    <td className="py-2.5 px-6 font-sans">
                      <div className="flex items-center space-x-2.5">
                        {getFileIcon(entry)}
                        <span
                          className={`font-medium truncate max-w-md ${
                            entry.is_dir ? "text-slate-100 font-semibold" : "text-slate-300"
                          } ${entry.isDeletedHistorical ? "line-through text-rose-300/80" : ""}`}
                        >
                          {entry.name}
                        </span>
                      </div>
                    </td>

                    {/* Diff Status */}
                    <td className="py-2.5 px-4 font-sans">
                      {renderDiffBadge(entry.diffKind)}
                    </td>

                    {/* Size */}
                    <td className="py-2.5 px-4 text-slate-400">
                      {entry.is_dir ? "-" : formatBytes(entry.file_size)}
                    </td>

                    {/* Modified */}
                    <td className="py-2.5 px-4 text-slate-400 font-sans">
                      {entry.modified_at.startsWith("Deleted")
                        ? entry.modified_at
                        : new Date(entry.modified_at).toLocaleString()}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-6 text-right font-sans">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInspectFile(entry);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 text-[11px] font-medium transition-colors"
                      >
                        {entry.is_dir ? "Open" : "Inspect"}
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-500 font-sans text-xs">
                      {searchFilter
                        ? "No files matched your filter in this directory."
                        : "This directory is empty in this snapshot."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Restore & Preview Drawer */}
      {selectedSnapshot && inspectEntry && (
        <RestoreDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          snapshotId={selectedSnapshot.id}
          relPath={inspectEntry.relative_path}
          sourceRoot={currentJob?.source_path}
          isDeletedHistorical={inspectEntry.isDeletedHistorical}
        />
      )}
    </div>
  );
};
