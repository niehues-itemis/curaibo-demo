export type ConnectorType = "filesystem" | "email";
export type ConnectorStatus = "active" | "inactive" | "error";

export interface FilesystemConnectorConfig {
  watchPath: string;
}

export interface EmailConnectorConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  mailbox: string; // z.B. "INBOX"
  tls: boolean;
}

export interface Connector {
  id: string;
  type: ConnectorType;
  name: string;
  status: ConnectorStatus;
  enabled: boolean;
  pollIntervalMinutes: number;
  config: FilesystemConnectorConfig | EmailConnectorConfig;
  lastSyncAt: string | null;
  lastSyncResult: string | null;
  processedCount: number;
  createdAt: string;
}

export type JobStatus = "running" | "success" | "error";

export interface JobLogEntry {
  id: string;
  connectorId: string;
  connectorName: string;
  connectorType: ConnectorType;
  startedAt: string;
  finishedAt: string | null;
  status: JobStatus;
  result: string | null;
  errors: string[];
  processed: number;
  newCaseIds: string[];
}

export interface SyncResult {
  processed: number;
  skipped: number;
  errors: string[];
  newCaseIds: string[];
  assignedToCaseIds: string[];
}

export interface ClassificationResult {
  isVInsOForm: boolean;
  suggestedCaseId: string | null;
  confidence: number;
  reason: string;
  extractedAktenzeichen?: string;
  extractedSchuldnerName?: string;
}
