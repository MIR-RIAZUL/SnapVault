export interface PingDbResponse {
  status: string;
  table_count: number;
  schema_version: number;
  journal_mode: string;
  database_path: string;
}
