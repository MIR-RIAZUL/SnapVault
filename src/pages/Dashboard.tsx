import React, { useState, useEffect } from "react";
import {
  HardDrive,
  Play,
  RotateCw,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  FolderOpen,
  Zap,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import {
  listBackupJobs,
  listDrives,
  listSnapshots,
  registerDrive,
  createBackupJob,
  runSnapshot,
} from "@/lib/ipc";
import type { BackupJob, Drive, Snapshot, SnapshotProgress } from "@/types/ipc";

interface DashboardProps {
  onOpenTimeMachine: (jobId: number) => void;
  onRefreshDrives?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenTimeMachine,
  onRefreshDrives,
}) => {
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Backup in-progress state
  const [backingUpJobId, setBackingUpJobId] = useState<number | null>(null);
  const [liveProgress, setLiveProgress] = useState<SnapshotProgress | null>(null);

  // Setup Wizard State (Empty State)
  const [wizardSourcePath, setWizardSourcePath] = useState<string>("");
  const [wizardDestPath, setWizardDestPath] = useState<string>("");
  const [wizardJobName, setWizardJobName] = useState<string>("Personal Files Backup");
  const [wizardRunning, setWizardRunning] = useState<boolean>(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [allJobs, allDrives] = await Promise.all([listBackupJobs(), listDrives()]);
      setJobs(allJobs);
      setDrives(allDrives);

      if (allJobs.length > 0) {
        // Fetch snapshots for primary job
        const snaps = await listSnapshots(allJobs[0].id);
        setSnapshots(snaps);
      } else {
        setSnapshots([]);
      }
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

  // Listen to Tauri snapshot-progress events
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    listen<SnapshotProgress>("snapshot-progress", (event) => {
      setLiveProgress(event.payload);
    }).then((fn) => {
      unlistenFn = fn;
    });

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  const handlePickSourceFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Source Folder to Protect",
      });
      if (selected && typeof selected === "string") {
        setWizardSourcePath(selected);
        setWizardError(null);
      }
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : String(err));
    }
  };

  const handlePickDestFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Destination USB or Storage Folder",
      });
      if (selected && typeof selected === "string") {
        setWizardDestPath(selected);
        setWizardError(null);
      }
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleFinishWizard = async () => {
    if (!wizardSourcePath || !wizardDestPath) {
      setWizardError("Both source and destination directories are required.");
      return;
    }

    setWizardRunning(true);
    setWizardError(null);
    try {
      // 1. Register destination drive
      const drive = await registerDrive({
        label: "Vault Target Volume",
        mount_path: wizardDestPath,
        role: "destination",
        filesystem: "NTFS",
      });

      // 2. Create backup job
      const job = await createBackupJob({
        name: wizardJobName.trim() || "My Backup Job",
        source_path: wizardSourcePath,
        destination_drive_id: drive.id,
        schedule_type: "interval",
        interval_minutes: 60,
      });

      // 3. Trigger initial snapshot
      setBackingUpJobId(job.id);
      await runSnapshot(job.id);

      // Refresh page data
      await loadData();
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : String(err));
    } finally {
      setWizardRunning(false);
      setBackingUpJobId(null);
      setLiveProgress(null);
    }
  };

  const handleTriggerBackup = async (jobId: number) => {
    if (backingUpJobId !== null) return;
    setBackingUpJobId(jobId);
    setLiveProgress(null);
    try {
      await runSnapshot(jobId);
      await loadData();
    } catch (err) {
      alert(`Backup failed: ${err}`);
    } finally {
      setBackingUpJobId(null);
      setLiveProgress(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Compute metrics
  const committedSnapshots = snapshots.filter((s) => s.status === "COMMITTED");
  const latestSnapshot = committedSnapshots.length > 0 ? committedSnapshots[0] : null;
  const totalDedupSavedBytes = committedSnapshots.reduce(
    (acc, s) => acc + Math.max(0, s.total_bytes - s.new_bytes_stored),
    0
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 select-none">
      {/* Page Title & Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Vault Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status of your local-first Windows 11 continuous backups
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading || backingUpJobId !== null}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-xs font-medium transition-colors disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* EMPTY STATE: 3-Step Guided Setup Wizard */}
      {jobs.length === 0 && !loading && (
        <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-3">
              <Zap className="w-3.5 h-3.5" />
              Quick Setup Wizard
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Protect your files in 3 easy steps
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              SnapVault creates immutable, content-addressed snapshots with FastCDC chunk deduplication. No cloud account required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Step 1: Source */}
            <div
              className={`p-5 rounded-xl border transition-all ${
                wizardSourcePath
                  ? "bg-slate-900 border-sky-500/40 shadow-sm"
                  : "bg-slate-950/60 border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="w-6 h-6 rounded-full bg-sky-600/30 text-sky-400 text-xs font-bold flex items-center justify-center border border-sky-500/30">
                  1
                </span>
                {wizardSourcePath && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
              <h3 className="text-sm font-semibold text-slate-200">Source Folder</h3>
              <p className="text-[11px] text-slate-400 mt-1 mb-4">
                Choose the folder or drive you want continuously backed up.
              </p>
              <button
                onClick={handlePickSourceFolder}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                <span className="truncate">
                  {wizardSourcePath ? wizardSourcePath.split("\\").pop() || wizardSourcePath : "Browse Folder..."}
                </span>
              </button>
              {wizardSourcePath && (
                <p className="text-[10px] text-slate-500 font-mono mt-2 truncate" title={wizardSourcePath}>
                  {wizardSourcePath}
                </p>
              )}
            </div>

            {/* Step 2: Destination */}
            <div
              className={`p-5 rounded-xl border transition-all ${
                wizardDestPath
                  ? "bg-slate-900 border-sky-500/40 shadow-sm"
                  : "bg-slate-950/60 border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="w-6 h-6 rounded-full bg-sky-600/30 text-sky-400 text-xs font-bold flex items-center justify-center border border-sky-500/30">
                  2
                </span>
                {wizardDestPath && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
              <h3 className="text-sm font-semibold text-slate-200">Target Storage</h3>
              <p className="text-[11px] text-slate-400 mt-1 mb-4">
                Select an external USB drive, SSD, or local folder to store chunks.
              </p>
              <button
                onClick={handlePickDestFolder}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
              >
                <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                <span className="truncate">
                  {wizardDestPath ? wizardDestPath.split("\\").pop() || wizardDestPath : "Select Target..."}
                </span>
              </button>
              {wizardDestPath && (
                <p className="text-[10px] text-slate-500 font-mono mt-2 truncate" title={wizardDestPath}>
                  {wizardDestPath}
                </p>
              )}
            </div>

            {/* Step 3: Initialize */}
            <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="w-6 h-6 rounded-full bg-sky-600/30 text-sky-400 text-xs font-bold flex items-center justify-center border border-sky-500/30">
                    3
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-200">Job Profile</h3>
                <p className="text-[11px] text-slate-400 mt-1 mb-3">
                  Name your backup job and initiate first snapshot run.
                </p>
                <input
                  type="text"
                  value={wizardJobName}
                  onChange={(e) => setWizardJobName(e.target.value)}
                  placeholder="e.g. Work Documents"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <button
                onClick={handleFinishWizard}
                disabled={!wizardSourcePath || !wizardDestPath || wizardRunning}
                className="mt-4 w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs shadow-lg shadow-sky-600/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{wizardRunning ? "Starting Initial Snapshot..." : "Start First Backup"}</span>
              </button>
            </div>
          </div>

          {wizardError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs">
              {wizardError}
            </div>
          )}
        </div>
      )}

      {/* CONFIGURED STATE: KPI Cards & Controls */}
      {jobs.length > 0 && (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* KPI 1 */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-lg space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Last Backup</span>
                <Clock className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-xl font-bold text-white tracking-tight">
                {latestSnapshot ? new Date(latestSnapshot.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "None"}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {latestSnapshot ? new Date(latestSnapshot.started_at).toLocaleDateString() : "No completed backup"}
              </p>
            </div>

            {/* KPI 2 */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-lg space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Committed Snapshots</span>
                <Layers className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-white tracking-tight">
                {committedSnapshots.length}
              </div>
              <p className="text-[11px] text-slate-400">
                Immutable GFS points-in-time
              </p>
            </div>

            {/* KPI 3 */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-lg space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Dedup Savings</span>
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-bold text-white tracking-tight">
                {formatBytes(totalDedupSavedBytes)}
              </div>
              <p className="text-[11px] text-slate-400">
                FastCDC content-addressed savings
              </p>
            </div>

            {/* KPI 4 */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-lg space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Target Health</span>
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-xl font-bold text-emerald-400 tracking-tight flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Protected</span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {drives.length > 0 ? drives[0].label : "Target Paired"}
              </p>
            </div>
          </div>

          {/* Backup Action Bar & Live Progress */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-white tracking-tight">
                    {jobs[0].name}
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    Hourly GFS
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Source: {jobs[0].source_path}
                </p>
              </div>

              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <button
                  onClick={() => onOpenTimeMachine(jobs[0].id)}
                  className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
                >
                  <Clock className="w-4 h-4 text-sky-400" />
                  <span>Open Time Machine</span>
                </button>
                <button
                  onClick={() => handleTriggerBackup(jobs[0].id)}
                  disabled={backingUpJobId !== null}
                  className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 fill-current ${backingUpJobId !== null ? "animate-spin" : ""}`} />
                  <span>{backingUpJobId !== null ? "Backing Up..." : "Back Up Now"}</span>
                </button>
              </div>
            </div>

            {/* Live Progress Bar (Active when backup is running) */}
            {backingUpJobId !== null && (
              <div className="pt-4 border-t border-slate-800 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                    <span className="text-slate-200 font-medium">
                      {liveProgress ? `Processing: ${liveProgress.current_file || "Scanning..."}` : "Initializing snapshot engine..."}
                    </span>
                  </div>
                  {liveProgress && (
                    <span className="text-slate-400 font-mono text-[11px]">
                      {liveProgress.files_processed} files ({formatBytes(liveProgress.bytes_processed)})
                    </span>
                  )}
                </div>

                <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-300 rounded-full"
                    style={{
                      width: liveProgress ? `${Math.min(100, Math.max(10, (liveProgress.files_processed % 100) + 10))}%` : "15%",
                    }}
                  />
                </div>

                {liveProgress && liveProgress.dedup_saved_bytes > 0 && (
                  <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Deduplication saved {formatBytes(liveProgress.dedup_saved_bytes)} on this run!</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent Snapshots Quick View */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-tight">
                  Recent Committed Snapshots
                </h3>
                <p className="text-xs text-slate-400">
                  Explore and restore from point-in-time snapshots
                </p>
              </div>
              <button
                onClick={() => onOpenTimeMachine(jobs[0].id)}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
              >
                <span>View Timeline</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="pb-3 font-medium">Snapshot ID</th>
                    <th className="pb-3 font-medium">Timestamp</th>
                    <th className="pb-3 font-medium">Files</th>
                    <th className="pb-3 font-medium">Storage Consumed</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {committedSnapshots.slice(0, 5).map((snap) => (
                    <tr key={snap.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 font-mono text-slate-300">#{snap.id}</td>
                      <td className="py-3 text-slate-200">
                        {new Date(snap.started_at).toLocaleString()}
                      </td>
                      <td className="py-3 text-slate-400 font-mono">{snap.total_files} files</td>
                      <td className="py-3 text-slate-400 font-mono">
                        {formatBytes(snap.new_bytes_stored)}
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {snap.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => onOpenTimeMachine(jobs[0].id)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 text-[11px] font-medium transition-colors"
                        >
                          Browse
                        </button>
                      </td>
                    </tr>
                  ))}
                  {committedSnapshots.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No snapshots committed yet. Click "Back Up Now" to take your first snapshot.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
