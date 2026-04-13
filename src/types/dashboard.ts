/** Single package row shown in the dashboard table */
export interface DashboardPackage {
  name: string;
  version: string;
  latest: string | null;       // null = up to date
  isUnused: boolean;
  isDev: boolean;
  lastUpdated: string | null;  // ISO date string of the installed version's publish time
  size: number | null;         // unpacked size in bytes
  repoUrl: string | null;      // GitHub releases URL, null if unavailable
  vulnSeverity: 'critical' | 'high' | 'moderate' | 'low' | null; // null = no known vulnerability
}

/** Full payload sent to the webview on every data load/refresh */
export interface DashboardData {
  packages: DashboardPackage[];
  /** Absolute path shown in the header for context */
  workspaceRoot: string;
  /** Node.js runtime version, e.g. "20.11.0" */
  nodeVersion: string | null;
  /** npm version, e.g. "10.2.4" */
  npmVersion: string | null;
}

// ─── Messages: Webview → Extension ───────────────────────────────────────────

export type WebviewMessage =
  | { command: 'ready' }
  | { command: 'uninstall'; packageName: string; isDev: boolean; version: string }
  | { command: 'update'; packageName: string; oldVersion: string; isDev: boolean }
  | { command: 'bulkUpdate'; packageNames: string[] }
  | { command: 'refresh' }
  | { command: 'openChangelog'; url: string }
  | { command: 'openNpm'; packageName: string }
  | { command: 'searchPackages'; query: string }
  | { command: 'installPackage'; packageName: string; isDev: boolean }
  | { command: 'revert'; packageName: string; version: string; isDev: boolean };

// ─── Messages: Extension → Webview ───────────────────────────────────────────

/** A single npm search result */
export interface NpmSearchResult {
  name: string;
  version: string;
  description: string;
  weeklyDownloads: number | null;
}

/** Enough information to undo an uninstall or update */
export interface RevertInfo {
  packageName: string;
  /** Version to restore — the installed version before the operation */
  version: string;
  isDev: boolean;
  /** 'uninstall' = re-install the package; 'update' = downgrade to old version */
  kind: 'uninstall' | 'update';
}

export type ExtensionMessage =
  | { command: 'loadData'; payload: DashboardData }
  | { command: 'operationStart'; packageName: string }
  | { command: 'operationSuccess'; message: string; revertInfo?: RevertInfo }
  | { command: 'operationError'; message: string }
  | { command: 'searchResults'; results: NpmSearchResult[] }
  | { command: 'searchError'; message: string };
