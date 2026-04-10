import * as vscode from "vscode";
import * as crypto from "crypto";

/**
 * Generates a cryptographically random nonce for the CSP inline-script rule.
 */
function getNonce(): string {
  return crypto.randomBytes(16).toString("base64");
}

/**
 * Returns the full HTML document string for the dashboard webview.
 * All styles and scripts are inline — no external resources required.
 *
 * @param webview      - The VS Code Webview instance (used to build CSP source)
 * @param extensionUri - Extension root URI (reserved for future local assets)
 */
export function getDashboardHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): string {
  const nonce = getNonce();
  const cspSource = webview.cspSource;
  const logoUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "resources", "icon.svg"),
  );

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             img-src ${cspSource};
             style-src ${cspSource} 'unsafe-inline';
             script-src 'nonce-${nonce}';" />
  <title>Package Manager</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@600;700;800&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --radius-sm: 6px;
      --radius-md: 10px;
      --radius-lg: 14px;
      --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
      --transition-med:  250ms cubic-bezier(0.4, 0, 0.2, 1);
      --shadow-card: 0 1px 3px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.10);
      --shadow-modal: 0 8px 40px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.2);
      --accent-blue:    var(--vscode-charts-blue,    #3b82f6);
      --accent-purple:  var(--vscode-charts-purple,  #a78bfa);
      --accent-yellow:  var(--vscode-editorWarning-foreground, #f59e0b);
      --accent-green:   var(--vscode-charts-green,   #34d399);
      --accent-red:     var(--vscode-errorForeground, #f87171);
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 24px 28px 40px;
      min-height: 100vh;
      line-height: 1.5;
    }

    /* ── Page-load stagger animation ─────────────────────────────────────── */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .header    { animation: fadeUp 0.35s ease both; animation-delay: 0ms; }
    .stats-bar { animation: fadeUp 0.35s ease both; animation-delay: 60ms; }
    .toolbar   { animation: fadeUp 0.35s ease both; animation-delay: 110ms; }
    .table-wrap{ animation: fadeUp 0.35s ease both; animation-delay: 150ms; }

    /* ── Header ─────────────────────────────────────────────────────────── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 12px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .header-title h1 {
      font-family: 'Syne', var(--vscode-font-family), sans-serif;
      font-size: 1.35em;
      font-weight: 700;
      color: var(--vscode-foreground);
      line-height: 1.2;
      display: flex;
      align-items: center;
      gap: 10px;
      letter-spacing: -0.01em;
    }
    .header-title h1 img {
      border-radius: 4px;
      filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent-blue) 40%, transparent));
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    #project-name {
      font-family: 'JetBrains Mono', var(--vscode-editor-font-family, monospace), monospace;
      font-size: 0.75em;
      font-weight: 600;
      letter-spacing: 0.1em;
      color: var(--vscode-descriptionForeground);
      background: color-mix(in srgb, var(--vscode-foreground) 6%, transparent);
      border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 80%, transparent);
      border-radius: var(--radius-sm);
      padding: 4px 10px;
    }
    .header-actions { display: flex; gap: 8px; align-items: center; }

    /* ── Buttons ─────────────────────────────────────────────────────────── */
    button {
      cursor: pointer;
      border: none;
      border-radius: var(--radius-sm);
      padding: 6px 14px;
      font-size: 0.82em;
      font-family: var(--vscode-font-family);
      font-weight: 500;
      transition: all var(--transition-fast);
      display: inline-flex;
      align-items: center;
      gap: 5px;
      letter-spacing: 0.01em;
    }
    .btn-primary {
      background: var(--accent-blue);
      color: #fff;
      box-shadow: 0 1px 4px color-mix(in srgb, var(--accent-blue) 40%, transparent);
    }
    .btn-primary:hover {
      background: color-mix(in srgb, var(--accent-blue) 85%, #fff);
      transform: translateY(-1px);
      box-shadow: 0 3px 10px color-mix(in srgb, var(--accent-blue) 35%, transparent);
    }
    .btn-primary:active { transform: translateY(0); }

    .btn-secondary {
      background: color-mix(in srgb, var(--vscode-foreground) 8%, transparent);
      color: var(--vscode-foreground);
      border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 60%, transparent);
    }
    .btn-secondary:hover {
      background: color-mix(in srgb, var(--vscode-foreground) 13%, transparent);
      transform: translateY(-1px);
    }
    .btn-secondary:active { transform: translateY(0); }

    .btn-danger {
      background: color-mix(in srgb, var(--accent-red) 12%, transparent);
      color: var(--accent-red);
      border: 1px solid color-mix(in srgb, var(--accent-red) 28%, transparent);
    }
    .btn-danger:hover {
      background: color-mix(in srgb, var(--accent-red) 20%, transparent);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--accent-red) 20%, transparent);
    }
    .btn-danger:active { transform: translateY(0); }

    button:disabled {
      opacity: 0.38;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
    }

    /* ── Inline SVG icons ────────────────────────────────────────────────── */
    .icon {
      display: inline-block;
      width: 1em;
      height: 1em;
      vertical-align: -0.15em;
      flex-shrink: 0;
    }

    /* ── Stats bar ───────────────────────────────────────────────────────── */
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 24px;
    }
    @media (max-width: 560px) {
      .stats-bar { grid-template-columns: repeat(2, 1fr); }
    }

    .stat-card {
      background: var(--vscode-editorWidget-background);
      border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, transparent);
      border-radius: var(--radius-lg);
      padding: 18px 20px 16px;
      position: relative;
      overflow: hidden;
      transition: transform var(--transition-fast), box-shadow var(--transition-fast);
      cursor: default;
    }
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-card);
    }

    /* Glowing top-edge accent */
    .stat-card::before {
      content: '';
      position: absolute;
      top: 0; left: 10%; right: 10%;
      height: 2px;
      border-radius: 0 0 4px 4px;
      opacity: 0.9;
    }
    /* Subtle glow blob in corner */
    .stat-card::after {
      content: '';
      position: absolute;
      top: -20px; right: -20px;
      width: 80px; height: 80px;
      border-radius: 50%;
      opacity: 0.07;
      pointer-events: none;
    }
    .stat-card.card-total::before  { background: var(--accent-blue); }
    .stat-card.card-total::after   { background: var(--accent-blue); }
    .stat-card.card-dev::before    { background: var(--accent-purple); }
    .stat-card.card-dev::after     { background: var(--accent-purple); }
    .stat-card.card-unused::before { background: var(--accent-yellow); }
    .stat-card.card-unused::after  { background: var(--accent-yellow); }
    .stat-card.card-outdated::before{ background: var(--accent-green); }
    .stat-card.card-outdated::after { background: var(--accent-green); }

    .stat-label {
      font-size: 0.70em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .stat-value {
      font-family: 'Syne', var(--vscode-font-family), sans-serif;
      font-size: 2.2em;
      font-weight: 800;
      color: var(--vscode-foreground);
      line-height: 1;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
    }

    /* ── Toolbar row (search + tab bar) ──────────────────────────────────── */
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 0;
    }

    /* ── Search ──────────────────────────────────────────────────────────── */
    .search-wrap {
      position: relative;
      flex: 0 0 auto;
    }
    .search-wrap::before {
      content: '⌕';
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--vscode-descriptionForeground);
      pointer-events: none;
      font-size: 1.15em;
      opacity: 0.7;
    }
    #search-input {
      padding: 7px 12px 7px 30px;
      width: 230px;
      background: color-mix(in srgb, var(--vscode-input-background) 100%, transparent);
      color: var(--vscode-input-foreground);
      border: 1px solid color-mix(in srgb, var(--vscode-input-border, var(--vscode-panel-border)) 80%, transparent);
      border-radius: var(--radius-md);
      font-size: var(--vscode-font-size);
      font-family: var(--vscode-font-family);
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }
    #search-input::placeholder { color: var(--vscode-input-placeholderForeground); opacity: 0.7; }
    #search-input:focus {
      outline: none;
      border-color: var(--accent-blue);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-blue) 18%, transparent);
    }

    /* ── Tabs ────────────────────────────────────────────────────────────── */
    .tab-bar {
      display: flex;
      gap: 2px;
      background: color-mix(in srgb, var(--vscode-foreground) 5%, transparent);
      border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 60%, transparent);
      border-radius: var(--radius-md);
      padding: 3px;
      flex: 0 0 auto;
    }
    .tab {
      padding: 5px 14px;
      cursor: pointer;
      border: none;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      border-radius: var(--radius-sm);
      font-size: 0.83em;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 5px;
      font-weight: 500;
      transition: all var(--transition-fast);
    }
    .tab:hover {
      color: var(--vscode-foreground);
      background: color-mix(in srgb, var(--vscode-foreground) 7%, transparent);
    }
    .tab.active {
      color: var(--vscode-foreground);
      background: var(--vscode-editorWidget-background);
      font-weight: 600;
      box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    }
    /* pill badge on tabs */
    .tab-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, var(--accent-blue) 20%, transparent);
      color: var(--accent-blue);
      border-radius: 20px;
      padding: 0 6px;
      font-size: 0.78em;
      font-weight: 700;
      min-width: 20px;
      height: 16px;
      line-height: 1;
    }
    .tab-count.hidden { display: none; }

    /* ── Divider between toolbar and table ───────────────────────────────── */
    .toolbar-divider {
      border: none;
      border-top: 1px solid var(--vscode-panel-border);
      margin: 0;
    }

    /* ── Table ───────────────────────────────────────────────────────────── */
    .table-wrap {
      overflow-x: auto;
      margin-top: 12px;
      border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, transparent);
      border-radius: var(--radius-lg);
      box-shadow: 0 1px 6px rgba(0,0,0,0.08);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.91em;
    }
    thead th {
      text-align: left;
      padding: 10px 16px;
      color: var(--vscode-descriptionForeground);
      background: color-mix(in srgb, var(--vscode-editorWidget-background) 100%, transparent);
      border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, transparent);
      font-weight: 600;
      white-space: nowrap;
      font-size: 0.78em;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      user-select: none;
    }
    thead th:first-child { border-radius: var(--radius-lg) 0 0 0; }
    thead th:last-child  { border-radius: 0 var(--radius-lg) 0 0; }
    thead th[data-sort] {
      cursor: pointer;
      transition: color var(--transition-fast), background var(--transition-fast);
    }
    thead th[data-sort]:hover {
      color: var(--vscode-foreground);
      background: color-mix(in srgb, var(--vscode-foreground) 5%, var(--vscode-editorWidget-background));
    }
    thead th[data-sort].sort-asc,
    thead th[data-sort].sort-desc {
      color: var(--accent-blue);
    }
    .sort-icon {
      display: inline-block;
      margin-left: 5px;
      font-size: 0.85em;
      opacity: 0.35;
      transition: opacity var(--transition-fast);
    }
    th[data-sort]:hover .sort-icon { opacity: 0.7; }
    th[data-sort].sort-asc  .sort-icon,
    th[data-sort].sort-desc .sort-icon { opacity: 1; }
    tbody tr {
      border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 50%, transparent);
      transition: background var(--transition-fast);
    }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:hover { background: color-mix(in srgb, var(--vscode-list-hoverBackground) 100%, transparent); }
    tbody td {
      padding: 10px 16px;
      vertical-align: middle;
    }
    td.col-name {
      font-weight: 600;
      font-size: 0.93em;
    }
    td.col-version,
    td.col-latest {
      font-family: 'JetBrains Mono', var(--vscode-editor-font-family, monospace), monospace;
      font-size: 0.84em;
      letter-spacing: -0.01em;
    }
    td.col-latest span[style] {
      font-family: 'JetBrains Mono', var(--vscode-editor-font-family, monospace), monospace;
      font-size: 1em;
      font-weight: 500;
    }
    .dev-tag {
      display: inline-block;
      font-size: 0.65em;
      color: var(--accent-purple);
      background: color-mix(in srgb, var(--accent-purple) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--accent-purple) 28%, transparent);
      border-radius: 4px;
      padding: 1px 6px;
      margin-left: 6px;
      vertical-align: middle;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .latest-dash { color: var(--vscode-descriptionForeground); opacity: 0.4; }

    .actions-cell { display: flex; gap: 6px; flex-wrap: nowrap; }
    .actions-cell button { padding: 4px 11px; font-size: 0.79em; white-space: nowrap; }

    /* ── Confirm modal ───────────────────────────────────────────────────── */
    #confirm-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 300;
      align-items: center;
      justify-content: center;
    }
    #confirm-backdrop.visible { display: flex; }
    #confirm-modal {
      background: var(--vscode-editorWidget-background);
      border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 60%, transparent);
      border-radius: var(--radius-lg);
      padding: 28px 32px 24px;
      min-width: 320px;
      max-width: 440px;
      box-shadow: var(--shadow-modal);
      animation: fadeUp 0.2s ease both;
    }
    #confirm-modal h3 {
      font-family: 'Syne', var(--vscode-font-family), sans-serif;
      font-size: 1.05em;
      font-weight: 700;
      margin-bottom: 10px;
      color: var(--vscode-foreground);
      letter-spacing: -0.01em;
    }
    #confirm-modal p {
      font-size: 0.88em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 24px;
      line-height: 1.6;
    }
    .confirm-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    /* ── Status badges ───────────────────────────────────────────────────── */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 9px;
      border-radius: 20px;
      font-size: 0.74em;
      font-weight: 600;
      white-space: nowrap;
      letter-spacing: 0.02em;
    }
    .badge-ok   {
      background: color-mix(in srgb, var(--accent-green) 14%, transparent);
      color: var(--accent-green);
      border: 1px solid color-mix(in srgb, var(--accent-green) 30%, transparent);
    }
    .badge-warn {
      background: color-mix(in srgb, var(--accent-yellow) 14%, transparent);
      color: var(--accent-yellow);
      border: 1px solid color-mix(in srgb, var(--accent-yellow) 30%, transparent);
    }
    .badge-up {
      background: color-mix(in srgb, var(--accent-blue) 14%, transparent);
      color: var(--accent-blue);
      border: 1px solid color-mix(in srgb, var(--accent-blue) 30%, transparent);
    }
    .badge-crit {
      background: color-mix(in srgb, var(--accent-red) 14%, transparent);
      color: var(--accent-red);
      border: 1px solid color-mix(in srgb, var(--accent-red) 30%, transparent);
    }

    /* ── Empty state ─────────────────────────────────────────────────────── */
    .empty-state {
      text-align: center;
      padding: 56px 20px;
      color: var(--vscode-descriptionForeground);
    }
    .empty-state-icon {
      margin-bottom: 14px;
      opacity: 0.35;
    }
    .empty-state-icon svg { display: block; margin: 0 auto; }
    .empty-state-msg {
      font-size: 0.92em;
      line-height: 1.5;
      max-width: 280px;
      margin: 0 auto;
    }

    /* ── Loading overlay ─────────────────────────────────────────────────── */
    #loading-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: color-mix(in srgb, var(--vscode-editor-background) 75%, transparent);
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
      z-index: 100;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 16px;
      color: var(--vscode-foreground);
    }
    #loading-overlay.visible { display: flex; }
    .spinner {
      width: 32px; height: 32px;
      border: 2.5px solid color-mix(in srgb, var(--vscode-panel-border) 80%, transparent);
      border-top-color: var(--accent-blue);
      border-radius: 50%;
      animation: spin 0.7s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      box-shadow: 0 0 12px color-mix(in srgb, var(--accent-blue) 25%, transparent);
    }
    #loading-label {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      letter-spacing: 0.02em;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Toast ───────────────────────────────────────────────────────────── */
    #toast {
      position: fixed;
      bottom: 28px;
      right: 28px;
      padding: 11px 18px;
      border-radius: var(--radius-md);
      font-size: 0.86em;
      z-index: 200;
      max-width: 320px;
      box-shadow: 0 6px 24px rgba(0,0,0,0.3);
      opacity: 0;
      transform: translateY(10px) scale(0.97);
      transition: opacity 0.22s ease, transform 0.22s ease;
      pointer-events: none;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #toast::before {
      content: '';
      display: block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    #toast.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    #toast.success {
      background: var(--vscode-editorWidget-background);
      border: 1px solid color-mix(in srgb, var(--accent-green) 35%, transparent);
      color: var(--vscode-foreground);
    }
    #toast.success::before { background: var(--accent-green); box-shadow: 0 0 6px var(--accent-green); }
    #toast.error {
      background: var(--vscode-editorWidget-background);
      border: 1px solid color-mix(in srgb, var(--accent-red) 35%, transparent);
      color: var(--vscode-foreground);
    }
    #toast.error::before { background: var(--accent-red); box-shadow: 0 0 6px var(--accent-red); }
  </style>
