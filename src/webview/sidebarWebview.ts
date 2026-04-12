import * as vscode from "vscode";
import { dependencyChanged } from "../events/dependencyEventEmitter";
import { parseDependencies } from "../services/dependencyService";
import { scanUsedPackages } from "../services/scanService";
import { getOutdatedPackages } from "../services/npmService";
import * as fs from "fs";
import * as path from "path";

const REPO = "https://github.com/imarufbillah/packsight";

export interface SidebarPackage {
  name: string;
  version: string;
  isDev: boolean;
  isUnused: boolean;
  latestVersion: string | null;
}

type SidebarMessage =
  | { command: "refresh" }
  | { command: "switchToDashboard" }
  | { command: "switchToTreeView" }
  | { command: "uninstall"; packageName: string; isDev: boolean }
  | { command: "update"; packageName: string }
  | { command: "copyName"; packageName: string }
  | { command: "openUrl"; url: string };

/**
 * Single webview view that owns the entire PackSight sidebar:
 * toggle button, package list, quick links, and author credit.
 */
export class SidebarWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "packSight.sidebar";

  private view?: vscode.WebviewView;
  private dashboardOpen = false;

  // ── Package data state ─────────────────────────────────────────────────────
  private packages: SidebarPackage[] = [];
  private loading = true;
  private hasError = false;
  private scanning = false;
  private initialLoad = true;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly workspaceRoot: string,
    private readonly onRefresh: () => void,
    private readonly onUninstall: (name: string, isDev: boolean) => void,
    private readonly onUpdate: (name: string) => void,
    private readonly onCopyName: (name: string) => void,
    private readonly onSwitchToDashboard: () => void,
    private readonly onSwitchToTreeView: () => void,
  ) {
    this.loadAndScan();

    // Re-scan when dependencies change (e.g. after install/uninstall)
    dependencyChanged.event(() => {
      this.loadAndScan();
    });
  }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    this.render();

    webviewView.webview.onDidReceiveMessage((msg: SidebarMessage) => {
      switch (msg.command) {
        case "refresh":
          this.loadAndScan();
          this.onRefresh();
          break;
        case "switchToDashboard":
          this.onSwitchToDashboard();
          break;
        case "switchToTreeView":
          this.onSwitchToTreeView();
          break;
        case "uninstall":
          this.onUninstall(msg.packageName, msg.isDev);
          break;
        case "update":
          this.onUpdate(msg.packageName);
          break;
        case "copyName":
          this.onCopyName(msg.packageName);
          break;
        case "openUrl":
          void vscode.env.openExternal(vscode.Uri.parse(msg.url));
          break;
      }
    });
  }

  public setDashboardOpen(open: boolean): void {
    this.dashboardOpen = open;
    this.render();
  }

  public refresh(): void {
    this.loadAndScan();
  }

  public getTotalCount(): number {
    return this.packages.length;
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  private loadAndScan(): void {
    const pkgPath = path.join(this.workspaceRoot, "package.json");
    this.hasError = !fs.existsSync(pkgPath);

    if (!this.hasError) {
      const { dependencies, devDependencies } = parseDependencies(
        this.workspaceRoot,
      );
      // Merge with existing data so UI doesn't flash empty on refresh
      if (this.initialLoad) {
        this.packages = [
          ...dependencies.map((p) => ({
            name: p.name,
            version: p.version,
            isDev: false,
            isUnused: false,
            latestVersion: null,
          })),
          ...devDependencies.map((p) => ({
            name: p.name,
            version: p.version,
            isDev: true,
            isUnused: false,
            latestVersion: null,
          })),
        ];
      }
    }

    this.render();

    if (this.hasError || this.scanning) {
      return;
    }

    this.scanning = true;

    setImmediate(() => {
      void (async () => {
        try {
          const { dependencies, devDependencies } = parseDependencies(
            this.workspaceRoot,
          );
          const allEntries = [
            ...dependencies.map((p) => ({ name: p.name, version: p.version })),
            ...devDependencies.map((p) => ({
              name: p.name,
              version: p.version,
            })),
          ];
          const usedPackages = scanUsedPackages(this.workspaceRoot);
          const outdatedMap = await getOutdatedPackages(allEntries);

          this.packages = [
            ...dependencies.map((p) => ({
              name: p.name,
              version: p.version,
              isDev: false,
              isUnused: !usedPackages.has(p.name),
              latestVersion: outdatedMap.get(p.name)?.latest ?? null,
            })),
            ...devDependencies.map((p) => ({
              name: p.name,
              version: p.version,
              isDev: true,
              isUnused: !usedPackages.has(p.name),
              latestVersion: outdatedMap.get(p.name)?.latest ?? null,
            })),
          ];
        } catch {
          // keep existing packages on error
        } finally {
          this.scanning = false;
          this.initialLoad = false;
          this.render();
        }
      })();
    });
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private render(): void {
    if (!this.view) {
      return;
    }
    this.view.webview.html = this.getHtml();
  }

  private getHtml(): string {
    const codiconUri = this.view!.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        "node_modules",
        "@vscode",
        "codicons",
        "dist",
        "codicon.css",
      ),
    );
    const cspSource = this.view!.webview.cspSource;

    const deps = this.packages.filter((p) => !p.isDev);
    const devDeps = this.packages.filter((p) => p.isDev);
    const total = this.packages.length;

    const toggleBtn = this.dashboardOpen
      ? `<button class="toggle-btn" onclick="post('switchToTreeView')"><span class="codicon codicon-list-tree"></span>Switch to Tree View</button>`
      : `<button class="toggle-btn" onclick="post('switchToDashboard')"><span class="codicon codicon-layout-panel"></span>Open Dashboard</button>`;

    const renderPkg = (p: SidebarPackage): string => {
      const isOutdated = p.latestVersion !== null;
      let iconCls = "codicon-circle-filled icon-ok";
      if (isOutdated && p.isUnused) {
        iconCls = "codicon-circle-slash icon-crit";
      } else if (isOutdated) {
        iconCls = "codicon-arrow-circle-up icon-outdated";
      } else if (p.isUnused) {
        iconCls = "codicon-warning icon-unused";
      }

      const badges = [
        p.isDev ? '<span class="badge badge-dev">dev</span>' : "",
        p.isUnused ? '<span class="badge badge-unused">unused</span>' : "",
        isOutdated
          ? `<span class="badge badge-outdated">↑ ${p.latestVersion}</span>`
          : "",
      ].join("");

      const name = p.name
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const ver = p.version
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      return `<div class="pkg-row" data-name="${name}" data-dev="${p.isDev}" data-latest="${p.latestVersion ?? ""}">
        <span class="codicon ${iconCls} pkg-icon"></span>
        <div class="pkg-info">
          <span class="pkg-name">${name}</span>
          <span class="pkg-ver">${ver}</span>
          ${badges}
        </div>
        <div class="pkg-actions">
          ${isOutdated ? `<button class="act-btn act-update" title="Update to ${p.latestVersion}" onclick="update('${name}','${p.latestVersion}')"><span class="codicon codicon-arrow-up"></span></button>` : ""}
          <button class="act-btn act-copy" title="Copy name" onclick="copyName('${name}')"><span class="codicon codicon-copy"></span></button>
          <button class="act-btn act-remove" title="Uninstall" onclick="uninstall('${name}',${p.isDev})"><span class="codicon codicon-trash"></span></button>
        </div>
      </div>`;
    };

    const renderGroup = (
      label: string,
      pkgs: SidebarPackage[],
      id: string,
    ): string => {
      if (pkgs.length === 0) {
        return "";
      }
      const unused = pkgs.filter((p) => p.isUnused).length;
      const badge =
        unused > 0 ? ` <span class="group-badge">${unused} unused</span>` : "";
      return `<div class="group">
        <div class="group-header" onclick="toggleGroup('${id}')">
          <span class="codicon codicon-chevron-down group-chevron" id="chev-${id}"></span>
          <span class="group-label">${label}</span>
          <span class="group-count">${pkgs.length}</span>${badge}
        </div>
        <div class="group-body" id="grp-${id}">
          ${pkgs.map(renderPkg).join("")}
        </div>
      </div>`;
    };

    const pkgList = this.hasError
      ? `<div class="state-msg"><span class="codicon codicon-error state-icon icon-crit"></span><span>No package.json found</span></div>`
      : this.initialLoad
        ? `<div class="state-msg"><span class="codicon codicon-loading~spin state-icon"></span><span>Loading packages…</span></div>`
        : total === 0
          ? `<div class="state-msg"><span class="codicon codicon-package state-icon"></span><span>No packages found</span></div>`
          : renderGroup("Dependencies", deps, "deps") +
            renderGroup("Dev Dependencies", devDeps, "devdeps");

    const links = [
      { icon: "star-full", label: "Give a Star", url: REPO },
      { icon: "book", label: "Documentation", url: `${REPO}#readme` },
      { icon: "bug", label: "Report an Issue", url: `https://github.com/imarufbillah/packsight/issues/new/choose` },
      {
        icon: "lightbulb",
        label: "Feature Request",
        url: `https://github.com/imarufbillah/packsight/issues/new/choose`,
      },
      { icon: "history", label: "Changelog", url: `${REPO}/releases` },
      {
        icon: "git-pull-request",
        label: "Contribute",
        url: `${REPO}/blob/main/CONTRIBUTING.md`,
      },
    ]
      .map(
        (l) =>
          `<button class="link-btn" onclick="openUrl('${l.url}')"><span class="codicon codicon-${l.icon}"></span>${l.label}</button>`,
      )
      .join("");

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; font-src ${cspSource}; script-src 'unsafe-inline';"/>
  <link rel="stylesheet" href="${codiconUri}"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { height: 100%; }
    body {
      height: 100%;
      display: flex;
      flex-direction: column;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      overflow: hidden;
    }

    /* ── Toggle button ── */
    .toggle-wrap { padding: 9px 11px 7px; flex-shrink: 0; }
    .toggle-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 7px 11px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      font-size: 0.94em;
      font-family: var(--vscode-font-family);
      font-weight: 600;
      cursor: pointer;
      transition: background 120ms;
    }
    .toggle-btn:hover { background: var(--vscode-button-hoverBackground); }

    /* ── Section divider ── */
    .divider {
      height: 1px;
      background: var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      margin: 0;
      flex-shrink: 0;
      opacity: 0.6;
    }

    /* ── Section header ── */
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 11px 5px;
      flex-shrink: 0;
    }
    .section-title {
      font-size: 0.79em;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-descriptionForeground));
    }
    .section-actions { display: flex; gap: 2px; }
    .icon-btn {
      background: transparent;
      border: none;
      color: var(--vscode-icon-foreground, var(--vscode-foreground));
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 3px;
      display: flex;
      align-items: center;
      opacity: 0.7;
      transition: opacity 100ms, background 100ms;
    }
    .icon-btn:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }

    /* ── Package list ── */
    .pkg-list {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
    }
    .pkg-list::-webkit-scrollbar { width: 6px; }
    .pkg-list::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); border-radius: 3px; }
    .pkg-list::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground); }

    /* ── Group ── */
    .group { }
    .group-header {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 5px 11px;
      cursor: pointer;
      user-select: none;
      background: var(--vscode-sideBarSectionHeader-background, transparent);
      border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, transparent);
      transition: background 100ms;
    }
    .group-header:hover { background: var(--vscode-list-hoverBackground); }
    .group-chevron { font-size: 13px; transition: transform 150ms; flex-shrink: 0; }
    .group-chevron.collapsed { transform: rotate(-90deg); }
    .group-label { font-size: 0.90em; font-weight: 600; flex: 1; }
    .group-count {
      font-size: 0.79em;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 10px;
      padding: 0 6px;
      min-width: 20px;
      text-align: center;
    }
    .group-badge {
      font-size: 0.75em;
      color: var(--vscode-editorWarning-foreground, #f59e0b);
      background: color-mix(in srgb, var(--vscode-editorWarning-foreground, #f59e0b) 12%, transparent);
      border-radius: 10px;
      padding: 0 6px;
    }
    .group-body { }
    .group-body.collapsed { display: none; }

    /* ── Package row ── */
    .pkg-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 11px 4px 24px;
      cursor: default;
      transition: background 80ms;
      min-height: 29px;
    }
    .pkg-row:hover { background: var(--vscode-list-hoverBackground); }
    .pkg-row:hover .pkg-actions { opacity: 1; }
    .pkg-icon { font-size: 14px; flex-shrink: 0; }
    .icon-ok       { color: var(--vscode-testing-iconPassed, #4ade80); }
    .icon-unused   { color: var(--vscode-editorWarning-foreground, #f59e0b); }
    .icon-outdated { color: var(--vscode-charts-blue, #3b82f6); }
    .icon-crit     { color: var(--vscode-errorForeground, #f87171); }
    .pkg-info { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 5px; flex-wrap: wrap; }
    .pkg-name { font-size: 0.94em; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pkg-ver  { font-size: 0.82em; color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family, monospace); flex-shrink: 0; }
    .badge {
      font-size: 0.72em;
      font-weight: 600;
      padding: 0 5px;
      border-radius: 3px;
      flex-shrink: 0;
    }
    .badge-dev      { color: #a78bfa; background: color-mix(in srgb, #a78bfa 14%, transparent); }
    .badge-unused   { color: var(--vscode-editorWarning-foreground, #f59e0b); background: color-mix(in srgb, var(--vscode-editorWarning-foreground, #f59e0b) 12%, transparent); }
    .badge-outdated { color: var(--vscode-charts-blue, #3b82f6); background: color-mix(in srgb, var(--vscode-charts-blue, #3b82f6) 12%, transparent); }
    .pkg-actions {
      display: flex;
      gap: 1px;
      opacity: 0;
      transition: opacity 100ms;
      flex-shrink: 0;
    }
    .act-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 3px;
      display: flex;
      align-items: center;
      color: var(--vscode-icon-foreground, var(--vscode-foreground));
      font-size: 13px;
      transition: background 80ms, color 80ms;
    }
    .act-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
    .act-update:hover { color: var(--vscode-charts-blue, #3b82f6); }
    .act-remove:hover { color: var(--vscode-errorForeground, #f87171); }

    .state-msg {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 18px 15px;
      font-size: 0.91em;
      color: var(--vscode-descriptionForeground);
    }
    .state-icon { font-size: 16px; }

    /* ── Tip rotator ── */
    .tip-wrap {
      flex-shrink: 0;
      padding: 7px 12px 6px;
      min-height: 44px;
      display: flex;
      align-items: flex-start;
      gap: 7px;
      position: relative;
      overflow: hidden;
    }
    .tip-icon {
      font-size: 13px;
      flex-shrink: 0;
      margin-top: 1px;
      color: var(--vscode-charts-blue, #3b82f6);
      opacity: 0.8;
    }
    .tip-text {
      font-size: 0.78em;
      color: var(--vscode-descriptionForeground);
      line-height: 1.45;
      opacity: 1;
      transition: opacity 350ms ease, transform 350ms ease;
    }
    .tip-text.fade-out {
      opacity: 0;
      transform: translateY(-5px);
    }
    .tip-text.fade-in {
      opacity: 0;
      transform: translateY(5px);
    }
    .tip-kbd {
      display: inline-block;
      background: color-mix(in srgb, var(--vscode-foreground) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 80%, transparent);
      border-radius: 3px;
      padding: 0 4px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.88em;
      line-height: 1.5;
    }

    /* ── Quick links ── */
    .links-section { flex-shrink: 0; }
    .link-btn {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 13px;
      background: transparent;
      color: var(--vscode-foreground);
      border: none;
      font-size: 0.91em;
      font-family: var(--vscode-font-family);
      cursor: pointer;
      text-align: left;
      transition: background 80ms;
      border-radius: 0;
    }
    .link-btn:hover { background: var(--vscode-list-hoverBackground); }
    .link-btn .codicon { font-size: 14px; flex-shrink: 0; color: var(--vscode-icon-foreground); }

    /* ── Author ── */
    .author {
      text-align: center;
      padding: 7px 10px 9px;
      font-size: 0.81em;
      color: var(--vscode-descriptionForeground);
    }
    .author-link {
      color: var(--vscode-textLink-foreground);
      background: none;
      border: none;
      padding: 0;
      font-size: inherit;
      font-family: inherit;
      cursor: pointer;
      font-weight: 600;
    }
    .author-link:hover { text-decoration: underline; }

    /* ── Confirm dialog ── */
    .confirm-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 100;
      align-items: center;
      justify-content: center;
    }
    .confirm-overlay.visible { display: flex; }
    .confirm-box {
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 18px 20px 14px;
      max-width: 260px;
      width: 90%;
      box-shadow: 0 6px 24px rgba(0,0,0,0.4);
    }
    .confirm-title {
      font-size: 0.92em;
      font-weight: 700;
      margin-bottom: 7px;
      color: var(--vscode-foreground);
    }
    .confirm-body {
      font-size: 0.82em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 16px;
      line-height: 1.5;
    }
    .confirm-actions { display: flex; gap: 6px; justify-content: flex-end; }
    .confirm-btn {
      padding: 5px 12px;
      border: none;
      border-radius: 3px;
      font-size: 0.82em;
      font-family: var(--vscode-font-family);
      cursor: pointer;
      font-weight: 500;
    }
    .confirm-cancel { background: var(--vscode-button-secondaryBackground, #3a3d41); color: var(--vscode-button-secondaryForeground, #ccc); }
    .confirm-cancel:hover { background: var(--vscode-button-secondaryHoverBackground, #45494e); }
    .confirm-ok-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .confirm-ok-primary:hover { background: var(--vscode-button-hoverBackground); }
    .confirm-ok-danger { background: var(--vscode-errorForeground, #f87171); color: #fff; }
    .confirm-ok-danger:hover { opacity: 0.85; }
  </style>
</head>
<body>

  <!-- Confirm dialog -->
  <div class="confirm-overlay" id="confirm-overlay">
    <div class="confirm-box">
      <div class="confirm-title" id="confirm-title"></div>
      <div class="confirm-body" id="confirm-body"></div>
      <div class="confirm-actions">
        <button class="confirm-btn confirm-cancel" onclick="closeConfirm()">Cancel</button>
        <button class="confirm-btn" id="confirm-ok"></button>
      </div>
    </div>
  </div>

  <!-- Toggle button -->
  <div class="toggle-wrap">${toggleBtn}</div>
  <div class="divider"></div>

  <!-- Packages section -->
  <div class="section-header">
    <span class="section-title">Packages${total > 0 ? ` (${total})` : ""}</span>
    <div class="section-actions">
      <button class="icon-btn" title="Refresh" onclick="post('refresh')"><span class="codicon codicon-refresh"></span></button>
    </div>
  </div>

  <div class="pkg-list">${pkgList}</div>
  <div class="divider"></div>

  <!-- Tip rotator -->
  <div class="divider"></div>
  <div class="tip-wrap">
    <span class="codicon codicon-lightbulb tip-icon"></span>
    <span class="tip-text" id="tip-text"></span>
  </div>

  <!-- Quick links -->
  <div class="links-section">
    <div class="section-header">
      <span class="section-title">Quick Links</span>
    </div>
    ${links}
    <div class="divider" style="margin-top:4px"></div>
    <div class="author">Made by <button class="author-link" onclick="openUrl('https://github.com/imarufbillah')">Maruf Billah</button></div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function post(cmd, extra) { vscode.postMessage({ command: cmd, ...extra }); }
    function openUrl(url)     { post('openUrl', { url }); }
    function copyName(name)   { post('copyName', { packageName: name }); }

    // ── Confirm dialog ──────────────────────────────────────────────────────
    let pendingAction = null;
    function showConfirm(title, body, okLabel, okCls, onOk) {
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-body').textContent  = body;
      const ok = document.getElementById('confirm-ok');
      ok.textContent = okLabel;
      ok.className   = 'confirm-btn ' + okCls;
      pendingAction  = onOk;
      document.getElementById('confirm-overlay').classList.add('visible');
      ok.focus();
    }
    function closeConfirm() {
      document.getElementById('confirm-overlay').classList.remove('visible');
      pendingAction = null;
    }
    document.getElementById('confirm-ok').addEventListener('click', () => {
      if (pendingAction) { pendingAction(); }
      closeConfirm();
    });
    document.getElementById('confirm-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('confirm-overlay')) closeConfirm();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeConfirm();
    });

    function update(name, latest) {
      showConfirm(
        'Update Package',
        'Update "' + name + '" to the latest version' + (latest ? ' (' + latest + ')' : '') + '?',
        'Update', 'confirm-ok-primary',
        () => post('update', { packageName: name })
      );
    }
    function uninstall(name, isDev) {
      showConfirm(
        'Uninstall Package',
        'Are you sure you want to uninstall "' + name + '"? This cannot be undone.',
        'Uninstall', 'confirm-ok-danger',
        () => post('uninstall', { packageName: name, isDev })
      );
    }

    function toggleGroup(id) {
      const body = document.getElementById('grp-' + id);
      const chev = document.getElementById('chev-' + id);
      if (!body || !chev) return;
      const collapsed = body.classList.toggle('collapsed');
      chev.classList.toggle('collapsed', collapsed);
    }

    // ── Tip rotator ────────────────────────────────────────────────────────
    const TIPS = [
      '<kbd>Ctrl+Shift+P</kbd> → <em>PackSight: Open Package Manager</em>',
      'Right-click <kbd>package.json</kbd> → <em>Open Package Manager</em>',
      'Hover a package row to reveal Update, Copy, and Uninstall actions',
      'Click a package name to open it on <em>npmjs.com</em>',
      'The shield icon next to each package shows its security status',
      'Use <kbd>Ctrl + scroll</kbd> to zoom the dashboard in or out',
      'The dashboard caches data — re-opening it is instant',
      'Outdated packages show a <em>Major / Minor / Patch</em> bump badge',
      'Select multiple packages with checkboxes for a bulk update',
      'Hover the <em>Last Update</em> date to see the exact publish date',
      'The <em>Browse &amp; Install</em> button lets you search and install any npm package',
      'Unused packages are detected by scanning your source imports',
      'The Security card shows total vulnerabilities found by <em>npm audit</em>',
    ];

    const tipEl = document.getElementById('tip-text');
    let tipIdx  = Math.floor(Math.random() * TIPS.length);

    function showTip(html) {
      tipEl.classList.add('fade-out');
      setTimeout(() => {
        tipEl.innerHTML = html.replace(/<kbd>/g, '<span class="tip-kbd">').replace(/<\\/kbd>/g, '</span>');
        tipEl.classList.remove('fade-out');
        tipEl.classList.add('fade-in');
        requestAnimationFrame(() => requestAnimationFrame(() => {
          tipEl.classList.remove('fade-in');
        }));
      }, 360);
    }

    // Show first tip immediately
    tipEl.innerHTML = TIPS[tipIdx].replace(/<kbd>/g, '<span class="tip-kbd">').replace(/<\\/kbd>/g, '</span>');

    // Rotate every 6 seconds
    setInterval(() => {
      tipIdx = (tipIdx + 1) % TIPS.length;
      showTip(TIPS[tipIdx]);
    }, 6000);
  </script>
</body>
</html>`;
  }
}
