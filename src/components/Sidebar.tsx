import React from "react";
import {
  LayoutDashboard,
  Clock,
  Layers,
  Activity,
  HardDrive,
  ShieldCheck,
  Sun,
  Moon,
  Sparkles,
  Settings,
  BookOpen,
} from "lucide-react";
import type { LicenseStatusDto } from "@/types/ipc";

export type NavTab = "dashboard" | "timemachine" | "jobs" | "activity" | "guide" | "settings";

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  dbStatusOk: boolean;
  dbStatusText: string;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  activeDrivesCount: number;
  licenseStatus?: LicenseStatusDto | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  dbStatusOk,
  dbStatusText,
  theme,
  onToggleTheme,
  activeDrivesCount,
  licenseStatus,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.ElementType; badge?: string }[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "timemachine",
      label: "Time Machine",
      icon: Clock,
      badge: "Visual",
    },
    {
      id: "jobs",
      label: "Backup Jobs",
      icon: Layers,
    },
    {
      id: "activity",
      label: "Activity Log",
      icon: Activity,
    },
    {
      id: "guide",
      label: "How to Use Me Properly",
      icon: BookOpen,
      badge: "Guide",
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 h-full bg-slate-900/95 border-r border-slate-800/80 flex flex-col justify-between select-none">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <HardDrive className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-white tracking-tight">SnapVault</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  v1.0.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Windows 11 Time Machine</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/25"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? "text-white" : "text-slate-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${
                      isActive
                        ? "bg-sky-700/60 text-sky-100"
                        : "bg-slate-800 text-sky-400 border border-slate-700"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / System Health Section */}
      <div className="p-3.5 space-y-3 border-t border-slate-800/80 bg-slate-950/40">
        {/* License & Trial Status Pill */}
        <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <Sparkles
              className={`w-3.5 h-3.5 ${
                licenseStatus?.is_licensed
                  ? "text-emerald-400"
                  : licenseStatus?.state === "TRIAL_EXPIRED"
                  ? "text-rose-400"
                  : "text-amber-400"
              }`}
            />
            <span className="text-slate-300 font-medium">
              {licenseStatus?.is_licensed
                ? "SnapVault Pro"
                : licenseStatus?.state === "TRIAL_EXPIRED"
                ? "Trial Expired"
                : "Store Free Trial"}
            </span>
          </div>
          <span
            className={`text-[11px] font-semibold ${
              licenseStatus?.is_licensed
                ? "text-emerald-300 font-mono"
                : licenseStatus?.state === "TRIAL_EXPIRED"
                ? "text-rose-300 font-medium"
                : "text-amber-300"
            }`}
          >
            {licenseStatus?.is_licensed
              ? "Licensed"
              : licenseStatus?.state === "TRIAL_EXPIRED"
              ? "Restores Free"
              : `${licenseStatus?.days_remaining ?? 14} Days Left`}
          </span>
        </div>

        {/* Database & Drive Status */}
        <div className="space-y-1.5 text-[11px] text-slate-400 px-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  dbStatusOk ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-rose-400"
                }`}
              />
              <span>Engine Status</span>
            </span>
            <span className={dbStatusOk ? "text-emerald-400 font-mono" : "text-rose-400"} title={dbStatusText}>
              {dbStatusOk ? "WAL Active" : "Offline"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-sky-400" />
              <span>Target Drives</span>
            </span>
            <span className="text-slate-200 font-mono font-medium">
              {activeDrivesCount} Paired
            </span>
          </div>
        </div>

        {/* Light / Dark Mode & Offline Indicator */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span>100% Offline • Zero Cloud</span>
          <button
            onClick={onToggleTheme}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Toggle theme (Light / Dark)"
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </aside>
  );
};
