import * as vscode from 'vscode';

/**
 * Sidebar webview that renders a single styled toggle button:
 * 'Open Dashboard' or 'Switch to Tree View' depending on state.
 */
export class ViewSwitchWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'packSight.viewSwitch';

  private view?: vscode.WebviewView;
  private dashboardOpen = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext,
    private readonly workspaceRoot: string,
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage((msg: { command: string }) => {
      if (msg.command === 'switchToDashboard') {
        void vscode.commands.executeCommand('packSight.switchToDashboard');
      } else if (msg.command === 'switchToTreeView') {
        void vscode.commands.executeCommand('packSight.switchToTreeView');
      }
    });
  }

  public setDashboardOpen(open: boolean): void {
    this.dashboardOpen = open;
    if (this.view) {
      this.view.webview.html = this.getHtml();
    }
  }

  private getHtml(): string {
    const isDash = this.dashboardOpen;
    const btnLabel = isDash ? '🌲 Switch to Tree View' : '⚡ Open Package Manager';
    const btnCmd  = isDash ? 'switchToTreeView' : 'switchToDashboard';
    const btnDesc = isDash
      ? 'Go back to the dependency tree'
      : 'Open the visual Package Manager dashboard';

    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      padding: 8px 12px 10px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: transparent;
    }
    button {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 12px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      font-size: 0.88em;
      font-family: var(--vscode-font-family);
      font-weight: 500;
      cursor: pointer;
      transition: background 120ms ease;
      text-align: left;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .desc {
      margin-top: 5px;
      font-size: 0.76em;
      color: var(--vscode-descriptionForeground);
      padding: 0 2px;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <button id="btn" onclick="go()">${btnLabel}</button>
  <div class="desc">${btnDesc}</div>
  <script>
    const vscode = acquireVsCodeApi();
    function go() { vscode.postMessage({ command: '${btnCmd}' }); }
  </script>
</body>
</html>`;
  }
}
