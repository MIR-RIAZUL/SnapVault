import React, { useEffect, useState } from "react";
import {
  X,
  FileText,
  Image as ImageIcon,
  HardDrive,
  Copy,
  FolderInput,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Hash,
  Clock,
  FileCode,
} from "lucide-react";
import { previewSnapshotFile } from "@/lib/ipc";
import { useRestore } from "@/hooks/useRestore";
import type { FilePreviewResponse } from "@/types/ipc";

interface RestoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  snapshotId: number;
  relPath: string;
  sourceRoot?: string;
  isDeletedHistorical?: boolean;
}

export const RestoreDrawer: React.FC<RestoreDrawerProps> = ({
  isOpen,
  onClose,
  snapshotId,
  relPath,
  sourceRoot,
  isDeletedHistorical = false,
}) => {
  const [preview, setPreview] = useState<FilePreviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"diff" | "snapshot" | "current">("diff");

  const {
    restoring,
    lastResult,
    error: restoreError,
    restoreToOriginal,
    restoreToCustom,
    clearStatus,
  } = useRestore(sourceRoot);

  useEffect(() => {
    if (!isOpen || !relPath) return;

    clearStatus();
    setLoading(true);
    setPreviewError(null);

    previewSnapshotFile(snapshotId, relPath, sourceRoot)
      .then((res) => {
        setPreview(res);
      })
      .catch((err) => {
        setPreviewError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, snapshotId, relPath, sourceRoot]);

  if (!isOpen) return null;

  const fileName = relPath.split("/").pop() || relPath;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const renderTextDiff = () => {
    if (!preview?.snapshot_content && !preview?.current_content) {
      return (
        <div className="p-8 text-center text-slate-400 text-sm">
          No text content available to display.
        </div>
      );
    }

    const snapLines = preview.snapshot_content ? preview.snapshot_content.split("\n") : [];
    const curLines = preview.current_content ? preview.current_content.split("\n") : [];
    const maxLines = Math.max(snapLines.length, curLines.length);

    if (activeTab === "snapshot") {
      return (
        <div className="bg-slate-950 font-mono text-xs rounded-lg border border-slate-800 p-4 overflow-auto max-h-[460px]">
          {snapLines.map((line, idx) => (
            <div key={idx} className="flex leading-relaxed hover:bg-slate-900/60">
              <span className="w-10 text-right pr-4 text-slate-600 select-none">{idx + 1}</span>
              <span className="text-slate-200 whitespace-pre">{line || " "}</span>
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === "current") {
      if (!preview.current_content) {
        return (
          <div className="p-8 text-center text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
            This file does not currently exist on disk in the original source directory (it was deleted or moved).
          </div>
        );
      }
      return (
        <div className="bg-slate-950 font-mono text-xs rounded-lg border border-slate-800 p-4 overflow-auto max-h-[460px]">
          {curLines.map((line, idx) => (
            <div key={idx} className="flex leading-relaxed hover:bg-slate-900/60">
              <span className="w-10 text-right pr-4 text-slate-600 select-none">{idx + 1}</span>
              <span className="text-slate-200 whitespace-pre">{line || " "}</span>
            </div>
          ))}
        </div>
      );
    }

    // Side-by-side diff view
    return (
      <div className="grid grid-cols-2 gap-2 bg-slate-950 font-mono text-xs rounded-lg border border-slate-800 p-3 overflow-auto max-h-[460px]">
        {/* Left Column: Snapshot Version */}
        <div className="border-r border-slate-800 pr-2">
          <div className="text-[11px] font-semibold text-sky-400 pb-2 mb-2 border-b border-slate-800 flex items-center justify-between">
            <span>Snapshot Version (Historical)</span>
            <span className="text-slate-500">{snapLines.length} lines</span>
          </div>
          {Array.from({ length: maxLines }).map((_, idx) => {
            const snapLine = snapLines[idx];
            const curLine = curLines[idx];
            const isDifferent = snapLine !== curLine;
            return (
              <div
                key={idx}
                className={`flex leading-relaxed px-1 rounded ${
                  snapLine === undefined
                    ? "opacity-20"
                    : isDifferent
                    ? "bg-amber-500/10 text-amber-200 font-medium"
                    : "text-slate-300"
                }`}
              >
                <span className="w-8 text-right pr-2 text-slate-600 select-none">
                  {snapLine !== undefined ? idx + 1 : ""}
                </span>
                <span className="whitespace-pre overflow-x-hidden text-ellipsis flex-1">
                  {snapLine ?? " "}
                </span>
              </div>
            );
          })}
        </div>

        {/* Right Column: Current Version */}
        <div className="pl-2">
          <div className="text-[11px] font-semibold text-emerald-400 pb-2 mb-2 border-b border-slate-800 flex items-center justify-between">
            <span>Current on Disk</span>
            <span className="text-slate-500">{curLines.length} lines</span>
          </div>
          {preview.current_content ? (
            Array.from({ length: maxLines }).map((_, idx) => {
              const snapLine = snapLines[idx];
              const curLine = curLines[idx];
              const isDifferent = snapLine !== curLine;
              return (
                <div
                  key={idx}
                  className={`flex leading-relaxed px-1 rounded ${
                    curLine === undefined
                      ? "opacity-20"
                      : isDifferent
                      ? "bg-emerald-500/10 text-emerald-200 font-medium"
                      : "text-slate-300"
                  }`}
                >
                  <span className="w-8 text-right pr-2 text-slate-600 select-none">
                    {curLine !== undefined ? idx + 1 : ""}
                  </span>
                  <span className="whitespace-pre overflow-x-hidden text-ellipsis flex-1">
                    {curLine ?? " "}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="p-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded">
              File not found on current disk.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderImageComparison = () => {
    return (
      <div className="grid grid-cols-2 gap-4 p-3 bg-slate-950 rounded-lg border border-slate-800">
        <div>
          <div className="text-xs font-semibold text-sky-400 mb-2 flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4" />
            Snapshot Version
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded flex items-center justify-center p-2 min-h-[220px]">
            {preview?.snapshot_data_uri ? (
              <img
                src={preview.snapshot_data_uri}
                alt="Snapshot Version"
                className="max-h-[300px] object-contain rounded"
              />
            ) : (
              <span className="text-xs text-slate-500">Image unavailable</span>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
            <HardDrive className="w-4 h-4" />
            Current on Disk
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded flex items-center justify-center p-2 min-h-[220px]">
            {preview?.current_data_uri ? (
              <img
                src={preview.current_data_uri}
                alt="Current Version"
                className="max-h-[300px] object-contain rounded"
              />
            ) : (
              <span className="text-xs text-slate-500">
                File does not exist on disk currently
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-3xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 select-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              {preview?.is_image ? (
                <ImageIcon className="w-5 h-5" />
              ) : preview?.is_text ? (
                <FileCode className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white tracking-tight">{fileName}</h2>
                {isDeletedHistorical && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Deleted in Present
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono">{relPath}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metadata Pill Bar */}
        <div className="px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-slate-500" />
            <span>Size:</span>
            <span className="text-slate-200 font-mono">
              {preview ? formatBytes(preview.file_size) : "..."}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Modified:</span>
            <span className="text-slate-200">
              {preview?.modified_at ? new Date(preview.modified_at).toLocaleString() : "..."}
            </span>
          </div>
          {preview?.file_hash && (
            <div className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-slate-500" />
              <span>BLAKE3:</span>
              <span className="text-slate-300 font-mono text-[11px] truncate max-w-[140px]" title={preview.file_hash}>
                {preview.file_hash.slice(0, 12)}...
              </span>
            </div>
          )}
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <RotateCcw className="w-6 h-6 animate-spin text-sky-500" />
              <p className="text-sm">Reassembling cryptographic chunks in memory...</p>
            </div>
          )}

          {previewError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-start gap-3 text-rose-300 text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to load preview</p>
                <p className="text-xs text-rose-400/90 mt-1">{previewError}</p>
              </div>
            </div>
          )}

          {!loading && !previewError && preview && (
            <>
              {preview.too_large && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-3 text-amber-300 text-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <span className="font-semibold">Preview size limit reached. </span>
                    Files exceeding 2 MB (text) or 10 MB (images) cannot be displayed in memory, but can be restored with full 100% integrity.
                  </div>
                </div>
              )}

              {preview.is_text && !preview.too_large && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                      <button
                        onClick={() => setActiveTab("diff")}
                        className={`px-3 py-1 rounded transition-colors ${
                          activeTab === "diff"
                            ? "bg-sky-600 text-white font-medium"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Side-by-Side Diff
                      </button>
                      <button
                        onClick={() => setActiveTab("snapshot")}
                        className={`px-3 py-1 rounded transition-colors ${
                          activeTab === "snapshot"
                            ? "bg-sky-600 text-white font-medium"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Snapshot View
                      </button>
                      <button
                        onClick={() => setActiveTab("current")}
                        className={`px-3 py-1 rounded transition-colors ${
                          activeTab === "current"
                            ? "bg-sky-600 text-white font-medium"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Current Disk View
                      </button>
                    </div>
                  </div>
                  {renderTextDiff()}
                </div>
              )}

              {preview.is_image && !preview.too_large && renderImageComparison()}

              {!preview.is_text && !preview.is_image && !preview.too_large && (
                <div className="p-8 text-center bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-medium text-slate-300">Binary File</p>
                  <p className="text-xs text-slate-500">
                    Content preview is not supported for this file type. Click below to restore.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Restore Success Toast / Notification */}
          {lastResult && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <CheckCircle2 className="w-5 h-5" />
                <span>Restoration Completed Successfully</span>
              </div>
              <p className="text-xs text-slate-300">
                Restored <span className="font-semibold">{lastResult.files_restored}</span> file(s) ({formatBytes(lastResult.bytes_restored)}).
              </p>
              {lastResult.restored_paths.length > 0 && (
                <div className="mt-2 bg-slate-950 p-2 rounded text-xs font-mono text-emerald-300 break-all border border-emerald-500/20">
                  {lastResult.restored_paths[0]}
                </div>
              )}
            </div>
          )}

          {restoreError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-3 text-rose-300 text-xs">
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <span>{restoreError}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Unplug-safe & byte-verified via BLAKE3 hash
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => restoreToOriginal(snapshotId, relPath)}
              disabled={restoring}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Copy className="w-4 h-4 text-sky-400" />
              <span>{restoring ? "Restoring..." : "Restore to Original Folder"}</span>
            </button>
            <button
              onClick={() => restoreToCustom(snapshotId, relPath)}
              disabled={restoring}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <FolderInput className="w-4 h-4 text-white" />
              <span>{restoring ? "Restoring..." : "Restore to Custom Folder..."}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
