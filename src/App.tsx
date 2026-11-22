import { useEffect, useState } from "react";
import { Sidebar, type NavTab } from "@/components/Sidebar";
import { Dashboard } from "@/pages/Dashboard";
import { TimeMachine } from "@/pages/TimeMachine";
import { Jobs } from "@/pages/Jobs";
import { ActivityLog } from "@/pages/ActivityLog";
import { Settings } from "@/pages/Settings";
import { Guide } from "@/pages/Guide";
import { pingDb, listBackupJobs, listDrives, getLicenseStatus } from "@/lib/ipc";
import type { BackupJob, Drive, PingDbResponse, LicenseStatusDto } from "@/types/ipc";

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [dbData, setDbData] = useState<PingDbResponse | null>(null);
  const [dbStatusOk, setDbStatusOk] = useState(true);
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatusDto | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | undefined>(undefined);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const refreshAppData = async () => {
    try {
      const [res, allJobs, allDrives, license] = await Promise.all([
        pingDb(),
        listBackupJobs(),
        listDrives(),
        getLicenseStatus().catch(() => null),
      ]);
      setDbData(res);
      setDbStatusOk(true);
      setJobs(allJobs);
      setDrives(allDrives);
      setLicenseStatus(license);
      if (allJobs.length > 0 && selectedJobId === undefined) {
        setSelectedJobId(allJobs[0].id);
      }
    } catch (err) {
      console.error("Failed to connect to SnapVault database:", err);
      setDbStatusOk(false);
    }
  };

  useEffect(() => {
    refreshAppData();
  }, []);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleOpenTimeMachine = (jobId: number) => {
    setSelectedJobId(jobId);
    setActiveTab("timemachine");
  };

  return (
    <div
      className={`flex h-screen w-screen overflow-hidden ${
        theme === "dark"
          ? "bg-slate-950 text-slate-100"
          : "bg-slate-100 text-slate-900"
      }`}
    >
      {/* Windows 11 Fluent Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        dbStatusOk={dbStatusOk}
        dbStatusText={dbData ? dbData.status : "Connecting..."}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        activeDrivesCount={drives.length}
        licenseStatus={licenseStatus}
      />

      {/* Main View Area */}
      <main className="flex-1 h-full overflow-y-auto bg-slate-950/50 backdrop-blur-mica">
        {activeTab === "dashboard" && (
          <Dashboard
            onOpenTimeMachine={handleOpenTimeMachine}
            onRefreshDrives={refreshAppData}
            licenseStatus={licenseStatus}
            onOpenGuide={() => setActiveTab("guide")}
          />
        )}

        {activeTab === "timemachine" && (
          <TimeMachine
            jobs={jobs}
            selectedJobId={selectedJobId}
            onSelectJob={setSelectedJobId}
          />
        )}

        {activeTab === "jobs" && <Jobs onRefreshDrives={refreshAppData} />}

        {activeTab === "activity" && <ActivityLog />}

        {activeTab === "guide" && (
          <Guide onNavigateTab={setActiveTab} />
        )}

        {activeTab === "settings" && (
          <Settings currentTheme={theme} onThemeChange={setTheme} />
        )}
      </main>
    </div>
  );
}
