import { invoke } from "@tauri-apps/api/core";
import type {
  BackupJob,
  CreateBackupJobInput,
  Drive,
  PingDbResponse,
  PruneResult,
  RegisterDriveInput,
  RestoreEntryInput,
  RestoreResult,
  Snapshot,
  SnapshotDiffItem,
  SnapshotDirEntry,
  SnapshotManifest,
} from "@/types/ipc";

export async function pingDb(): Promise<PingDbResponse> {
  return await invoke<PingDbResponse>("ping_db");
}

export async function registerDrive(input: RegisterDriveInput): Promise<Drive> {
  return await invoke<Drive>("register_drive", { input });
}

export async function listDrives(): Promise<Drive[]> {
  return await invoke<Drive[]>("list_drives");
}

export async function createBackupJob(input: CreateBackupJobInput): Promise<BackupJob> {
  return await invoke<BackupJob>("create_backup_job", { input });
}

export async function listBackupJobs(): Promise<BackupJob[]> {
  return await invoke<BackupJob[]>("list_backup_jobs");
}

export async function runSnapshot(jobId: number): Promise<SnapshotManifest> {
  return await invoke<SnapshotManifest>("run_snapshot", { jobId });
}

export async function listSnapshots(jobId: number): Promise<Snapshot[]> {
  return await invoke<Snapshot[]>("list_snapshots", { jobId });
}

export async function browseSnapshotDir(
  snapshotId: number,
  dirRelPath: string
): Promise<SnapshotDirEntry[]> {
  return await invoke<SnapshotDirEntry[]>("browse_snapshot_dir_command", {
    snapshotId,
    dirRelPath,
  });
}

export async function diffSnapshotFiles(
  snapshotAId: number,
  snapshotBId: number
): Promise<SnapshotDiffItem[]> {
  return await invoke<SnapshotDiffItem[]>("diff_snapshot_files", {
    snapshotAId,
    snapshotBId,
  });
}

export async function restoreEntry(input: RestoreEntryInput): Promise<RestoreResult> {
  return await invoke<RestoreResult>("restore_entry", { input });
}

export async function pruneSnapshots(jobId: number): Promise<PruneResult> {
  return await invoke<PruneResult>("prune_snapshots", { jobId });
}
