/** VS Code view/command identifiers — single source of truth */
export const VIEW_ID = 'packSight.dependencies' as const;

export const COMMANDS = {
  REFRESH: 'packSight.refresh',
  UNINSTALL: 'packSight.uninstall',
  UPDATE: 'packSight.update',
  COPY_PACKAGE_NAME: 'packSight.copyPackageName',
  SWITCH_TO_DASHBOARD: 'packSight.switchToDashboard',
  SWITCH_TO_TREE_VIEW: 'packSight.switchToTreeView',
  OPEN_DASHBOARD: 'packSight.openDashboard',
  OPEN_LINK: 'packSight.openLink',
} as const;

/** Context key that drives which toggle button is shown in the view title bar */
export const CONTEXT_KEYS = {
  DASHBOARD_OPEN: 'packSight.dashboardOpen',
} as const;

/** Folders excluded from AST scanning */
export const SCAN_EXCLUDE_DIRS = [
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
] as const;

/** File extensions to scan for imports */
export const SCAN_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx'] as const;

/** Debounce delay (ms) for package.json file watcher */
export const WATCHER_DEBOUNCE_MS = 500 as const;
