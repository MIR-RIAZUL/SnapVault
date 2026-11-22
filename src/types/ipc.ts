export interface PingDbResponse {
  status: string;
  table_count: number;
  schema_version: number;
  journal_mode: string;
  database_path: string;
}

export interface Drive {
  id: number;
  uuid: string;
  label: string;
  mount_path: string;
  role: string;
  filesystem: string;
  total_bytes: number;
  free_bytes: number;
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
}

export interface BackupJob {
  id: number;
  name: string;
  source_path: string;
  destination_drive_id: number;
  schedule_type: string;
  interval_minutes: number;
  is_active: boolean;
  enable_emergency_mirror: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

export interface Snapshot {
  id: number;
  job_id: number;
  status: "PENDING" | "COMMITTED" | "INTERRUPTED" | "FAILED" | "TRIPWIRE_PAUSED";
  started_at: string;
  completed_at: string | null;
  total_files: number;
  total_bytes: number;
  new_chunks_count: number;
  new_bytes_stored: number;
  files_modified: number;
  files_deleted: number;
  tripwire_triggered: boolean;
  is_locked_readonly: boolean;
  error_message: string | null;
}

export interface SnapshotProgress {
  job_id: number;
  snapshot_id: number;
  current_file: string;
  files_processed: number;
  bytes_processed: number;
  dedup_saved_bytes: number;
  status: string;
}

export interface ManifestFileEntry {
  relative_path: string;
  file_size: number;
  modified_at: string;
  file_blake3_hash: string;
  chunk_hashes: string[];
}

export interface SnapshotManifest {
  snapshot_id: number;
  job_id: number;
  started_at: string;
  completed_at: string;
  total_files: number;
  total_bytes: number;
  new_bytes_stored: number;
  dedup_saved_bytes: number;
  files: ManifestFileEntry[];
}

export type DiffKind = "ADDED" | "MODIFIED" | "DELETED" | "UNCHANGED";

export interface SnapshotDiffItem {
  relative_path: string;
  kind: DiffKind;
  old_size?: number;
  new_size?: number;
  old_hash?: string;
  new_hash?: string;
}

export interface SnapshotDirEntry {
  name: string;
  relative_path: string;
  is_dir: boolean;
  file_size: number;
  modified_at: string;
  file_hash?: string;
}

export interface RestoreResult {
  files_restored: number;
  bytes_restored: number;
  restored_paths: string[];
  failed_files?: string[];
}

export interface PruneResult {
  snapshots_evaluated: number;
  snapshots_deleted: number;
  chunks_deleted: number;
  bytes_reclaimed: number;
}

export interface RegisterDriveInput {
  label: string;
  mount_path: string;
  role: string;
  filesystem?: string;
}

export interface CreateBackupJobInput {
  name: string;
  source_path: string;
  destination_drive_id: number;
  schedule_type?: string;
  interval_minutes?: number;
}

export interface RestoreEntryInput {
  snapshot_id: number;
  target_rel_path?: string;
  restore_dir: string;
  overwrite?: boolean;
}

export interface FilePreviewResponse {
  relative_path: string;
  file_size: number;
  modified_at: string;
  file_hash: string;
  is_text: boolean;
  is_image: boolean;
  too_large: boolean;
  snapshot_content?: string | null;
  current_content?: string | null;
  snapshot_data_uri?: string | null;
  current_data_uri?: string | null;
}

export interface FailedFileDetail {
  path: string;
  expected_hash: string;
  actual_hash?: string;
  error: string;
}

export interface HealthCheckResult {
  id: number;
  job_id: number;
  snapshot_id: number;
  ran_at: string;
  files_tested: number;
  bytes_tested: number;
  files_passed: number;
  files_failed: number;
  failed_details: FailedFileDetail[];
  duration_ms: number;
  status: "PASS" | "DEGRADED" | "FAIL";
}

export interface HealthStatusSummary {
  has_checked: boolean;
  latest_check?: HealthCheckResult | null;
  is_stale: boolean;
  days_since_last_backup?: number | null;
}

export interface TripwireAlertPayload {
  triggered: boolean;
  total_files_previous: number;
  files_deleted: number;
  files_modified: number;
  volatility_percentage: number;
  previous_snapshot_id?: number | null;
  message: string;
}

export interface AppSettingsDto {
  quiet_mode: boolean;
  exclusion_patterns: string[];
  tripwire_pct: number;
  tripwire_min_files: number;
  notifications_enabled: boolean;
  theme: string;
}

export type LicenseState = "TRIAL_ACTIVE" | "TRIAL_EXPIRED" | "LICENSED";

export interface LicenseStatusDto {
  state: LicenseState;
  is_licensed: boolean;
  days_remaining: number;
  first_run_at: string;
  is_msix: boolean;
  permanent_restore_unlocked: boolean;
}