</head>
<body>

  <!-- Loading overlay -->
  <div id="loading-overlay" role="status" aria-live="polite">
    <div class="spinner"></div>
    <span id="loading-label">Working…</span>
  </div>

  <!-- Toast notification -->
  <div id="toast" role="alert" aria-live="assertive" aria-atomic="true"></div>

  <!-- Header -->
  <div class="header">
    <div class="header-title">
      <h1><img src="${logoUri}" alt="PackSight" style="height: 1.5em; width: 1.5em;" /> PackSight Dashboard</h1>
    </div>
    <div class="header-right">
      <div id="project-name"></div>
      <div class="header-actions">
        <button class="btn-secondary" id="btn-refresh" title="Refresh dependency data">↺ Refresh</button>
      </div>
    </div>
  </div>

  <!-- Stats bar -->
  <div class="stats-bar" aria-label="Dependency statistics">
    <div class="stat-card card-total">
      <div class="stat-label">Total Deps</div>
      <div class="stat-value" id="stat-total">—</div>
    </div>
    <div class="stat-card card-dev">
      <div class="stat-label">Dev Deps</div>
      <div class="stat-value" id="stat-dev">—</div>
    </div>
    <div class="stat-card card-unused">
      <div class="stat-label">
        <svg class="icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 1.5a.5.5 0 0 1 .44.26l6 10.5A.5.5 0 0 1 14 13H2a.5.5 0 0 1-.44-.74l6-10.5A.5.5 0 0 1 8 1.5zm0 1.06L2.87 12h10.26L8 2.56zM8 6a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-3A.5.5 0 0 1 8 6zm0 5.5a.6.6 0 1 1 0 1.2.6.6 0 0 1 0-1.2z" fill="currentColor"/></svg>
        Unused
      </div>
      <div class="stat-value" id="stat-unused">—</div>
    </div>
    <div class="stat-card card-outdated">
      <div class="stat-label">
        <svg class="icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 2a.5.5 0 0 1 .5.5v7.793l2.646-2.647a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L7.5 10.293V2.5A.5.5 0 0 1 8 2zM2 13.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z" fill="currentColor"/></svg>
        Outdated
      </div>
      <div class="stat-value" id="stat-outdated">—</div>
    </div>
  </div>

  <!-- Toolbar: search left, tabs right -->
  <div class="toolbar">
    <div class="search-wrap">
      <input type="search" id="search-input" placeholder="Search packages…" aria-label="Search packages" autocomplete="off" />
    </div>
    <div class="tab-bar" role="tablist" aria-label="Filter packages">
      <button class="tab active" role="tab" aria-selected="true"  data-tab="all">
        All <span class="tab-count" id="tc-all"></span>
      </button>
      <button class="tab" role="tab" aria-selected="false" data-tab="unused">
        <svg class="icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 1.5a.5.5 0 0 1 .44.26l6 10.5A.5.5 0 0 1 14 13H2a.5.5 0 0 1-.44-.74l6-10.5A.5.5 0 0 1 8 1.5zm0 1.06L2.87 12h10.26L8 2.56zM8 6a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-3A.5.5 0 0 1 8 6zm0 5.5a.6.6 0 1 1 0 1.2.6.6 0 0 1 0-1.2z" fill="currentColor"/></svg>
        Unused <span class="tab-count hidden" id="tc-unused"></span>
      </button>
      <button class="tab" role="tab" aria-selected="false" data-tab="outdated">
        <svg class="icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 2a.5.5 0 0 1 .5.5v7.793l2.646-2.647a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L7.5 10.293V2.5A.5.5 0 0 1 8 2zM2 13.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z" fill="currentColor"/></svg>
        Outdated <span class="tab-count hidden" id="tc-outdated"></span>
      </button>
      <button class="tab" role="tab" aria-selected="false" data-tab="dev">
        Dev <span class="tab-count hidden" id="tc-dev"></span>
      </button>
    </div>
  </div>

  <!-- Package table -->
  <div class="table-wrap">
    <table aria-label="Package list">
      <thead>
        <tr>
          <th data-sort="name">Name <span class="sort-icon">↕</span></th>
          <th data-sort="version">Version <span class="sort-icon">↕</span></th>
          <th data-sort="latest">Latest <span class="sort-icon">↕</span></th>
          <th data-sort="status">Status <span class="sort-icon">↕</span></th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="pkg-tbody">
        <tr>
          <td colspan="5">
            <div class="empty-state">
              <div class="empty-state-icon">
                <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="36"><path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 1a6 6 0 1 0 0 12A6 6 0 0 0 8 2zm0 2.5a.5.5 0 0 1 .5.5v3.25l2.25 1.3a.5.5 0 0 1-.5.866L7.75 9.6A.5.5 0 0 1 7.5 9.5V4a.5.5 0 0 1 .5-.5z" fill="currentColor"/></svg>
              </div>
              <div class="empty-state-msg">Loading dependencies…</div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Confirm modal -->
  <div id="confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <div id="confirm-modal">
      <h3 id="confirm-title"></h3>
      <p id="confirm-body"></p>
      <div class="confirm-actions">
        <button class="btn-secondary" id="confirm-cancel">Cancel</button>
        <button id="confirm-ok"></button>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // ── State ──────────────────────────────────────────────────────────────
    let allPackages = [];
    let activeTab   = 'all';
    let searchQuery = '';
    let isLoading   = false;
    let sortKey     = 'name';   // 'name' | 'version' | 'latest' | 'status'
    let sortDir     = 'asc';    // 'asc' | 'desc'

    // ── Count-up animation ─────────────────────────────────────────────────
    function animateCount(el, target) {
      const duration = 500; // ms
      const start    = performance.now();
      const from     = parseInt(el.textContent, 10) || 0;

      function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(from + (target - from) * eased);
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    // ── Stats + tab badge update ───────────────────────────────────────────
    function updateStats() {
      const total    = allPackages.length;
      const dev      = allPackages.filter(p => p.isDev).length;
      const unused   = allPackages.filter(p => p.isUnused).length;
      const outdated = allPackages.filter(p => p.latest !== null).length;

      animateCount(document.getElementById('stat-total'),    total);
      animateCount(document.getElementById('stat-dev'),      dev);
      animateCount(document.getElementById('stat-unused'),   unused);
      animateCount(document.getElementById('stat-outdated'), outdated);

      // Tab badge pills
      setTabCount('tc-all',      total,    true);
      setTabCount('tc-unused',   unused,   unused > 0);
      setTabCount('tc-outdated', outdated, outdated > 0);
      setTabCount('tc-dev',      dev,      dev > 0);
    }

    function setTabCount(id, value, show) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = value;
      el.classList.toggle('hidden', !show);
    }

    // ── HTML escaping ──────────────────────────────────────────────────────
    function esc(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    // ── Status badge ───────────────────────────────────────────────────────
    const ICON_WARN = '<svg class="icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 1.5a.5.5 0 0 1 .44.26l6 10.5A.5.5 0 0 1 14 13H2a.5.5 0 0 1-.44-.74l6-10.5A.5.5 0 0 1 8 1.5zm0 1.06L2.87 12h10.26L8 2.56zM8 6a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-3A.5.5 0 0 1 8 6zm0 5.5a.6.6 0 1 1 0 1.2.6.6 0 0 1 0-1.2z" fill="currentColor"/></svg>';
    const ICON_UP   = '<svg class="icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 2a.5.5 0 0 1 .5.5v7.793l2.646-2.647a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L7.5 10.293V2.5A.5.5 0 0 1 8 2zM2 13.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z" fill="currentColor"/></svg>';
    const ICON_OK   = '<svg class="icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" fill="currentColor"/></svg>';
    const ICON_CRIT = '<svg class="icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 1a6 6 0 1 0 0 12A6 6 0 0 0 8 2zm0 3a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0v-4A.5.5 0 0 1 8 5zm0 6.5a.6.6 0 1 1 0 1.2.6.6 0 0 1 0-1.2z" fill="currentColor"/></svg>';

    function statusBadge(pkg) {
      const outdated = pkg.latest !== null;
      if (pkg.isUnused && outdated)
        return '<span class="badge badge-crit">' + ICON_CRIT + ' Unused + Outdated</span>';
      if (pkg.isUnused)
        return '<span class="badge badge-warn">' + ICON_WARN + ' Unused</span>';
      if (outdated)
        return '<span class="badge badge-up">'   + ICON_UP   + ' Update Available</span>';
      return   '<span class="badge badge-ok">'   + ICON_OK   + ' OK</span>';
    }

    // ── Sort ───────────────────────────────────────────────────────────────
    function statusRank(pkg) {
      // crit=0, warn=1, up=2, ok=3 — so ascending puts worst first
      if (pkg.isUnused && pkg.latest !== null) return 0;
      if (pkg.isUnused)                        return 1;
      if (pkg.latest !== null)                 return 2;
      return 3;
    }

    function sortedPackages(pkgs) {
      return [...pkgs].sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case 'name':    cmp = a.name.localeCompare(b.name); break;
          case 'version': cmp = a.version.localeCompare(b.version, undefined, { numeric: true }); break;
          case 'latest':
            // null (up-to-date) sorts after packages that have an update
            if (a.latest === b.latest) { cmp = 0; break; }
            if (a.latest === null)     { cmp = 1; break; }
            if (b.latest === null)     { cmp = -1; break; }
            cmp = a.latest.localeCompare(b.latest, undefined, { numeric: true });
            break;
          case 'status':  cmp = statusRank(a) - statusRank(b); break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    function updateSortHeaders() {
      document.querySelectorAll('thead th[data-sort]').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        th.querySelector('.sort-icon').textContent = '↕';
        if (th.dataset.sort === sortKey) {
          th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
          th.querySelector('.sort-icon').textContent = sortDir === 'asc' ? '↑' : '↓';
        }
      });
    }

    // ── Filtering ──────────────────────────────────────────────────────────
    function filteredPackages() {
      return allPackages.filter(pkg => {
        const matchesTab =
          activeTab === 'all'      ? true :
          activeTab === 'unused'   ? pkg.isUnused :
          activeTab === 'outdated' ? pkg.latest !== null :
          activeTab === 'dev'      ? pkg.isDev : true;
        return matchesTab && pkg.name.toLowerCase().includes(searchQuery);
      });
    }

    // ── Table render ───────────────────────────────────────────────────────
    function renderTable() {
      const tbody = document.getElementById('pkg-tbody');
      const pkgs  = sortedPackages(filteredPackages());

      if (pkgs.length === 0) {
        let icon = '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="36"><path d="M11.5 1a.5.5 0 0 1 .5.5v1h1.5a.5.5 0 0 1 0 1H13v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5H2.5a.5.5 0 0 1 0-1H4v-1a.5.5 0 0 1 1 0v1h6v-1a.5.5 0 0 1 .5-.5zM5.5 6a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 1 0v-5a.5.5 0 0 0-.5-.5zm5 0a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 1 0v-5a.5.5 0 0 0-.5-.5zm-2.5 0a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 1 0v-5a.5.5 0 0 0-.5-.5z" fill="currentColor"/></svg>';
        let msg  = 'No packages match your search.';

        if (!searchQuery) {
          if (activeTab === 'unused') {
            icon = '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="36"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" fill="currentColor"/></svg>';
            msg  = 'All dependencies are in use.';
          } else if (activeTab === 'outdated') {
            icon = '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="36"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" fill="currentColor"/></svg>';
            msg  = 'Everything is up to date.';
          } else if (activeTab === 'dev') {
            icon = '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="36"><path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 1a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM5.5 5.5h5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5zm.5 1v3h4V6.5H6z" fill="currentColor"/></svg>';
            msg  = 'No dev dependencies found.';
          } else {
            icon = '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="36"><path d="M8 1.5a.5.5 0 0 1 .44.26l6 10.5A.5.5 0 0 1 14 13H2a.5.5 0 0 1-.44-.74l6-10.5A.5.5 0 0 1 8 1.5zm0 1.06L2.87 12h10.26L8 2.56zM8 6a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-3A.5.5 0 0 1 8 6zm0 5.5a.6.6 0 1 1 0 1.2.6.6 0 0 1 0-1.2z" fill="currentColor"/></svg>';
            msg  = 'No packages found. Open a project with a package.json.';
          }
        }

        tbody.innerHTML =
          '<tr><td colspan="5"><div class="empty-state">' +
          '<div class="empty-state-icon">' + icon + '</div>' +
          '<div class="empty-state-msg">' + esc(msg) + '</div>' +
          '</div></td></tr>';
        return;
      }

      tbody.innerHTML = pkgs.map(pkg => {
        const latestCell = pkg.latest
          ? '<span style="color:var(--vscode-charts-green,#4caf50)">' + esc(pkg.latest) + '</span>'
          : '<span class="latest-dash">—</span>';

        const devTag = pkg.isDev ? '<span class="dev-tag">dev</span>' : '';

        const updateBtn = pkg.latest !== null
          ? \`<button class="btn-primary btn-update"
               data-name="\${esc(pkg.name)}"
               title="Update \${esc(pkg.name)} to \${esc(pkg.latest ?? '')}">Update</button>\`
          : '';

        return \`<tr>
          <td class="col-name">\${esc(pkg.name)}\${devTag}</td>
          <td class="col-version">\${esc(pkg.version)}</td>
          <td class="col-latest">\${latestCell}</td>
          <td>\${statusBadge(pkg)}</td>
          <td class="actions-cell">
            \${updateBtn}
            <button class="btn-danger btn-uninstall"
              data-name="\${esc(pkg.name)}"
              data-dev="\${pkg.isDev}"
              title="Uninstall \${esc(pkg.name)}">Uninstall</button>
          </td>
        </tr>\`;
      }).join('');
    }

    // ── Toast ──────────────────────────────────────────────────────────────
    let toastTimer = null;
    function showToast(msg, type) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      // reset then re-apply so transition re-fires
      el.className = type;
      requestAnimationFrame(() => el.classList.add('visible'));
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        el.classList.remove('visible');
      }, 3000);
    }

    // ── Loading overlay + button lock ──────────────────────────────────────
    function setLoading(visible, label) {
      isLoading = visible;
      const overlay = document.getElementById('loading-overlay');
      document.getElementById('loading-label').textContent = label || 'Working…';
      overlay.classList.toggle('visible', visible);

      // Disable interactive controls while an operation is running
      document.getElementById('btn-refresh').disabled = visible;
      document.querySelectorAll('.btn-update, .btn-uninstall').forEach(btn => {
        btn.disabled = visible;
      });
    }

    // ── Messages from extension ────────────────────────────────────────────
    window.addEventListener('message', event => {
      const msg = event.data;
      switch (msg.command) {
        case 'loadData': {
          allPackages = msg.payload.packages;
          const parts = msg.payload.workspaceRoot.split('\\\\').join('/').split('/');
          const nameEl = document.getElementById('project-name');
          if (nameEl) nameEl.textContent = (parts[parts.length - 1] || '').toUpperCase();
          updateStats();
          renderTable();
          setLoading(false);
          break;
        }
        case 'operationStart':
          setLoading(true, 'Running npm for ' + msg.packageName + '…');
          break;
        case 'operationSuccess':
          setLoading(false);
          showToast(msg.message, 'success');
          break;
        case 'operationError':
          setLoading(false);
          showToast(msg.message, 'error');
          break;
      }
    });

    // ── User interactions ──────────────────────────────────────────────────
    document.getElementById('btn-refresh').addEventListener('click', () => {
      setLoading(true, 'Refreshing…');
      vscode.postMessage({ command: 'refresh' });
    });

    document.getElementById('search-input').addEventListener('input', e => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderTable();
    });

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        activeTab = tab.dataset.tab;
        renderTable();
      });
    });

    // ── Sort header clicks ─────────────────────────────────────────────────
    document.querySelectorAll('thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (sortKey === key) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortKey = key;
          sortDir = 'asc';
        }
        updateSortHeaders();
        renderTable();
      });
    });

    // ── Confirm modal ──────────────────────────────────────────────────────
    let pendingAction = null;

    function showConfirm(title, body, okLabel, okClass, onConfirm) {
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-body').textContent  = body;
      const okBtn = document.getElementById('confirm-ok');
      okBtn.textContent  = okLabel;
      okBtn.className    = okClass;
      pendingAction      = onConfirm;
      document.getElementById('confirm-backdrop').classList.add('visible');
      okBtn.focus();
    }

    function closeConfirm() {
      document.getElementById('confirm-backdrop').classList.remove('visible');
      pendingAction = null;
    }

    document.getElementById('confirm-cancel').addEventListener('click', closeConfirm);
    document.getElementById('confirm-backdrop').addEventListener('click', e => {
      if (e.target === document.getElementById('confirm-backdrop')) closeConfirm();
    });
    document.getElementById('confirm-ok').addEventListener('click', () => {
      if (pendingAction) { pendingAction(); }
      closeConfirm();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeConfirm();
    });

    // ── Event delegation for Update / Uninstall buttons ────────────────────
    document.getElementById('pkg-tbody').addEventListener('click', e => {
      const target = e.target;
      if (!(target instanceof HTMLButtonElement)) return;

      if (target.classList.contains('btn-update')) {
        const name = target.dataset.name;
        showConfirm(
          'Update Package',
          'Update "' + name + '" to the latest version?',
          'Update',
          'btn-primary',
          () => vscode.postMessage({ command: 'update', packageName: name })
        );
      } else if (target.classList.contains('btn-uninstall')) {
        const name   = target.dataset.name;
        const isDev  = target.dataset.dev === 'true';
        showConfirm(
          'Uninstall Package',
          'Are you sure you want to uninstall "' + name + '"? This cannot be undone.',
          'Uninstall',
          'btn-danger',
          () => vscode.postMessage({ command: 'uninstall', packageName: name, isDev })
        );
      }
    });

    // Signal the extension that the webview DOM is ready and can receive messages.
    // The extension listener is registered before html is set, so this is always heard.
    vscode.postMessage({ command: 'ready' });
  </script>
</body>
</html>`;
}
