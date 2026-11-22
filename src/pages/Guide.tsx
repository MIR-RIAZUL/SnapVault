import React, { useState, useMemo } from "react";
import {
  BookOpen,
  Search,
  X,
  Clock,
  ShieldCheck,
  Zap,
  HardDrive,
  AlertTriangle,
  Play,
  RotateCw,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Sliders,
  CheckCircle2,
  Lock,
  Layers,
  KeyRound,
  Eye,
  Cpu,
  HelpCircle,
} from "lucide-react";
import type { NavTab } from "@/components/Sidebar";

interface GuideProps {
  onNavigateTab?: (tab: NavTab) => void;
}

interface AccordionSection {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  badge: string;
  content: React.ReactNode;
}

export const Guide: React.FC<GuideProps> = ({ onNavigateTab }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    quickstart: true,
    restore: true,
    guardrails: true,
    bestpractices: false,
    licensing: false,
    faq: false,
  });

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    setExpandedSections({
      quickstart: true,
      restore: true,
      guardrails: true,
      bestpractices: true,
      licensing: true,
      faq: true,
    });
  };

  const collapseAll = () => {
    setExpandedSections({
      quickstart: false,
      restore: false,
      guardrails: false,
      bestpractices: false,
      licensing: false,
      faq: false,
    });
  };

  const categories = [
    { id: "all", label: "All Topics" },
    { id: "quickstart", label: "Quick Start" },
    { id: "restore", label: "Time Machine" },
    { id: "guardrails", label: "Safety Guardrails" },
    { id: "bestpractices", label: "Best Practices" },
    { id: "licensing", label: "Privacy & Guarantee" },
    { id: "faq", label: "Troubleshooting FAQ" },
  ];

  const sections: AccordionSection[] = useMemo(
    () => [
      {
        id: "quickstart",
        category: "quickstart",
        title: "1. Quick Start: Your First 2 Minutes",
        subtitle: "How to set up continuous, automated file protection without cloud accounts",
        icon: Play,
        badge: "Basics",
        content: (
          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <p>
              SnapVault is designed to protect your valuable work with zero configuration headache.
              Unlike cloud services that require slow internet uploads or enterprise tools that create
              monolithic disk images, SnapVault creates lightweight, point-in-time snapshots to your own drives.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 text-[11px] flex items-center justify-center font-mono border border-sky-500/30">
                    1
                  </span>
                  <span>Select Important Folders</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Pick the local folders you cannot afford to lose (e.g. <code className="text-sky-300">C:\Users\You\Documents</code>,
                  creative project drives, or code workspaces). SnapVault safely handles long paths, Unicode names, and subfolder trees.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 text-[11px] flex items-center justify-center font-mono border border-sky-500/30">
                    2
                  </span>
                  <span>Connect Your Target Storage</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Connect an external USB-C SSD, desktop hard drive, or select a mapped home NAS share. SnapVault
                  stores content-addressed chunk files in a clean, self-contained <code className="text-sky-300">.snapvault</code> folder.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 text-[11px] flex items-center justify-center font-mono border border-sky-500/30">
                    3
                  </span>
                  <span>Trigger Initial Snapshot</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Click <strong className="text-slate-200">Start First Backup</strong>. The FastCDC engine breaks files into 4KB–64KB chunks,
                  hashes them with BLAKE3, and stores new chunks. Identical data across files is deduplicated immediately.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 text-[11px] flex items-center justify-center font-mono border border-sky-500/30">
                    4
                  </span>
                  <span>Runs Silently in Background</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  SnapVault sits in your Windows 11 System Tray (near the clock). It performs hourly incremental snapshots
                  automatically, automatically throttling CPU usage so your gaming, video editing, and calls never drop a frame.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-sky-950/30 border border-sky-800/40 text-sky-200 flex items-start gap-3">
              <Zap className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Pro-Tip:</strong> You never have to worry about running out of space.
                SnapVault's content deduplication means that backing up a 100 GB folder 50 times only takes ~102 GB of actual disk space.
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "restore",
        category: "restore",
        title: "2. How to Restore Files with Visual Time Machine",
        subtitle: "Scrubbing through history, side-by-side diff previews, and conflict-safe recovery",
        icon: Clock,
        badge: "Recovery",
        content: (
          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <p>
              When a file is accidentally overwritten, deleted, or corrupted, the <strong className="text-white">Time Machine</strong> tab
              gives you an intuitive, visual way to travel back to any exact point in history.
            </p>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" />
                  <span>Timeline Scrubber & Granularity Zoom</span>
                </h4>
                <p className="text-slate-400 text-[11px]">
                  Use the timeline slider at the top of the Time Machine screen to glide across past snapshots.
                  Switch the zoom view between:
                </p>
                <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-sky-300">Hours: Detailed 24h view</span>
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-sky-300">Days: Past 30 days</span>
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-sky-300">Weeks: 12-week overview</span>
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-sky-300">All: Complete vault history</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  <strong className="text-slate-200">Keyboard Shortcuts:</strong> Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-white font-mono text-[10px]">Left Arrow</kbd> to jump to the previous snapshot, or <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-white font-mono text-[10px]">Right Arrow</kbd> to advance toward the present.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>Reading Change Pills & Deleted File Recovery</span>
                </h4>
                <p className="text-slate-400 text-[11px]">
                  Every file entry in Time Machine shows its exact status compared to the previous snapshot:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-[11px] text-center">
                    + Added (New)
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-[11px] text-center">
                    ~ Modified (Edited)
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 font-mono text-[11px] text-center">
                    - Deleted (Erased)
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 font-mono text-[11px] text-center">
                    = Unchanged
                  </div>
                </div>
                <p className="text-slate-400 text-[11px] pt-1">
                  Check <strong className="text-slate-200">Show Deleted Files</strong> to reveal files that were accidentally deleted in the present, so you can restore them with one click.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-sky-400" />
                  <span>Side-by-Side Diff & Image Compare</span>
                </h4>
                <p className="text-slate-400 text-[11px]">
                  Click on any text, code, or image file to inspect its content:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                  <li><strong className="text-slate-200">Text & Code Files:</strong> Shows the historical snapshot text on the left and the current on-disk file on the right, allowing you to copy specific code snippets or verify lines before restoring.</li>
                  <li><strong className="text-slate-200">Images (PNG, JPG, WebP):</strong> Renders visual image previews side-by-side to compare photo edits or graphic versions.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <RotateCw className="w-4 h-4 text-sky-400" />
                  <span>Two Safe Restore Modes</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="font-semibold text-emerald-400">Restore Copy (Non-Destructive)</span>
                    <p className="text-[11px] text-slate-400">
                      Creates a conflict-safe sibling file named <code className="text-slate-300">filename (Restored from YYYY-MM-DD).ext</code> so you never accidentally overwrite existing work.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="font-semibold text-sky-400">Restore to Custom Folder</span>
                    <p className="text-[11px] text-slate-400">
                      Prompts you to select any destination folder on your PC to export single files or entire directory trees cleanly.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "guardrails",
        category: "guardrails",
        title: "3. Your 4 Built-In Safety Guardrails",
        subtitle: "How SnapVault protects you against silent bit-rot, cable unplugs, ransomware, and vendor lock-in",
        icon: ShieldCheck,
        badge: "Critical",
        content: (
          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <p>
              Most backup software fails when you need it most. SnapVault includes 4 active, architectural guardrails
              engineered to prevent data loss even in worst-case scenarios.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Guardrail 1 */}
              <div className="p-5 rounded-xl bg-slate-950/60 border border-emerald-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-emerald-400">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span>Proof-of-Restore</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Verified Restorable
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  <strong className="text-slate-200">The Problem:</strong> Backups that report "Success" while files are silently corrupted by disk bit-rot.
                </p>
                <p className="text-[11px] text-slate-400">
                  <strong className="text-slate-200">How SnapVault Protects You:</strong> SnapVault automatically executes background cryptographic drills.
                  It randomly samples files from your latest backup, reconstructs them in memory, and recalculates their BLAKE3 hashes against the original database.
                  Click <strong className="text-slate-200">Verify Now</strong> on the Dashboard anytime to run an on-demand check.
                </p>
              </div>

              {/* Guardrail 2 */}
              <div className="p-5 rounded-xl bg-slate-950/60 border border-sky-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sky-400">
                    <HardDrive className="w-5 h-5 text-sky-400" />
                    <span>Unplug-Safe Atomic Engine</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    Zero Corruption
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  <strong className="text-slate-200">The Problem:</strong> Pulling a USB drive or losing battery power mid-backup corrupts the entire backup catalog.
                </p>
                <p className="text-[11px] text-slate-400">
                  <strong className="text-slate-200">How SnapVault Protects You:</strong> SnapVault uses SQLite Write-Ahead Logging (WAL) and atomic chunk writes.
                  Every chunk is written to a temporary file, flushed with <code className="text-slate-300">sync_all()</code>, and renamed atomically.
                  Pulling the USB drive mid-backup leaves prior history 100% valid; SnapVault marks the interrupted run cleanly and resumes seamlessly on reconnect.
                </p>
              </div>

              {/* Guardrail 3 */}
              <div className="p-5 rounded-xl bg-slate-950/60 border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-amber-400">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <span>Ransomware Tripwire</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Safety Brake
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  <strong className="text-slate-200">The Problem:</strong> Malware encrypts your drive and your backup software faithfully backs up the encrypted junk, overwriting good backups.
                </p>
                <p className="text-[11px] text-slate-400">
                  <strong className="text-slate-200">How SnapVault Protects You:</strong> If more than 20% and 25+ files change or delete in a single cycle,
                  SnapVault immediately triggers the Safety Brake: backups halt, your last known-good snapshot is locked read-only, and an amber alert triggers.
                  If the change was legitimate (e.g. you deleted a big project folder), simply click "Unlock Tripwire" to continue.
                </p>
              </div>

              {/* Guardrail 4 */}
              <div className="p-5 rounded-xl bg-slate-950/60 border border-indigo-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-indigo-400">
                    <FolderOpen className="w-5 h-5 text-indigo-400" />
                    <span>Emergency Plain-File Mirror</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Zero-Software Restore
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  <strong className="text-slate-200">The Problem:</strong> Your PC dies, you're at a friend's PC without SnapVault installed, and your files are trapped in a proprietary database.
                </p>
                <p className="text-[11px] text-slate-400">
                  <strong className="text-slate-200">How SnapVault Protects You:</strong> On your backup drive, SnapVault can maintain an uncompressed, direct mirror folder named
                  <code className="text-indigo-300">SnapVault_Latest_Readable/</code>. You can plug the drive into ANY Windows, Mac, or Linux computer and open your latest documents directly in standard File Explorer.
                </p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "bestpractices",
        category: "bestpractices",
        title: "4. Best Practices for Bulletproof Backups",
        subtitle: "Multi-drive rotation, Quiet Mode CPU throttling, exclusion patterns, and GFS retention",
        icon: Sliders,
        badge: "Pro Tips",
        content: (
          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-sky-400" />
                  <span>The 3-2-1 Rule: Multi-Drive Rotation</span>
                </h4>
                <p className="text-slate-400 text-[11px]">
                  Professional backup strategy recommends having 3 copies of data across 2 different physical media, with 1 stored offsite.
                  SnapVault supports Multi-Drive Rotation automatically:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                  <li>Pair <strong className="text-slate-200">Drive A (Desktop SSD)</strong> for everyday fast backups on your desk.</li>
                  <li>Pair <strong className="text-slate-200">Drive B (Portable Drive or NAS)</strong> that stays in your travel bag or offsite.</li>
                  <li>SnapVault detects each drive's unique hardware UUID. Whenever either drive is plugged in, SnapVault updates that specific drive with incremental changes.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-sky-400" />
                  <span>Quiet Mode CPU Throttling</span>
                </h4>
                <p className="text-slate-400 text-[11px]">
                  Enabled by default in <strong className="text-slate-200">Settings</strong>, Quiet Mode sets SnapVault's worker threads to
                  Windows <code className="text-sky-300">THREAD_PRIORITY_BELOW_NORMAL</code>.
                  This ensures that heavy background backups yield CPU cycles immediately when you launch games, 4K rendering tools, or join Microsoft Teams / Zoom video calls.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-sky-400" />
                  <span>Custom Exclusion Patterns</span>
                </h4>
                <p className="text-slate-400 text-[11px]">
                  SnapVault already comes with smart exclusion presets that prevent wasting storage on temporary or lock files:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1 font-mono text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">node_modules</span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">.git/objects</span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">*.tmp</span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">~$* (Office locks)</span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">Thumbs.db</span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">$RECYCLE.BIN</span>
                </div>
                <p className="text-slate-400 text-[11px] pt-1">
                  You can add custom directory names (e.g. <code className="text-slate-300">Cache</code>) or file extensions (e.g. <code className="text-slate-300">*.iso</code>) directly in Settings.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>Grandfather-Father-Son (GFS) Space Pruning</span>
                </h4>
                <p className="text-slate-400 text-[11px]">
                  SnapVault prevents disk exhaustion through automatic Grandfather-Father-Son retention:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <strong className="text-sky-300 block">Son (Hourly)</strong>
                    <span className="text-slate-400">Keeps 24 hourly snapshots for the last 24 hours.</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <strong className="text-sky-300 block">Father (Daily)</strong>
                    <span className="text-slate-400">Keeps 30 daily snapshots for the past 30 days.</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <strong className="text-sky-300 block">Grandfather (Weekly)</strong>
                    <span className="text-slate-400">Keeps weekly snapshots permanently for long-term archives.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "licensing",
        category: "licensing",
        title: "5. Privacy, 14-Day Trial & Permanent Restore Guarantee",
        subtitle: "100% offline security, zero subscriptions, and our guarantee that your data is never held hostage",
        icon: KeyRound,
        badge: "Guarantee",
        content: (
          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-400 text-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>The Permanent Restore Guarantee (Zero Hostage Guarantee)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Most cloud or subscription backup utilities lock you out of your files if your subscription lapses.
                <strong className="text-white"> SnapVault will NEVER lock you out of your data.</strong>
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                If your 14-day free trial expires without purchasing a license, only creating <em>new</em> snapshots is paused.
                Visual Time Machine browsing, file previews, side-by-side diff comparisons, and file restores remain
                <strong className="text-emerald-300"> 100% UNLOCKED AND FREE FOREVER</strong> on your computer.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-sky-400" />
                  <span>100% Offline & Zero Telemetry</span>
                </h4>
                <p className="text-slate-400 text-[11px]">
                  SnapVault contains zero tracking pixels, zero Google Analytics, zero Sentry reports, and zero outbound network calls.
                  It works completely air-gapped without an internet connection.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sky-400" />
                  <span>$19.99 One-Time Purchase</span>
                </h4>
                <p className="text-slate-400 text-[11px]">
                  No monthly bills. A single $19.99 one-time purchase from the Microsoft Store unlocks lifetime continuous
                  snapshots across all your backup drives.
                </p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "faq",
        category: "faq",
        title: "6. Quick Troubleshooting FAQ",
        subtitle: "Answers to common questions about locked files, disconnected drives, and disk health",
        icon: HelpCircle,
        badge: "FAQ",
        content: (
          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <span className="text-sky-400 font-mono">Q:</span>
                <span>Why was a file skipped with an "In-Use / Locked File" notice?</span>
              </h4>
              <p className="text-slate-400 text-[11px]">
                When files are actively being written to by other applications (e.g., an active Microsoft Excel spreadsheet, SQLite database, or open Outlook <code className="text-slate-300">.pst</code> archive),
                Windows enforces an exclusive sharing lock. To avoid hanging your computer, SnapVault retries after 500ms; if still locked, it skips gracefully without failing the rest of the backup.
                As soon as you save and close the file, SnapVault captures it on the next hourly interval.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <span className="text-sky-400 font-mono">Q:</span>
                <span>What does the amber "Drive Disconnected" status mean?</span>
              </h4>
              <p className="text-slate-400 text-[11px]">
                Your external backup drive or NAS was unplugged or unmounted. You don't need to do anything special—simply plug your drive back into any USB port.
                SnapVault's background watcher detects drive arrival events in real-time and resumes your backups automatically.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <span className="text-sky-400 font-mono">Q:</span>
                <span>What should I do if Proof-of-Restore reports a corrupted chunk?</span>
              </h4>
              <p className="text-slate-400 text-[11px]">
                If a Proof-of-Restore health check fails, it means one of the chunk files on your backup drive failed its BLAKE3 checksum.
                This is typically an early warning of physical hardware degradation (aging drive sectors or bit-rot).
                SnapVault marks the corrupted chunk so it won't restore invalid data. We recommend running Windows disk check (<code className="text-slate-300">chkdsk /f</code>) on the drive or copying your files to a fresh drive.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <span className="text-sky-400 font-mono">Q:</span>
                <span>Can I restore files onto a different computer or after a Windows reinstall?</span>
              </h4>
              <p className="text-slate-400 text-[11px]">
                Yes! Your backup drive is completely self-contained. Plug the drive into any Windows PC, install SnapVault, and pair the drive—all snapshot history and files are preserved in the drive's local database.
                Or, if you enabled the <strong className="text-slate-200">Emergency Plain-File Mirror</strong>, you can open the <code className="text-sky-300">SnapVault_Latest_Readable</code> folder in standard Windows File Explorer without installing SnapVault at all.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <span className="text-sky-400 font-mono">Q:</span>
                <span>How do I manually trigger a backup right now?</span>
              </h4>
              <p className="text-slate-400 text-[11px]">
                Click <strong className="text-slate-200">Back Up Now</strong> on the Vault Dashboard, or right-click the SnapVault tray icon near the Windows taskbar clock and select <strong className="text-slate-200">Backup Now</strong>.
              </p>
            </div>
          </div>
        ),
      },
    ],
    []
  );

  // Filter sections by search query and category
  const filteredSections = useMemo(() => {
    return sections.filter((sec) => {
      const matchesCategory = activeCategory === "all" || sec.category === activeCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const titleMatch = sec.title.toLowerCase().includes(q);
      const subMatch = sec.subtitle.toLowerCase().includes(q);
      const categoryMatch = sec.category.toLowerCase().includes(q);

      return titleMatch || subMatch || categoryMatch;
    });
  }, [sections, activeCategory, searchQuery]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 select-none">
      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-2">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Official User Manual · 100% Offline Guide</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">How to Use Me Properly</h1>
          <p className="text-xs text-slate-400 mt-1">
            Master SnapVault v1.0 in minutes. Visual backups, instant Time Machine recovery, and safety guardrails explained simply.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md space-y-2">
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Clock className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-white">Instant Time Machine</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Scrub through time with arrow keys, compare text/image diffs side-by-side, and restore in 2 clicks.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md space-y-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-white">4 Safety Guardrails</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Proof-of-Restore verification, unplug-safe commits, ransomware tripwire, and emergency plain mirror.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md space-y-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Zap className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-white">FastCDC Deduplication</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Content-addressed 4KB–64KB chunking + BLAKE3 slashes storage consumption up to 70%.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md space-y-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Lock className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-white">100% Offline & Free Restore</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Zero cloud lock-in, zero telemetry. Past snapshots and restore operations remain free forever.
          </p>
        </div>
      </div>

      {/* Instant Search Bar & Filter Pills */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search topics (e.g. USB, ransomware, restore, timeline, tripwire, mirror, trial, locked files)..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeCategory === c.id
                  ? "bg-sky-600 text-white shadow-sm"
                  : "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accordion Sections */}
      <div className="space-y-4">
        {filteredSections.map((sec) => {
          const Icon = sec.icon;
          const isExpanded = expandedSections[sec.id] || searchQuery.length > 0;

          return (
            <div
              key={sec.id}
              className="rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl overflow-hidden transition-all"
            >
              <button
                onClick={() => toggleSection(sec.id)}
                className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 flex-shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white tracking-tight">{sec.title}</h2>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-sky-300 border border-slate-700">
                        {sec.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{sec.subtitle}</p>
                  </div>
                </div>

                <div className="text-slate-400 ml-4 flex-shrink-0">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 pt-1 border-t border-slate-800/60 animate-in fade-in duration-200">
                  {sec.content}
                </div>
              )}
            </div>
          );
        })}

        {filteredSections.length === 0 && (
          <div className="p-12 text-center rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-3">
            <HelpCircle className="w-8 h-8 text-slate-500 mx-auto" />
            <h3 className="text-sm font-semibold text-white">No topics match your search</h3>
            <p className="text-xs text-slate-400">
              Try searching for terms like "restore", "USB", "ransomware", "tripwire", "mirror", or "quiet mode".
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("all");
              }}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-medium border border-slate-700 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Quick Navigation Footer */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-sky-950/40 via-slate-900 to-slate-950 border border-sky-800/30 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <h4 className="text-sm font-bold text-white">Ready to test what you learned?</h4>
          <p className="text-xs text-slate-400">
            Jump directly into the Visual Time Machine or fine-tune your exclusions in Settings.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab("timemachine")}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition-all"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Open Time Machine</span>
            </button>
          )}
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab("settings")}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span>Settings</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
