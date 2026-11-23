import React, { useState, useEffect } from "react";
import {
  Sliders,
  Cpu,
  ShieldAlert,
  Bell,
  Palette,
  Filter,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Plus,
  X,
  Save,
  KeyRound,
  ShieldCheck,
  Info,
  Sparkles,
} from "lucide-react";
import { getAppSettings, saveAppSettings, getLicenseStatus } from "@/lib/ipc";
import type { AppSettingsDto, LicenseStatusDto } from "@/types/ipc";

const DEFAULT_PATTERNS = [
  "node_modules",
  ".git/objects",
  "*.tmp",
  "~$*",
  "Thumbs.db",
  "$RECYCLE.BIN",
  "System Volume Information",
];

interface SettingsProps {
  currentTheme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light") => void;
}

export const Settings: React.FC<SettingsProps> = ({ currentTheme, onThemeChange }) => {
  const [settings, setSettings] = useState<AppSettingsDto>({
    quiet_mode: true,
    exclusion_patterns: DEFAULT_PATTERNS,
    tripwire_pct: 20,
    tripwire_min_files: 25,
    notifications_enabled: true,
    theme: currentTheme,
  });

  const [newPattern, setNewPattern] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // License State
  const [license, setLicense] = useState<LicenseStatusDto | null>(null);

  const loadLicense = () => {
    getLicenseStatus().then(setLicense).catch(() => null);
  };

  useEffect(() => {
    getAppSettings()
      .then((s) => {
        setSettings(s);
        if (s.theme === "dark" || s.theme === "light") {
          onThemeChange(s.theme);
        }
      })
      .catch((err) => setError(String(err)));
    loadLicense();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      await saveAppSettings(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddPattern = () => {
    const trimmed = newPattern.trim();
    if (!trimmed) return;
    if (!settings.exclusion_patterns.includes(trimmed)) {
      setSettings((prev) => ({
        ...prev,
        exclusion_patterns: [...prev.exclusion_patterns, trimmed],
      }));
    }
    setNewPattern("");
  };

  const handleRemovePattern = (pattern: string) => {
    setSettings((prev) => ({
      ...prev,
      exclusion_patterns: prev.exclusion_patterns.filter((p) => p !== pattern),
    }));
  };

  const handleResetPatterns = () => {
    setSettings((prev) => ({
      ...prev,
      exclusion_patterns: [...DEFAULT_PATTERNS],
    }));
  };

  const handleThemeSelect = (theme: "dark" | "light") => {
    setSettings((prev) => ({ ...prev, theme }));
    onThemeChange(theme);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-sky-400" />
            <span>Settings & Preferences</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure background backup performance, exclusion presets, and safety thresholds
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/25 transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Saving..." : "Save Preferences"}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Preferences successfully saved and applied to background worker.</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Quiet Mode Section */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-bold text-white tracking-tight">
                Quiet Mode & CPU Throttling
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Windows Priority
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Lowers background backup worker thread priority to{" "}
              <code className="text-sky-300 font-mono text-[11px]">THREAD_PRIORITY_BELOW_NORMAL</code> on
              Windows. Background FastCDC chunking and BLAKE3 hashing yield CPU cycles so gaming,
              Zoom calls, or interactive applications never stutter or drop frames.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={settings.quiet_mode}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, quiet_mode: e.target.checked }))
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
          </label>
        </div>
      </div>

      {/* 2. Exclusion Presets */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-bold text-white tracking-tight">
                Default Exclusion Patterns
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Files and directories matching these patterns will be safely skipped during backup scans.
            </p>
          </div>

          <button
            onClick={handleResetPatterns}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>

        {/* Tag Cloud */}
        <div className="flex flex-wrap gap-2 pt-1">
          {settings.exclusion_patterns.map((pat) => (
            <span
              key={pat}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300"
            >
              <span>{pat}</span>
              <button
                onClick={() => handleRemovePattern(pat)}
                className="text-slate-500 hover:text-rose-400 transition-colors"
                title={`Remove ${pat}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>

        {/* Add Pattern Form */}
        <div className="flex gap-2 pt-2">
          <input
            type="text"
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddPattern()}
            placeholder="e.g. *.cache, temp_folder, build"
            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
          />
          <button
            onClick={handleAddPattern}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Filter</span>
          </button>
        </div>
      </div>

      {/* 3. Safety Brake & Volatility Tripwire */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white tracking-tight">
              Ransomware & Volatility Safety Brake
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Protects your backup history from mass encryption or accidental directory deletion by
            locking clean snapshots before applying volatile changes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              Volatility Threshold ({settings.tripwire_pct}%)
            </label>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={settings.tripwire_pct}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, tripwire_pct: Number(e.target.value) }))
              }
              className="w-full accent-sky-500"
            />
            <p className="text-[11px] text-slate-500">
              Triggers if changed/deleted files exceed this percentage of total files.
            </p>
          </div>

          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              Minimum Affected Files ({settings.tripwire_min_files})
            </label>
            <input
              type="number"
              min="5"
              max="200"
              value={settings.tripwire_min_files}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  tripwire_min_files: Math.max(1, Number(e.target.value)),
                }))
              }
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
            />
            <p className="text-[11px] text-slate-500">
              Prevents false positives on small folders with fewer total files.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Windows Notifications */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold text-white tracking-tight">
              Windows Toast Notifications
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Show native Windows 11 toast notifications for completed backups and safety alerts.
          </p>
        </div>

        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={settings.notifications_enabled}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, notifications_enabled: e.target.checked }))
            }
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
        </label>
      </div>

      {/* 5. Theme Settings */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-bold text-white tracking-tight">Appearance Theme</h2>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleThemeSelect("dark")}
            className={`px-4 py-2 rounded-xl border text-xs font-medium transition-all ${
              settings.theme === "dark"
                ? "bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/25"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
            }`}
          >
            Dark (Windows Mica)
          </button>
          <button
            onClick={() => handleThemeSelect("light")}
            className={`px-4 py-2 rounded-xl border text-xs font-medium transition-all ${
              settings.theme === "light"
                ? "bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/25"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
            }`}
          >
            Light Fluent
          </button>
        </div>
      </div>

      {/* 6. License & Edition */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-bold text-white tracking-tight">
                Edition & Licensing
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Free & 100% Offline Edition — No Subscriptions, No Limits.
            </p>
          </div>

          <span className="px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{license?.is_licensed ? "Free Edition Active" : "Offline Active"}</span>
          </span>
        </div>

        {/* Permanent Restore Guarantee Callout */}
        <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 flex items-start gap-3 text-xs">
          <ShieldCheck className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-slate-200">
              Permanent Restore Guarantee (Zero Hostage Policy)
            </p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Your ability to browse file histories on the Time Machine timeline and restore any
              file or folder is 100% free and unlocked forever with zero limitations.
            </p>
          </div>
        </div>
      </div>

      {/* 7. About & Zero-Telemetry Privacy */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold text-white tracking-tight">About SnapVault</h2>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            v1.0.0 (Production Release)
          </span>
        </div>

        <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>100% Offline — Zero Telemetry, Zero Cloud Lock-In Guarantee</span>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            SnapVault is engineered to be 100% private. It connects to zero cloud services, transmits
            zero telemetry, uses zero third-party analytics trackers, and requires no internet
            connection. All file indexing, BLAKE3 cryptographic hashing, FastCDC deduplication, and
            SQLite databases remain exclusively on your local PC and your personal USB drives.
          </p>
        </div>

        <div className="text-[11px] text-slate-500 space-y-1 pt-1">
          <p className="font-semibold text-slate-400">Core Technologies & Open-Source Attributions:</p>
          <p>
            Tauri 2 (Rust Desktop Shell) • FastCDC (Content-Defined Chunking) • BLAKE3 (Cryptographic Hashing) •
            Rusqlite (Local WAL SQLite) • React 18 & TypeScript & Tailwind CSS • Lucide Icons
          </p>
          <p className="pt-1">© 2026 SnapVault. Designed for Windows 11.</p>
        </div>
      </div>
    </div>
  );
};
