import * as vscode from 'vscode';
import { SidebarWebviewProvider } from './webview/sidebarWebview';
import { registerToggleCommands, setDashboardOpen } from './commands/toggleDashboard';
import { DashboardPanel } from './webview/dashboardPanel';
import { dependencyChanged } from './events/dependencyEventEmitter';
import { COMMANDS, CONTEXT_KEYS, VIEW_ID, WATCHER_DEBOUNCE_MS } from './constants';

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

  // ── Sidebar webview (single unified view) ─────────────────────────────────
  const sidebarProvider = new SidebarWebviewProvider(
    context.extensionUri,
    workspaceRoot,
    // onRefresh
    () => { sidebarProvider.refresh(); },
    // onUninstall
    (name, isDev) => {
      void vscode.commands.executeCommand(COMMANDS.UNINSTALL, { packageName: name, isDev });
    },
    // onUpdate
    (name) => {
      void vscode.commands.executeCommand(COMMANDS.UPDATE, { packageName: name });
    },
    // onCopyName
    async (name) => {
      await vscode.env.clipboard.writeText(name);
      vscode.window.showInformationMessage(`Copied '${name}' to clipboard.`);
    },
    // onSwitchToDashboard
    () => { void vscode.commands.executeCommand(COMMANDS.SWITCH_TO_DASHBOARD); },
    // onSwitchToTreeView
    () => { void vscode.commands.executeCommand(COMMANDS.SWITCH_TO_TREE_VIEW); },
  );

  sidebarProvider.setDashboardOpen(wasDashboardOpen);
  DashboardPanel.setViewSwitchProvider(sidebarProvider);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // ── Debounced package.json watcher ─────────────────────────────────────────
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceFolders[0], 'package.json')
  );

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const scheduleRefresh = (): void => {
    if (debounceTimer !== undefined) { clearTimeout(debounceTimer); }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      sidebarProvider.refresh();
      if (DashboardPanel.isOpen()) {
        const panel = DashboardPanel.createOrShow(context, workspaceRoot);
        void panel.loadData(true);
      }
    }, WATCHER_DEBOUNCE_MS);
  };

  watcher.onDidChange(scheduleRefresh);
  watcher.onDidCreate(scheduleRefresh);
  watcher.onDidDelete(scheduleRefresh);

  // ── Dashboard ↔ Sidebar data sync ─────────────────────────────────────────
  const dashboardSyncDisposable = dependencyChanged.event(() => {
    if (DashboardPanel.isOpen()) {
      const panel = DashboardPanel.createOrShow(context, workspaceRoot);
      void panel.loadData(true);
    }
  });

  // ── Commands ───────────────────────────────────────────────────────────────
  const refreshDisposable = vscode.commands.registerCommand(
    COMMANDS.REFRESH,
    () => sidebarProvider.refresh()
  );

  const uninstallDisposable = vscode.commands.registerCommand(
    COMMANDS.UNINSTALL,
    async (arg: { packageName: string; isDev: boolean } | undefined) => {
      if (!arg?.packageName) { return; }
      const { packageName, isDev } = arg;
      const terminal = vscode.window.createTerminal({ name: 'PackSight', cwd: workspaceRoot });
      const flag = isDev ? '--save-dev' : '--save';
      terminal.sendText(`npm uninstall ${flag} ${packageName} ; exit`);
      terminal.show(true);
      const d = vscode.window.onDidCloseTerminal(t => {
        if (t === terminal) { d.dispose(); sidebarProvider.refresh(); }
      });
    }
  );

  const updateDisposable = vscode.commands.registerCommand(
    COMMANDS.UPDATE,
    async (arg: { packageName: string } | undefined) => {
      if (!arg?.packageName) { return; }
      const { packageName } = arg;
      const terminal = vscode.window.createTerminal({ name: 'PackSight', cwd: workspaceRoot });
      terminal.sendText(`npm install ${packageName}@latest ; exit`);
      terminal.show(true);
      const d = vscode.window.onDidCloseTerminal(t => {
        if (t === terminal) { d.dispose(); sidebarProvider.refresh(); }
      });
    }
  );

  const copyNameDisposable = vscode.commands.registerCommand(
    COMMANDS.COPY_PACKAGE_NAME,
    async (arg: { packageName: string } | undefined) => {
      const name = arg?.packageName;
      if (name) {
        await vscode.env.clipboard.writeText(name);
        vscode.window.showInformationMessage(`Copied '${name}' to clipboard.`);
      }
    }
  );

  // ── Toggle commands ────────────────────────────────────────────────────────
  const toggleDisposables = registerToggleCommands(context, workspaceRoot, sidebarProvider);

  // ── Open Dashboard command (Command Palette + package.json right-click) ────
  const openDashboardDisposable = vscode.commands.registerCommand(
    COMMANDS.OPEN_DASHBOARD,
    () => {
      setDashboardOpen(context, true);
      sidebarProvider.setDashboardOpen(true);
      DashboardPanel.createOrShow(context, workspaceRoot);
    }
  );

  // ── Open Link command ──────────────────────────────────────────────────────
  const openLinkDisposable = vscode.commands.registerCommand(
    COMMANDS.OPEN_LINK,
    (url: string) => { void vscode.env.openExternal(vscode.Uri.parse(url)); }
  );

  // ── Register all disposables ───────────────────────────────────────────────
  context.subscriptions.push(
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
