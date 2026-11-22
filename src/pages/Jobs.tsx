import React, { useState, useEffect } from "react";
import {
  Layers,
  Play,
  ShieldCheck,
  RotateCw,
  Plus,
  Scissors,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  listBackupJobs,
  listDrives,
  createBackupJob,
  registerDrive,
  runSnapshot,
  pruneSnapshots,
} from "@/lib/ipc";
import type { BackupJob, Drive, PruneResult } from "@/types/ipc";

interface JobsProps {
  onRefreshDrives?: () => void;
}

export const Jobs: React.FC<JobsProps> = ({ onRefreshDrives }) => {
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pruning and running state
  const [runningJobId, setRunningJobId] = useState<number | null>(null);
  const [pruningJobId, setPruningJobId] = useState<number | null>(null);
  const [pruneResult, setPruneResult] = useState<PruneResult | null>(null);

  // New Job Modal state
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [newJobName, setNewJobName] = useState("");
  const [newSourcePath, setNewSourcePath] = useState("");
  const [newDestPath, setNewDestPath] = useState("");
  const [creatingJob, setCreatingJob] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [allJobs, allDrives] = await Promise.all([listBackupJobs(), listDrives()]);
      setJobs(allJobs);
      setDrives(allDrives);
      onRefreshDrives?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunJob = async (jobId: number) => {
    setRunningJobId(jobId);
    try {
      await runSnapshot(jobId);
      await loadData();
    } catch (err) {
      alert(`Run snapshot failed: ${err}`);
    } finally {
      setRunningJobId(null);
    }
  };

  const handlePruneJob = async (jobId: number) => {
    setPruningJobId(jobId);
    setPruneResult(null);
    try {
      const res = await pruneSnapshots(jobId);
      setPruneResult(res);
      await loadData();
    } catch (err) {
      alert(`Pruning failed: ${err}`);
    } finally {
      setPruningJobId(null);
    }
  };

  const handlePickSource = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Folder to Protect",
      });
      if (selected && typeof selected === "string") {
        setNewSourcePath(selected);
      }
    } catch (err) {
      alert(String(err));
    }
  };

  const handlePickDest = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Destination Storage Folder",
      });
      if (selected && typeof selected === "string") {
        setNewDestPath(selected);
      }
    } catch (err) {
      alert(String(err));
    }
  };

  const handleCreateJob = async () => {
    if (!newSourcePath || !newDestPath) {
      alert("Please select both a source directory and a destination storage directory.");
      return;
    }
    setCreatingJob(true);
    try {
      const drive = await registerDrive({
        label: "Storage Target",
        mount_path: newDestPath,
        role: "destination",
        filesystem: "NTFS",
      });

      await createBackupJob({
        name: newJobName.trim() || "Work Backup",
        source_path: newSourcePath,
        destination_drive_id: drive.id,
        schedule_type: "interval",
        interval_minutes: 60,
      });

      setShowNewJobModal(false);
      setNewJobName("");
      setNewSourcePath("");
      setNewDestPath("");
      await loadData();
    } catch (err) {
      alert(`Failed to create job: ${err}`);
    } finally {
      setCreatingJob(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 select-none">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Backup Jobs & Retention</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your protected source folders, drive pairings, and GFS retention pruner
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowNewJobModal(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Backup Job</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Pruning Feedback Banner */}
      {pruneResult && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1 text-xs animate-in fade-in">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>GFS Retention Policy Executed Successfully</span>
          </div>
          <p className="text-slate-300">
            Evaluated {pruneResult.snapshots_evaluated} snapshots • Pruned {pruneResult.snapshots_deleted} expired snapshots • Garbage-collected {pruneResult.chunks_deleted} unreferenced chunks ({formatBytes(pruneResult.bytes_reclaimed)} reclaimed).
          </p>
        </div>
      )}

      {/* Jobs List */}
      <div className="space-y-4">
        {jobs.map((job) => {
          const destDrive = drives.find((d) => d.id === job.destination_drive_id);
          return (
            <div
              key={job.id}
              className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4"
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white tracking-tight">{job.name}</h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Active
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                      Hourly GFS
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono space-y-0.5">
                    <p>Source: <span className="text-slate-200">{job.source_path}</span></p>
                    <p>
                      Target:{" "}
                      <span className="text-slate-200">
                        {destDrive ? `${destDrive.label} (${destDrive.mount_path})` : "Destination Drive"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 w-full md:w-auto">
                  <button
                    onClick={() => handlePruneJob(job.id)}
                    disabled={pruningJobId === job.id}
                    className="flex-1 md:flex-initial flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors disabled:opacity-50"
                    title="Enforce 24h hourly, 30d daily, and weekly GFS retention"
                  >
                    <Scissors className={`w-3.5 h-3.5 text-amber-400 ${pruningJobId === job.id ? "animate-spin" : ""}`} />
                    <span>{pruningJobId === job.id ? "Pruning..." : "Enforce GFS Pruner"}</span>
                  </button>

                  <button
                    onClick={() => handleRunJob(job.id)}
                    disabled={runningJobId === job.id}
                    className="flex-1 md:flex-initial flex items-center justify-center space-x-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
                  >
                    <Play className={`w-3.5 h-3.5 fill-current ${runningJobId === job.id ? "animate-spin" : ""}`} />
                    <span>{runningJobId === job.id ? "Running..." : "Back Up Now"}</span>
                  </button>
                </div>
              </div>

              {/* GFS Retention Explainer Pill */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                  <span>Retention: Hourly for 24h • Daily for 30d • Weekly thereafter</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                  <span>Locked snapshots (is_locked_readonly) are NEVER deleted.</span>
                </div>
              </div>
            </div>
          );
        })}

        {jobs.length === 0 && !loading && (
          <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
            <Layers className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No Backup Jobs Configured</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create your first backup job to pair a folder with an external drive or local directory.
            </p>
          </div>
        )}
      </div>

      {/* Add New Job Modal */}
      {showNewJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Create New Backup Job</h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure source and target folders for continuous FastCDC protection
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Job Name</label>
                <input
                  type="text"
                  value={newJobName}
                  onChange={(e) => setNewJobName(e.target.value)}
                  placeholder="e.g. Work Documents"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Source Directory</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={newSourcePath}
                    placeholder="Click browse to select folder..."
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 font-mono text-[11px]"
                  />
                  <button
                    onClick={handlePickSource}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-colors"
                  >
                    Browse...
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Target Destination Drive</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={newDestPath}
                    placeholder="Click browse to select USB or backup target folder..."
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 font-mono text-[11px]"
                  />
                  <button
                    onClick={handlePickDest}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-colors"
                  >
                    Browse...
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowNewJobModal(false)}
                className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateJob}
                disabled={creatingJob || !newSourcePath || !newDestPath}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition-all disabled:opacity-40"
              >
                {creatingJob ? "Creating..." : "Create Job"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
