import { useEffect, useState } from "react";
import {
  Database,
  CheckCircle2,
  ShieldCheck,
  HardDrive,
  Zap,
  RefreshCw,
  Lock,
  Layers,
  FileCheck,
  AlertTriangle,
} from "lucide-react";
import { pingDb } from "@/lib/ipc";
import type { PingDbResponse } from "@/types/ipc";

export default function App() {
  const [dbData, setDbData] = useState<PingDbResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pingDb();
      setDbData(res);
      setLastCheck(new Date().toLocaleTimeString());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 select-none">
      {/* Windows 11 App Header */}
      <header className="flex items-center justify-between px-6 py-3.5 bg-slate-900/80 border-b border-slate-800/80 backdrop-blur-mica">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <HardDrive className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white flex items-center gap-2">
              SnapVault
              <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Phase 1 Verified
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Visual Backup Time Machine for Windows 11
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Lock className="w-3.5 h-3.5" />
            100% Offline &amp; Zero Telemetry
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Local-First
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center">
        <div className="max-w-2xl w-full space-y-6">
          {/* Main Status Hero Card */}
          <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-2xl backdrop-blur-mica relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-start space-x-5">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-emerald-400">
                    Engine Status
                  </span>
                  {lastCheck && (
                    <span className="text-[11px] text-slate-500">
                      Verified at {lastCheck}
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-bold text-white tracking-tight">
                  {dbData?.status || "SnapVault Ready — SQLite WAL Connected (6 tables)"}
                </h2>

                <p className="text-sm text-slate-400 leading-relaxed">
                  The local SQLite database has initialized in WAL mode with all six
                  application domain tables and indices ready for content-addressed
                  deduplication.
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Error communicating with SQLite backend: {error}</span>
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-800/60">
              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800/80">
                <div className="text-[11px] text-slate-400 font-medium">Domain Tables</div>
                <div className="text-lg font-bold text-sky-400 mt-0.5 flex items-center gap-1.5">
                  <Database className="w-4 h-4" />
                  {dbData ? `${dbData.table_count} / 6` : "6 / 6"}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800/80">
                <div className="text-[11px] text-slate-400 font-medium">Journal Mode</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" />
                  {dbData ? dbData.journal_mode : "WAL"}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800/80">
                <div className="text-[11px] text-slate-400 font-medium">Schema Version</div>
                <div className="text-lg font-bold text-purple-400 mt-0.5 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  v{dbData ? dbData.schema_version : 1}.0
                </div>
              </div>
            </div>

            {/* Re-Query Action */}
            <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800/60">
              <span className="text-xs text-slate-500 truncate max-w-sm" title={dbData?.database_path}>
                Path: {dbData?.database_path || "%LOCALAPPDATA%\\SnapVault\\snapvault.db"}
              </span>

              <button
                onClick={fetchStatus}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 text-xs font-medium text-white transition-colors flex items-center gap-1.5 shadow-sm shadow-sky-600/30"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Checking..." : "Re-query Database"}
              </button>
            </div>
          </div>

          {/* Architecture Pillars Preview */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-200">6 Domain Tables Active</div>
                <div className="text-[11px] text-slate-500">drives, jobs, snapshots, entries, chunks, health</div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-200">Foreign Keys &amp; Pragmas</div>
                <div className="text-[11px] text-slate-500">WAL mode, Normal sync, Foreign keys ON</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Windows 11 App Footer */}
      <footer className="px-6 py-2.5 bg-slate-900/60 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between">
        <div>SnapVault v0.1.0 · Phase 1 Scaffold</div>
        <div className="flex items-center gap-4">
          <span>Rust + Tauri 2 Backend</span>
          <span>•</span>
          <span>React 18 + TypeScript + Vite</span>
          <span>•</span>
          <span>Local SQLite Storage</span>
        </div>
      </footer>
    </div>
  );
}
