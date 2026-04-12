import * as vscode from 'vscode';
import { DependencyTreeProvider } from './tree/dependencyTreeProvider';
import { ViewSwitchWebviewProvider } from './webview/viewSwitchWebview';
import { QuickLinksWebviewProvider } from './webview/quickLinksWebview';
import { refreshCommand } from './commands/refresh';
import { uninstallCommand } from './commands/uninstall';
import { updateCommand } from './commands/update';
import { registerToggleCommands, setDashboardOpen } from './commands/toggleDashboard';
import { DashboardPanel } from './webview/dashboardPanel';
import { dependencyChanged } from './events/dependencyEventEmitter';
import { COMMANDS, CONTEXT_KEYS, VIEW_ID, WATCHER_DEBOUNCE_MS } from './constants';
import { DependencyItem } from './tree/dependencyItem';

/**
 * Called by VS Code when the extension is activated.
 * Activation is triggered by `workspaceContains:package.json`.
 */
export function activate(context: vscode.ExtensionContext): void {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showWarningMessage(
      'PackSight: No workspace folder found. Open a folder with a package.json.'
    );
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // ── Restore persisted dashboard mode ──────────────────────────────────────
  const wasDashboardOpen = context.globalState.get<boolean>(
    CONTEXT_KEYS.DASHBOARD_OPEN,
    false
  );
  setDashboardOpen(context, wasDashboardOpen);
  if (wasDashboardOpen) {
    DashboardPanel.createOrShow(context, workspaceRoot);
  }

  // ── View-switch webview (top of sidebar) ──────────────────────────────────
  const viewSwitchProvider = new ViewSwitchWebviewProvider(
    context.extensionUri, context, workspaceRoot
  );
  viewSwitchProvider.setDashboardOpen(wasDashboardOpen);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ViewSwitchWebviewProvider.viewId, viewSwitchProvider)
  );

  // ── Quick links webview (bottom of sidebar) ────────────────────────────────
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      QuickLinksWebviewProvider.viewId,
      new QuickLinksWebviewProvider(context.extensionUri),
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // ── Tree provider ──────────────────────────────────────────────────────────
  const treeProvider = new DependencyTreeProvider(workspaceRoot);

  const treeView = vscode.window.createTreeView(VIEW_ID, {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  // ── Title badge: "PackSight (42)" ─────────────────────────────────────────────
  const updateTitle = (): void => {
    const total = treeProvider.getTotalCount();
    // treeView.title replaces the view's "name" entirely — no prepending occurs.
    treeView.title = total > 0 ? `Packages (${total})` : 'Packages';
  };

  // Re-run title update whenever the tree data changes
  const titleUpdateDisposable = treeProvider.onDidChangeTreeData(() => {
    updateTitle();
  });

  updateTitle();

  // ── Debounced package.json watcher ─────────────────────────────────────────
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceFolders[0], 'package.json')
  );

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const scheduleRefresh = (): void => {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      treeProvider.refresh();
      // If the dashboard is open, reload its data too (bypass cache — file changed)
      if (DashboardPanel.isOpen()) {
        const panel = DashboardPanel.createOrShow(context, workspaceRoot);
        void panel.loadData(true);
      }
    }, WATCHER_DEBOUNCE_MS);
  };

  watcher.onDidChange(scheduleRefresh);
  watcher.onDidCreate(scheduleRefresh);
  watcher.onDidDelete(scheduleRefresh);

  // ── Dashboard ↔ TreeView data sync ─────────────────────────────────────────
  // When the tree provider finishes a scan (e.g. after a right-click uninstall
  // or update), push fresh data to the dashboard if it is open.
  const dashboardSyncDisposable = dependencyChanged.event(() => {
    if (DashboardPanel.isOpen()) {
      const panel = DashboardPanel.createOrShow(context, workspaceRoot);
      void panel.loadData(true); // bypass cache — dependencies actually changed
    }
  });

  // ── Commands ───────────────────────────────────────────────────────────────
  const refreshDisposable = vscode.commands.registerCommand(
    COMMANDS.REFRESH,
    () => refreshCommand(treeProvider)
  );

  const uninstallDisposable = vscode.commands.registerCommand(
    COMMANDS.UNINSTALL,
    (item: DependencyItem) => uninstallCommand(item, treeProvider, workspaceRoot)
  );

  const updateDisposable = vscode.commands.registerCommand(
    COMMANDS.UPDATE,
    (item: DependencyItem) => updateCommand(item, treeProvider, workspaceRoot)
  );

  const copyNameDisposable = vscode.commands.registerCommand(
    COMMANDS.COPY_PACKAGE_NAME,
    async (item: DependencyItem) => {
      if (item.packageName) {
        await vscode.env.clipboard.writeText(item.packageName);
        vscode.window.showInformationMessage(
          `Copied "${item.packageName}" to clipboard.`
        );
      }
    }
  );

  // ── Toggle commands ────────────────────────────────────────────────────────
  const toggleDisposables = registerToggleCommands(context, workspaceRoot, viewSwitchProvider);

  // ── Open Dashboard command (Command Palette + package.json right-click) ────
  const openDashboardDisposable = vscode.commands.registerCommand(
    COMMANDS.OPEN_DASHBOARD,
    () => {
      setDashboardOpen(context, true);
      viewSwitchProvider.setDashboardOpen(true);
      DashboardPanel.createOrShow(context, workspaceRoot);
    }
  );

  // ── Open Link command (quick links tree) ───────────────────────────────────
  const openLinkDisposable = vscode.commands.registerCommand(
    COMMANDS.OPEN_LINK,
    (url: string) => {
      void vscode.env.openExternal(vscode.Uri.parse(url));
    }
  );

  // ── Register all disposables ───────────────────────────────────────────────
  context.subscriptions.push(
    treeView,
    titleUpdateDisposable,
    watcher,
    refreshDisposable,
    uninstallDisposable,
    updateDisposable,
    copyNameDisposable,
    dashboardSyncDisposable,
    dependencyChanged,
    openDashboardDisposable,
    openLinkDisposable,
    ...toggleDisposables
  );
}

/** Called by VS Code when the extension is deactivated. */
export function deactivate(): void {
  // Subscriptions are disposed automatically by VS Code
}
