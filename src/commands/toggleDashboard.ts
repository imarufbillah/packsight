import * as vscode from 'vscode';
import { CONTEXT_KEYS } from '../constants';
import { DashboardPanel } from '../webview/dashboardPanel';
import { SidebarWebviewProvider } from '../webview/sidebarWebview';

export function setDashboardOpen(
  context: vscode.ExtensionContext,
  open: boolean
): void {
  void vscode.commands.executeCommand('setContext', CONTEXT_KEYS.DASHBOARD_OPEN, open);
  void context.globalState.update(CONTEXT_KEYS.DASHBOARD_OPEN, open);
}

export function registerToggleCommands(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  sidebarProvider: SidebarWebviewProvider,
): vscode.Disposable[] {
  const switchToDashboard = vscode.commands.registerCommand(
    'packSight.switchToDashboard',
    () => {
      setDashboardOpen(context, true);
      sidebarProvider.setDashboardOpen(true);
      DashboardPanel.createOrShow(context, workspaceRoot);
    }
  );

  const switchToTreeView = vscode.commands.registerCommand(
    'packSight.switchToTreeView',
    () => {
      setDashboardOpen(context, false);
      sidebarProvider.setDashboardOpen(false);
      DashboardPanel.closeIfOpen();
    }
  );

  return [switchToDashboard, switchToTreeView];
}
