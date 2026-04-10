/** Single package row shown in the dashboard table */
export interface DashboardPackage {
  name: string;
  version: string;
  latest: string | null;       // null = up to date
  isUnused: boolean;
  isDev: boolean;
  lastUpdated: string | null;  // ISO date string of the installed version's publish time
  size: number | null;         // unpacked size in bytes
}

/** Full payload sent to the webview on every data load/refresh */
export interface DashboardData {
  packages: DashboardPackage[];
  /** Absolute path shown in the header for context */
  workspaceRoot: string;
}

// ─── Messages: Webview → Extension ───────────────────────────────────────────

export type WebviewMessage =
  | { command: 'ready' }
  | { command: 'uninstall'; packageName: string; isDev: boolean }
  | { command: 'update'; packageName: string }
  | { command: 'bulkUpdate'; packageNames: string[] }
  | { command: 'refresh' };

// ─── Messages: Extension → Webview ───────────────────────────────────────────

export type ExtensionMessage =
  | { command: 'loadData'; payload: DashboardData }
  | { command: 'operationStart'; packageName: string }
  | { command: 'operationSuccess'; message: string }
  | { command: 'operationError'; message: string };
