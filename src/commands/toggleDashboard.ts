import * as vscode from 'vscode';
import { CONTEXT_KEYS } from '../constants';
import { DashboardPanel } from '../webview/dashboardPanel';
import { ViewSwitchWebviewProvider } from '../webview/viewSwitchWebview';

/**
 * Sets the `packSight.dashboardOpen` context key and persists the chosen
 * mode to globalState so it survives VS Code restarts.
 */
export function setDashboardOpen(
  context: vscode.ExtensionContext,
  open: boolean
): void {
  void vscode.commands.executeCommand(
    'setContext',
    CONTEXT_KEYS.DASHBOARD_OPEN,
    open
  );
  void context.globalState.update(CONTEXT_KEYS.DASHBOARD_OPEN, open);
}

/**
 * Registers both toggle commands and wires them to the DashboardPanel singleton.
 */
export function registerToggleCommands(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  viewSwitchProvider: ViewSwitchWebviewProvider,
): vscode.Disposable[] {
  const switchToDashboard = vscode.commands.registerCommand(
    'packSight.switchToDashboard',
    () => {
      setDashboardOpen(context, true);
      viewSwitchProvider.setDashboardOpen(true);
      DashboardPanel.createOrShow(context, workspaceRoot);
    }
  );

  const switchToTreeView = vscode.commands.registerCommand(
    'packSight.switchToTreeView',
    () => {
      setDashboardOpen(context, false);
      viewSwitchProvider.setDashboardOpen(false);
      DashboardPanel.closeIfOpen();
    }
  );

  return [switchToDashboard, switchToTreeView];
}
