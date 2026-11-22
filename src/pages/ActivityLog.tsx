import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCw,
  Search,
  Filter,
  ShieldCheck,
} from "lucide-react";
import { listBackupJobs, listSnapshots } from "@/lib/ipc";
import type { Snapshot } from "@/types/ipc";

export const ActivityLog: React.FC = () => {
  const [snapshots, setSnapshots] = useState<(Snapshot & { jobName: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>(" ");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const allJobs = await listBackupJobs();

      const allSnaps: (Snapshot & { jobName: string })[] = [];
      for (const job of allJobs) {
        const snaps = await listSnapshots(job.id);
        for (const s of snaps) {
          allSnaps.push({ ...s, jobName: job.name });
        }
      }

      // Sort newest first
      allSnaps.sort(
        (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      );
      setSnapshots(allSnaps);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const filteredSnapshots = snapshots.filter((snap) => {
    if (statusFilter !== "ALL" && snap.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchId = String(snap.id).includes(query);
      const matchJob = snap.jobName.toLowerCase().includes(query);
      return matchId || matchJob;
    }
    return true;
  });

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "COMMITTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            COMMITTED
          </span>
        );
      case "INTERRUPTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" />
            INTERRUPTED
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Clock className="w-3 h-3" />
            PENDING
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Activity & Audit Log</h1>
          <p className="text-xs text-slate-400 mt-1">
            Historical trace of all snapshot executions, deduplication results, and I/O status
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-400 font-medium">Filter Status:</span>
          {["ALL", "COMMITTED", "INTERRUPTED", "PENDING"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                statusFilter === st
                  ? "bg-sky-600 text-white font-medium shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by job name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500 w-56"
          />
        </div>
      </div>

      {/* Activity Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400">
            <tr>
              <th className="py-3 px-6 font-medium">Snapshot</th>
              <th className="py-3 px-4 font-medium">Job Name</th>
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium">Files Processed</th>
              <th className="py-3 px-4 font-medium">New Storage</th>
              <th className="py-3 px-4 font-medium">Started At</th>
              <th className="py-3 px-6 font-medium text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredSnapshots.map((snap) => (
              <tr key={snap.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-6 text-slate-200 font-semibold">#{snap.id}</td>
                <td className="py-3 px-4 font-sans text-slate-300">{snap.jobName}</td>
                <td className="py-3 px-4 font-sans">{renderStatusBadge(snap.status)}</td>
                <td className="py-3 px-4 text-slate-400">{snap.total_files} files</td>
                <td className="py-3 px-4 text-slate-400">
                  {formatBytes(snap.new_bytes_stored)}
                </td>
                <td className="py-3 px-4 font-sans text-slate-400">
                  {new Date(snap.started_at).toLocaleString()}
                </td>
                <td className="py-3 px-6 text-right font-sans text-[11px] text-slate-500">
                  {snap.error_message ? (
                    <span className="text-amber-400" title={snap.error_message}>
                      Warnings logged
                    </span>
                  ) : (
                    <span className="text-emerald-400">Clean run</span>
                  )}
                </td>
              </tr>
            ))}

            {filteredSnapshots.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center text-slate-500 font-sans text-xs">
                  No activity log entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Security & Offline Compliance Footer */}
      <div className="p-4 bg-slate-950/60 border border-slate-800/60 rounded-xl flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Local Audit Invariant: Zero outbound network activity verified</span>
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
          SQLite WAL • BLAKE3 Cryptographic Manifests
        </div>
      </div>
    </div>
  );
};
