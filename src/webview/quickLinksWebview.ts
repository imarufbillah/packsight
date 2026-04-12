import * as vscode from 'vscode';

const REPO = 'https://github.com/imarufbillah/packsight';

interface LinkDef {
  icon: string;   // codicon name
  label: string;
  url: string;
}

const LINKS: LinkDef[] = [
  { icon: 'star-full',       label: 'Give a Star',       url: REPO },
  { icon: 'book',            label: 'Documentation',     url: `${REPO}#readme` },
  { icon: 'bug',             label: 'Report an Issue',   url: `${REPO}/issues/new` },
  { icon: 'lightbulb',       label: 'Feature Request',   url: `${REPO}/issues/new?labels=enhancement` },
  { icon: 'history',         label: 'Changelog',         url: `${REPO}/releases` },
  { icon: 'git-pull-request',label: 'Contribute',        url: `${REPO}/blob/main/CONTRIBUTING.md` },
];

/**
 * Sidebar webview that renders quick links to the GitHub repo
 * and an author credit at the bottom.
 */
export class QuickLinksWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'packSight.quickLinks';

  private view?: vscode.WebviewView;

  constructor(private readonly extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg: { command: string; url: string }) => {
      if (msg.command === 'openUrl') {
        void vscode.env.openExternal(vscode.Uri.parse(msg.url));
      }
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const codiconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')
    );
    const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'unsafe-inline';`;

    const rows = LINKS.map(l => /* html */`
      <button class="link-btn" onclick="open('${l.url}')">
        <span class="codicon codicon-${l.icon}"></span>
        <span>${l.label}</span>
      </button>`).join('');

    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta http-equiv="Content-Security-Policy" content="${csp}"/>
  <link rel="stylesheet" href="${codiconUri}"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      padding: 8px 12px 12px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: transparent;
    }
    .link-btn {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 5px 8px;
      margin-bottom: 2px;
      background: transparent;
      color: var(--vscode-foreground);
      border: none;
      border-radius: 4px;
      font-size: 0.85em;
      font-family: var(--vscode-font-family);
      cursor: pointer;
      text-align: left;
      transition: background 100ms ease, color 100ms ease;
    }
    .link-btn:hover {
      background: var(--vscode-list-hoverBackground);
      color: var(--vscode-list-hoverForeground, var(--vscode-foreground));
    }
    .codicon { font-size: 14px; flex-shrink: 0; }
    .divider {
      border: none;
      border-top: 1px solid var(--vscode-panel-border);
      margin: 8px 0;
      opacity: 0.5;
    }
    .author {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 4px 8px 0;
      font-size: 0.78em;
      color: var(--vscode-descriptionForeground);
    }
    .author-link {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
      font-weight: 600;
      background: none;
      border: none;
      padding: 0;
      font-size: inherit;
      font-family: inherit;
      cursor: pointer;
    }
    .author-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  ${rows}
  <hr class="divider"/>
  <div class="author">
    <span class="codicon codicon-account"></span>
    <span>Made by <button class="author-link" onclick="open('https://github.com/imarufbillah')">Maruf Billah</button></span>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    function open(url) { vscode.postMessage({ command: 'openUrl', url }); }
  </script>
</body>
</html>`;
  }
}
