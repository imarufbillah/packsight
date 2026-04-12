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
  const codiconCssUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "node_modules", "@vscode", "codicons", "dist", "codicon.css"),
  );

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             img-src ${cspSource};
             font-src ${cspSource};
             style-src ${cspSource} 'unsafe-inline';
             script-src 'nonce-${nonce}';" />
  <title>Package Manager</title>
  <link rel="stylesheet" href="${codiconCssUri}" />
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
      padding: 28px 32px 48px;
      min-height: 100vh;
      line-height: 1.6;
      zoom: var(--ui-scale, 1);
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
      font-size: 1.5em;
      font-weight: 700;
      color: var(--vscode-foreground);
      line-height: 1.2;
      display: flex;
      align-items: center;
      gap: 12px;
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
      font-size: 0.82em;
      font-weight: 600;
      letter-spacing: 0.1em;
      color: var(--vscode-descriptionForeground);
      background: color-mix(in srgb, var(--vscode-foreground) 6%, transparent);
      border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 80%, transparent);
      border-radius: var(--radius-sm);
      padding: 5px 12px;
    }
    .header-actions { display: flex; gap: 8px; align-items: center; }

    /* ── UI scale control ────────────────────────────────────────────────── */
    .scale-control {
      display: flex;
      align-items: center;
      gap: 0;
      background: color-mix(in srgb, var(--vscode-foreground) 6%, transparent);
      border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, transparent);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }
    .scale-btn {
      background: transparent;
      border: none;
      border-radius: 0;
      color: var(--vscode-foreground);
      font-size: 1em;
      font-weight: 600;
      width: 26px;
      height: 26px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background var(--transition-fast);
      line-height: 1;
    }
    .scale-btn:hover { background: color-mix(in srgb, var(--vscode-foreground) 12%, transparent); }
    .scale-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    #scale-label {
      font-family: 'JetBrains Mono', var(--vscode-editor-font-family, monospace), monospace;
      font-size: 0.72em;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      min-width: 36px;
      text-align: center;
      padding: 0 2px;
      border-left: 1px solid color-mix(in srgb, var(--vscode-panel-border) 60%, transparent);
      border-right: 1px solid color-mix(in srgb, var(--vscode-panel-border) 60%, transparent);
      cursor: default;
      user-select: none;
    }

    /* ── Buttons ─────────────────────────────────────────────────────────── */
    button {
      cursor: pointer;
      border: none;
      border-radius: var(--radius-sm);
      padding: 7px 16px;
      font-size: 0.88em;
      font-family: var(--vscode-font-family);
      font-weight: 500;
      transition: all var(--transition-fast);
      display: inline-flex;
      align-items: center;
      gap: 6px;
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
      width: 1.1em;
      height: 1.1em;
      vertical-align: -0.15em;
      flex-shrink: 0;
    }

    /* ── Stats bar ───────────────────────────────────────────────────────── */
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      margin-bottom: 28px;
    }
    @media (max-width: 560px) {
      .stats-bar { grid-template-columns: repeat(2, 1fr); }
    }

    .stat-card {
      background: var(--vscode-editorWidget-background);
      border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, transparent);
      border-radius: var(--radius-lg);
      padding: 22px 24px 20px;
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
    .stat-card.card-security::before{ background: var(--accent-red); }
    .stat-card.card-security::after { background: var(--accent-red); }
    .stat-card.card-security.secure::before{ background: var(--accent-green); }
    .stat-card.card-security.secure::after { background: var(--accent-green); }
    /* Security stat value colours */
    #stat-security.has-vulns { color: var(--accent-red); }
    #stat-security.is-secure  { color: var(--accent-green); font-size: 1.1em; }

    .stat-label {
      font-size: 0.76em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .stat-value {
      font-family: 'Syne', var(--vscode-font-family), sans-serif;
      font-size: 2.6em;
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
      padding: 8px 14px 8px 34px;
      width: 260px;
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

    /* ── Runtime version badges ──────────────────────────────────────────── */
    .runtime-badges {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
    }
    .runtime-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: var(--radius-sm);
      font-family: 'JetBrains Mono', var(--vscode-editor-font-family, monospace), monospace;
      font-size: 0.82em;
      font-weight: 600;
      letter-spacing: 0.02em;
      border: 1px solid transparent;
      white-space: nowrap;
    }
    .runtime-badge-node {
      color: #4ade80;
      background: color-mix(in srgb, #4ade80 10%, transparent);
      border-color: color-mix(in srgb, #4ade80 25%, transparent);
    }
    .runtime-badge-npm {
      color: #f87171;
      background: color-mix(in srgb, #f87171 10%, transparent);
      border-color: color-mix(in srgb, #f87171 25%, transparent);
    }
    .runtime-badge svg { flex-shrink: 0; }

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
      padding: 6px 16px;
      cursor: pointer;
      border: none;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      border-radius: var(--radius-sm);
      font-size: 0.88em;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 6px;
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
      padding: 0 7px;
      font-size: 0.82em;
      font-weight: 700;
      min-width: 22px;
      height: 18px;
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
      margin-top: 14px;
      border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, transparent);
      border-radius: var(--radius-lg);
      box-shadow: 0 1px 6px rgba(0,0,0,0.08);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.97em;
    }
    thead th {
      text-align: left;
      padding: 12px 18px;
      color: var(--vscode-descriptionForeground);
      background: color-mix(in srgb, var(--vscode-editorWidget-background) 100%, transparent);
      border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, transparent);
      font-weight: 600;
      white-space: nowrap;
      font-size: 0.82em;
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
      padding: 12px 18px;
      vertical-align: middle;
    }
    td.col-name {
      font-weight: 600;
      font-size: 0.97em;
    }
    .pkg-name-link {
      cursor: pointer;
      color: var(--accent-blue);
      border-bottom: 1px solid color-mix(in srgb, var(--accent-blue) 35%, transparent);
      transition: border-bottom-color var(--transition-fast);
    }
    .pkg-name-link:hover {
      border-bottom-color: var(--accent-blue);
    }
    td.col-version,
    td.col-latest {
      font-family: 'JetBrains Mono', var(--vscode-editor-font-family, monospace), monospace;
      font-size: 0.90em;
      letter-spacing: -0.01em;
    }
    td.col-latest span[style] {
      font-family: 'JetBrains Mono', var(--vscode-editor-font-family, monospace), monospace;
      font-size: 1em;
      font-weight: 500;
    }
    .dev-tag {
      display: inline-block;
      font-size: 0.70em;
      color: var(--accent-purple);
      background: color-mix(in srgb, var(--accent-purple) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--accent-purple) 28%, transparent);
      border-radius: 4px;
      padding: 2px 7px;
      margin-left: 6px;
      vertical-align: middle;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    /* ── Vulnerability icon in name column ───────────────────────────────── */
    .vuln-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 6px;
      vertical-align: middle;
      cursor: default;
      flex-shrink: 0;
    }
    .vuln-icon svg { display: block; }
    .vuln-critical { color: #f87171; }
    .vuln-high     { color: #fb923c; }
    .vuln-moderate { color: #fbbf24; }
    .vuln-low      { color: #a3e635; }
    .vuln-secure   { color: var(--accent-green); opacity: 0.7; }
    .latest-dash { color: var(--vscode-descriptionForeground); opacity: 0.4; }
    td.col-date {
      font-family: 'JetBrains Mono', var(--vscode-editor-font-family, monospace), monospace;
      font-size: 0.88em;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
    }
    td.col-size {
      font-family: 'JetBrains Mono', var(--vscode-editor-font-family, monospace), monospace;
      font-size: 0.88em;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
    }

    .actions-cell { display: flex; gap: 6px; flex-wrap: nowrap; }
    .actions-cell button { padding: 5px 13px; font-size: 0.84em; white-space: nowrap; }

    /* ── Checkbox column ─────────────────────────────────────────────────── */
    .col-check { width: 36px; padding-left: 16px !important; }
    .col-check input[type="checkbox"] {
      width: 16px; height: 16px;
      cursor: pointer;
      accent-color: var(--accent-blue);
    }

    /* ── Bulk action bar ─────────────────────────────────────────────────── */
    #bulk-bar {
      display: none;
      align-items: center;
      gap: 12px;
      padding: 10px 18px;
      margin-top: 14px;
      background: color-mix(in srgb, var(--accent-blue) 10%, var(--vscode-editorWidget-background));
      border: 1px solid color-mix(in srgb, var(--accent-blue) 30%, transparent);
      border-radius: var(--radius-md);
      font-size: 0.90em;
      animation: fadeUp 0.15s ease both;
    }
    #bulk-bar.visible { display: flex; }
    #bulk-bar-label { color: var(--vscode-foreground); font-weight: 600; flex: 1; }
    #bulk-bar-label span { color: var(--accent-blue); }

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
    /* Version upgrade arrow shown in update confirm modal */
    #confirm-version-arrow {
      display: none;
      align-items: center;
      gap: 10px;
      margin: 14px 0 20px;
      padding: 12px 16px;
      background: color-mix(in srgb, var(--vscode-foreground) 4%, transparent);
      border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 60%, transparent);
      border-radius: var(--radius-md);
    }
    #confirm-version-arrow.visible { display: flex; }
    .ver-chip {
      font-family: 'JetBrains Mono', var(--vscode-editor-font-family, monospace), monospace;
      font-size: 0.85em;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: var(--radius-sm);
      white-space: nowrap;
    }
    .ver-chip-from {
      color: var(--vscode-descriptionForeground);
      background: color-mix(in srgb, var(--vscode-foreground) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, transparent);
    }
    .ver-chip-to {
      color: var(--accent-green);
      background: color-mix(in srgb, var(--accent-green) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--accent-green) 28%, transparent);
    }
    .ver-arrow {
      color: var(--vscode-descriptionForeground);
      font-size: 1em;
      opacity: 0.6;
      flex-shrink: 0;
    }
    .ver-bump-tag {
      margin-left: auto;
      font-size: 0.70em;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 20px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .ver-bump-major { color: var(--accent-red);    background: color-mix(in srgb, var(--accent-red)    12%, transparent); border: 1px solid color-mix(in srgb, var(--accent-red)    28%, transparent); }
    .ver-bump-minor { color: var(--accent-blue);   background: color-mix(in srgb, var(--accent-blue)   12%, transparent); border: 1px solid color-mix(in srgb, var(--accent-blue)   28%, transparent); }
    .ver-bump-patch { color: var(--accent-green);  background: color-mix(in srgb, var(--accent-green)  12%, transparent); border: 1px solid color-mix(in srgb, var(--accent-green)  28%, transparent); }
    /* Bulk update package list */
    #confirm-bulk-list {
      display: none;
      flex-direction: column;
      gap: 0;
      margin: 14px 0 20px;
      border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 60%, transparent);
      border-radius: var(--radius-md);
      overflow: hidden;
      max-height: 220px;
      overflow-y: auto;
    }
    #confirm-bulk-list.visible { display: flex; }
    .bulk-list-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 12px;
      border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 40%, transparent);
      font-size: 0.83em;
    }
    .bulk-list-row:last-child { border-bottom: none; }
    .bulk-list-row:nth-child(odd) {
      background: color-mix(in srgb, var(--vscode-foreground) 3%, transparent);
    }
    .bulk-list-name {
      font-weight: 600;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bulk-list-versions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
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
      gap: 5px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.80em;
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
    .badge-up-major {
      background: color-mix(in srgb, var(--accent-red) 14%, transparent);
      color: var(--accent-red);
      border: 1px solid color-mix(in srgb, var(--accent-red) 30%, transparent);
    }
    .badge-up-minor {
      background: color-mix(in srgb, var(--accent-blue) 14%, transparent);
      color: var(--accent-blue);
      border: 1px solid color-mix(in srgb, var(--accent-blue) 30%, transparent);
    }
    .badge-up-patch {
      background: color-mix(in srgb, var(--accent-green) 14%, transparent);
      color: var(--accent-green);
      border: 1px solid color-mix(in srgb, var(--accent-green) 30%, transparent);
    }
    .badge-crit {
      background: color-mix(in srgb, var(--accent-red) 14%, transparent);
      color: var(--accent-red);
      border: 1px solid color-mix(in srgb, var(--accent-red) 30%, transparent);
    }

    /* ── Empty state ─────────────────────────────────────────────────────── */
    .empty-state {
      text-align: center;
      padding: 64px 20px;
      color: var(--vscode-descriptionForeground);
    }
    .empty-state-icon {
      margin-bottom: 16px;
      opacity: 0.35;
    }
    .empty-state-icon svg { display: block; margin: 0 auto; }
    .empty-state-msg {
      font-size: 0.97em;
      line-height: 1.5;
      max-width: 300px;
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
    /* ── Changelog column (no header, right of Actions) ─────────────────── */
    .col-changelog {
      // width: 40px;
      padding: 0 6px 0 0 !important;
      text-align: left;
    }
    .btn-changelog-wrap {
      display: inline-flex;
    }
    .btn-changelog {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      font-size: 18px;
      opacity: 0;
      visibility: hidden;
      transition: opacity var(--transition-fast), visibility var(--transition-fast),
                  background var(--transition-fast), color var(--transition-fast),
                  border-color var(--transition-fast);
      cursor: pointer;
    }
    tr:hover .btn-changelog {
      opacity: 1;
      visibility: visible;
    }
    .btn-changelog:hover {
      background: color-mix(in srgb, var(--accent-blue) 12%, transparent);
      color: var(--accent-blue);
      border-color: color-mix(in srgb, var(--accent-blue) 28%, transparent);
    }
    /* Custom tooltip — rendered via JS into a fixed-position singleton
       so it escapes overflow:auto on .table-wrap */
    #ps-tooltip {
      position: fixed;
      background: var(--vscode-editorWidget-background);
      color: var(--vscode-foreground);
      border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 80%, transparent);
      border-radius: var(--radius-sm);
      padding: 6px 12px;
      font-size: 0.82em;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 4px 14px rgba(0,0,0,0.28);
      opacity: 0;
      transform: scale(0.92);
      transition: opacity 120ms ease, transform 120ms ease;
      z-index: 9999;
    }
    #ps-tooltip.visible {
      opacity: 1;
      transform: scale(1);
    }

    /* ── Browse & Install panel ──────────────────────────────────────────── */
    #browse-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
      z-index: 400;
      align-items: flex-start;
      justify-content: flex-end;
    }
    #browse-backdrop.visible { display: flex; }
    #browse-panel {
      width: 420px;
      max-width: 95vw;
      height: 100vh;
      background: var(--vscode-editorWidget-background);
      border-left: 1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, transparent);
      display: flex;
      flex-direction: column;
      box-shadow: -8px 0 32px rgba(0,0,0,0.3);
      animation: slideInRight 0.22s cubic-bezier(0.4,0,0.2,1) both;
    }
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    .browse-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 20px 16px;
      border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 60%, transparent);
      flex-shrink: 0;
    }
    .browse-header h2 {
      font-family: 'Syne', var(--vscode-font-family), sans-serif;
      font-size: 1.05em;
      font-weight: 700;
      color: var(--vscode-foreground);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #browse-close {
      background: transparent;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      padding: 4px;
      border-radius: var(--radius-sm);
      font-size: 18px;
      display: flex;
      align-items: center;
      transition: color var(--transition-fast), background var(--transition-fast);
    }
    #browse-close:hover {
      color: var(--vscode-foreground);
      background: color-mix(in srgb, var(--vscode-foreground) 8%, transparent);
    }
    .browse-search-wrap {
      padding: 14px 16px;
      border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 50%, transparent);
      flex-shrink: 0;
      display: flex;
      gap: 8px;
    }
    #browse-search-input {
      flex: 1;
      padding: 9px 14px;
      background: color-mix(in srgb, var(--vscode-input-background) 100%, transparent);
      color: var(--vscode-input-foreground);
      border: 1px solid color-mix(in srgb, var(--vscode-input-border, var(--vscode-panel-border)) 80%, transparent);
      border-radius: var(--radius-md);
      font-size: 0.93em;
      font-family: var(--vscode-font-family);
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }
    #browse-search-input::placeholder { color: var(--vscode-input-placeholderForeground); opacity: 0.7; }
    #browse-search-input:focus {
      outline: none;
      border-color: var(--accent-blue);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-blue) 18%, transparent);
    }
    #browse-search-btn {
      padding: 9px 16px;
      font-size: 0.88em;
      flex-shrink: 0;
    }
    #browse-results {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
    }
    .browse-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 48px 24px;
      color: var(--vscode-descriptionForeground);
      font-size: 0.88em;
      text-align: center;
      height: 100%;
    }
    .browse-state svg { opacity: 0.35; }
    .browse-result-item {
      padding: 12px 16px;
      border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 40%, transparent);
      transition: background var(--transition-fast);
    }
    .browse-result-item:last-child { border-bottom: none; }
    .browse-result-item:hover {
      background: color-mix(in srgb, var(--vscode-list-hoverBackground) 100%, transparent);
    }
    .browse-result-top {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 4px;
    }
    .browse-result-name {
      font-weight: 700;
      font-size: 0.93em;
      color: var(--accent-blue);
      cursor: pointer;
    }
    .browse-result-name:hover { text-decoration: underline; }
    .browse-result-version {
      font-family: 'JetBrains Mono', var(--vscode-editor-font-family, monospace), monospace;
      font-size: 0.78em;
      color: var(--vscode-descriptionForeground);
    }
    .browse-result-installed {
      font-size: 0.72em;
      color: var(--accent-green);
      background: color-mix(in srgb, var(--accent-green) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--accent-green) 28%, transparent);
      border-radius: 20px;
      padding: 1px 7px;
      font-weight: 600;
      margin-left: auto;
      white-space: nowrap;
    }
    .browse-result-desc {
      font-size: 0.82em;
      color: var(--vscode-descriptionForeground);
      line-height: 1.45;
      margin-bottom: 10px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .browse-result-actions {
      display: flex;
      gap: 6px;
    }
    .browse-result-actions button {
      font-size: 0.80em;
      padding: 4px 12px;
    }
    .browse-spinner {
      width: 28px; height: 28px;
      border: 2.5px solid color-mix(in srgb, var(--vscode-panel-border) 80%, transparent);
      border-top-color: var(--accent-blue);
      border-radius: 50%;
      animation: spin 0.7s cubic-bezier(0.4,0,0.6,1) infinite;
    }
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

  <!-- Changelog tooltip (fixed-position singleton, avoids overflow clipping) -->
  <div id="ps-tooltip"></div>

  <!-- Header -->
  <div class="header">
    <div class="header-title">
      <h1><img src="${logoUri}" alt="PackSight" style="height: 1.5em; width: 1.5em;" /> PackSight Dashboard</h1>
    </div>
    <div class="header-right">
      <div id="project-name"></div>
      <div class="header-actions">
        <div class="scale-control" title="Adjust UI scale">
          <button class="scale-btn" id="btn-scale-down" aria-label="Decrease UI scale">−</button>
          <span id="scale-label">100%</span>
          <button class="scale-btn" id="btn-scale-up" aria-label="Increase UI scale">+</button>
        </div>
        <button class="btn-secondary" id="btn-browse">
          <svg class="icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.5 1a.5.5 0 0 1 .5.5v1h1.5a.5.5 0 0 1 0 1H12v8.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 2 11.5V3.5h-.5a.5.5 0 0 1 0-1H3v-1a.5.5 0 0 1 1 0v1h7v-1a.5.5 0 0 1 .5-.5zM3 3.5v8a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-8H3zm2 2a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm4 0a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm-2 0a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5z" fill="currentColor"/></svg>
          Browse &amp; Install
        </button>
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
    <div class="stat-card card-security" id="stat-card-security">
      <div class="stat-label">
        <svg class="icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 1.5 L2.5 4.2v4.3c0 3.1 2.3 5.4 5.5 6.1 3.2-.7 5.5-3 5.5-6.1V4.2L8 1.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="color-mix(in srgb, currentColor 10%, transparent)"/><path d="M5.5 8l1.8 1.8L10.5 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Security
      </div>
      <div class="stat-value" id="stat-security">—</div>
    </div>
  </div>

  <!-- Toolbar: search left, runtime badges centre, tabs right -->
  <div class="toolbar">
    <div class="search-wrap">
      <input type="search" id="search-input" placeholder="Search packages…" aria-label="Search packages" autocomplete="off" />
    </div>
    <div class="runtime-badges" id="runtime-badges" aria-label="Runtime versions">
      <span class="runtime-badge runtime-badge-node" id="badge-node">
        <svg width="16" height="16" viewBox="-3.8 -1.5 40.921 40.921" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="nodejs-b" x1="271.97" x2="211.104" y1="217.606" y2="341.772" gradientUnits="userSpaceOnUse"><stop offset=".3" stop-color="#3e863d"></stop><stop offset=".5" stop-color="#55934f"></stop><stop offset=".8" stop-color="#5aad45"></stop></linearGradient><linearGradient id="nodejs-d" x1="186.484" x2="297.349" y1="321.381" y2="239.465" gradientUnits="userSpaceOnUse"><stop offset=".57" stop-color="#3e863d"></stop><stop offset=".72" stop-color="#619857"></stop><stop offset="1" stop-color="#76ac64"></stop></linearGradient><linearGradient id="nodejs-f" x1="197.051" x2="288.72" y1="279.652" y2="279.652" gradientUnits="userSpaceOnUse"><stop offset=".16" stop-color="#6bbf47"></stop><stop offset=".38" stop-color="#79b461"></stop><stop offset=".47" stop-color="#75ac64"></stop><stop offset=".7" stop-color="#659e5a"></stop><stop offset=".9" stop-color="#3e863d"></stop></linearGradient><clipPath id="nodejs-a"><path d="m239.03 226.605-42.13 24.317a5.085 5.085 0 0 0-2.546 4.406v48.668c0 1.817.968 3.496 2.546 4.406l42.133 24.336a5.1 5.1 0 0 0 5.09 0l42.126-24.336a5.096 5.096 0 0 0 2.54-4.406v-48.668c0-1.816-.97-3.496-2.55-4.406l-42.12-24.317a5.123 5.123 0 0 0-5.1 0"></path></clipPath><clipPath id="nodejs-c"><path d="M195.398 307.086c.403.523.907.976 1.5 1.316l36.14 20.875 6.02 3.46c.9.52 1.926.74 2.934.665.336-.027.672-.09 1-.183l44.434-81.36c-.34-.37-.738-.68-1.184-.94l-27.586-15.93-14.582-8.39a5.318 5.318 0 0 0-1.32-.53zm0 0"></path></clipPath><clipPath id="nodejs-e"><path d="M241.066 225.953a5.14 5.14 0 0 0-2.035.652l-42.01 24.247 45.3 82.51c.63-.09 1.25-.3 1.81-.624l42.13-24.336a5.105 5.105 0 0 0 2.46-3.476l-46.18-78.89a5.29 5.29 0 0 0-1.03-.102l-.42.02"></path></clipPath></defs><g clip-path="url(#nodejs-a)" transform="translate(-68.564 -79.701) scale(.35278)"><path fill="url(#nodejs-b)" d="m331.363 246.793-118.715-58.19-60.87 124.174L270.49 370.97zm0 0"></path></g><g clip-path="url(#nodejs-c)" transform="translate(-68.564 -79.701) scale(.35278)"><path fill="url(#nodejs-d)" d="m144.07 264.004 83.825 113.453 110.86-81.906-83.83-113.45zm0 0"></path></g><g clip-path="url(#nodejs-e)" transform="translate(-68.564 -79.701) scale(.35278)"><path fill="url(#nodejs-f)" d="M197.02 225.934v107.43h91.683v-107.43zm0 0"></path></g></svg>
        <span id="badge-node-ver">—</span>
      </span>
      <span class="runtime-badge runtime-badge-npm" id="badge-npm">
        <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" fill="none"></rect><rect x="21.6" y="19.9" width="2.4" height="4.84" fill="#cb3837"></rect><path d="M2,15V29.7H14.2v2.5H24V29.7H46V15ZM14.2,27.2H11.8V19.9H9.3v7.3H4.5V17.5h9.7Zm12.3,0H21.6v2.5H16.7V17.5h9.8Zm17.1,0H41.2V19.9H38.7v7.3H36.2V19.9H33.8v7.3H28.9V17.5H43.6Z" fill="#cb3837"></path></svg>
        <span id="badge-npm-ver">—</span>
      </span>
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

  <!-- Bulk action bar -->
  <div id="bulk-bar" role="toolbar" aria-label="Bulk actions">
    <span id="bulk-bar-label"><span id="bulk-count">0</span> package(s) selected</span>
    <button class="btn-primary" id="btn-bulk-update">↑ Update Selected</button>
    <button class="btn-secondary" id="btn-bulk-clear">✕ Clear</button>
  </div>

  <!-- Package table -->
  <div class="table-wrap">
    <table aria-label="Package list">
      <thead>
        <tr>
          <th class="col-check"><input type="checkbox" id="select-all" title="Select all updatable packages" /></th>
          <th data-sort="name">Name <span class="sort-icon">↕</span></th>
          <th data-sort="version">Version <span class="sort-icon">↕</span></th>
          <th data-sort="latest">Latest <span class="sort-icon">↕</span></th>
          <th data-sort="lastUpdated">Last Update <span class="sort-icon">↕</span></th>
          <th data-sort="size">Size <span class="sort-icon">↕</span></th>
          <th data-sort="status">Status <span class="sort-icon">↕</span></th>
          <th>Actions</th>
          <th class="col-changelog"></th>
        </tr>
      </thead>
      <tbody id="pkg-tbody">
        <tr>
          <td colspan="9">
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

  <!-- Browse & Install panel -->
  <div id="browse-backdrop" role="dialog" aria-modal="true" aria-labelledby="browse-panel-title">
    <div id="browse-panel">
      <div class="browse-header">
        <h2 id="browse-panel-title">
          <svg class="icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.5 1a.5.5 0 0 1 .5.5v1h1.5a.5.5 0 0 1 0 1H12v8.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 2 11.5V3.5h-.5a.5.5 0 0 1 0-1H3v-1a.5.5 0 0 1 1 0v1h7v-1a.5.5 0 0 1 .5-.5zM3 3.5v8a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-8H3zm2 2a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm4 0a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm-2 0a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5z" fill="currentColor"/></svg>
          Browse &amp; Install
        </h2>
        <button id="browse-close" aria-label="Close browse panel">
          <span class="codicon codicon-close"></span>
        </button>
      </div>
      <div class="browse-search-wrap">
        <input type="search" id="browse-search-input" placeholder="Search npm packages…" aria-label="Search npm packages" autocomplete="off" />
        <button class="btn-primary" id="browse-search-btn">Search</button>
      </div>
      <div id="browse-results">
        <div class="browse-state" id="browse-idle">
          <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" fill="currentColor"/></svg>
          <span>Search for any npm package to browse and install it into your project.</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Confirm modal -->
  <div id="confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <div id="confirm-modal">
      <h3 id="confirm-title"></h3>
      <p id="confirm-body"></p>
      <div id="confirm-version-arrow" aria-hidden="true">
        <span class="ver-chip ver-chip-from" id="ver-from"></span>
        <span class="ver-arrow">→</span>
        <span class="ver-chip ver-chip-to" id="ver-to"></span>
        <span class="ver-bump-tag" id="ver-bump"></span>
      </div>
      <div id="confirm-bulk-list" aria-hidden="true"></div>
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
    let sortKey     = 'name';
    let sortDir     = 'asc';
    let selectedPackages = new Set(); // package names selected for bulk update

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
      const vulnPkgs = allPackages.filter(p => p.vulnSeverity !== null);
      const vulnCount = vulnPkgs.length;

      animateCount(document.getElementById('stat-total'),    total);
      animateCount(document.getElementById('stat-dev'),      dev);
      animateCount(document.getElementById('stat-unused'),   unused);
      animateCount(document.getElementById('stat-outdated'), outdated);

      // Security card
      const secEl   = document.getElementById('stat-security');
      const secCard = document.getElementById('stat-card-security');
      if (vulnCount > 0) {
        animateCount(secEl, vulnCount);
        secEl.className  = 'stat-value has-vulns';
        secCard.classList.remove('secure');
      } else {
        secEl.textContent = '✓';
        secEl.className   = 'stat-value is-secure';
        secCard.classList.add('secure');
      }

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

    function semverParts(v) {
      const m = String(v).replace(/^[\^~>=<\s]+/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
      return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : [0, 0, 0];
    }

    function bumpType(current, latest) {
      if (!current || !latest) return null;
      const [cMaj, cMin] = semverParts(current);
      const [lMaj, lMin] = semverParts(latest);
      if (lMaj > cMaj) return 'major';
      if (lMin > cMin) return 'minor';
      return 'patch';
    }

    // bump type → { label, badge class suffix }
    const BUMP_META = {
      major: { label: 'Major',  cls: 'badge-up-major' },
      minor: { label: 'Minor',  cls: 'badge-up-minor' },
      patch: { label: 'Patch',  cls: 'badge-up-patch' },
    };

    function statusBadge(pkg) {
      const outdated = pkg.latest !== null;
      if (pkg.isUnused && outdated)
        return '<span class="badge badge-crit">' + ICON_CRIT + ' Unused + Outdated</span>';
      if (pkg.isUnused)
        return '<span class="badge badge-warn">' + ICON_WARN + ' Unused</span>';
      if (outdated) {
        const bump = bumpType(pkg.version, pkg.latest);
        const meta = BUMP_META[bump] || { label: 'Update', cls: 'badge-up' };
        return '<span class="badge ' + meta.cls + '">' + ICON_UP + ' ' + meta.label + ' Update</span>';
      }
      return '<span class="badge badge-ok">' + ICON_OK + ' OK</span>';
    }

    // ── Date formatting ────────────────────────────────────────────────────
    function formatDate(iso) {      if (!iso) return '<span class="latest-dash">—</span>';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '<span class="latest-dash">—</span>';
      const now  = Date.now();
      const diff = now - d.getTime();
      const days = Math.floor(diff / 86400000);
      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 30)  return days + 'd ago';
      if (days < 365) return Math.floor(days / 30) + 'mo ago';
      return Math.floor(days / 365) + 'y ago';
    }

    function formatSize(bytes) {
      if (bytes === null || bytes === undefined) return '<span class="latest-dash">—</span>';
      if (bytes < 1024)        return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
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
          case 'lastUpdated': {
            const ta = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
            const tb = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
            cmp = ta - tb;
            break;
          }
          case 'size':        cmp = (a.size ?? 0) - (b.size ?? 0); break;
          case 'status':      cmp = statusRank(a) - statusRank(b); break;
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

    // ── Bulk bar ───────────────────────────────────────────────────────────
    function updateBulkBar() {
      const count = selectedPackages.size;
      const bar   = document.getElementById('bulk-bar');
      document.getElementById('bulk-count').textContent = count;
      bar.classList.toggle('visible', count > 0);

      // Sync select-all checkbox state
      const updatable = allPackages.filter(p => p.latest !== null);
      const selectAll = document.getElementById('select-all');
      if (selectAll) {
        selectAll.indeterminate = count > 0 && count < updatable.length;
        selectAll.checked = updatable.length > 0 && count === updatable.length;
      }
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
          '<tr><td colspan="9"><div class="empty-state">' +
          '<div class="empty-state-icon">' + icon + '</div>' +
          '<div class="empty-state-msg">' + esc(msg) + '</div>' +
          '</div></td></tr>';
        return;
      }

      tbody.innerHTML = pkgs.map(pkg => {        const latestCell = pkg.latest
          ? '<span style="color:var(--vscode-charts-green,#4caf50)">^' + esc(pkg.latest) + '</span>'
          : '<span class="latest-dash">—</span>';

        const devTag = pkg.isDev ? '<span class="dev-tag">dev</span>' : '';

        // Shield with exclamation for vulnerabilities, shield with checkmark for secure
        const SHIELD_VULN = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 1.5 L2 4v4c0 3.31 2.5 5.8 6 6.5 3.5-.7 6-3.19 6-6.5V4L8 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="color-mix(in srgb, currentColor 15%, transparent)"/><path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
        const SHIELD_OK   = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 1.5 L2 4v4c0 3.31 2.5 5.8 6 6.5 3.5-.7 6-3.19 6-6.5V4L8 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="color-mix(in srgb, currentColor 15%, transparent)"/><path d="M5.5 8l1.8 1.8L10.5 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        const vulnIcon = pkg.vulnSeverity
          ? \`<span class="vuln-icon vuln-\${pkg.vulnSeverity}" data-vuln="\${pkg.vulnSeverity}" aria-label="\${pkg.vulnSeverity} vulnerability">\${SHIELD_VULN}</span>\`
          : \`<span class="vuln-icon vuln-secure" data-vuln="secure" aria-label="No known vulnerabilities">\${SHIELD_OK}</span>\`;

        const updateBtn = pkg.latest !== null
          ? \`<button class="btn-primary btn-update"
               data-name="\${esc(pkg.name)}"
               data-version="^\${esc(pkg.version.replace(/^[\\^~>=<\\s]+/, ''))}"
               data-latest="\${esc(pkg.latest ?? '')}"
               title="Update \${esc(pkg.name)} to \${esc(pkg.latest ?? '')}">Update</button>\`
          : '';

        return \`<tr>
          <td class="col-check">\${pkg.latest !== null
            ? \`<input type="checkbox" class="row-check" data-name="\${esc(pkg.name)}" \${selectedPackages.has(pkg.name) ? 'checked' : ''} title="Select for bulk update" />\`
            : ''}</td>
          <td class="col-name"><span class="pkg-name-link" data-name="\${esc(pkg.name)}">\${esc(pkg.name)}</span>\${vulnIcon}\${devTag}</td>
          <td class="col-version">^\${esc(pkg.version.replace(/^[\\^~>=<\\s]+/, ''))}</td>
          <td class="col-latest">\${latestCell}</td>
          <td class="col-date" data-iso="\${pkg.lastUpdated ? esc(pkg.lastUpdated) : ''}"><span class="date-text">\${formatDate(pkg.lastUpdated)}</span></td>
          <td class="col-size">\${formatSize(pkg.size)}</td>
          <td>\${statusBadge(pkg)}</td>
          <td class="actions-cell">
            \${updateBtn}
            <button class="btn-danger btn-uninstall"
              data-name="\${esc(pkg.name)}"
              data-dev="\${pkg.isDev}"
              title="Uninstall \${esc(pkg.name)}">Uninstall</button>
          </td>
          <td class="col-changelog">\${pkg.repoUrl
            ? \`<span class="btn-changelog-wrap" data-tooltip="View Releases on GitHub"><button class="btn-changelog codicon codicon-book" data-url="\${esc(pkg.repoUrl)}" aria-label="View releases for \${esc(pkg.name)} on GitHub"></button></span>\`
            : ''}</td>
        </tr>\`;
      }).join('');
      updateBulkBar();
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
          // Runtime version badges
          const nodeVer = msg.payload.nodeVersion;
          const npmVer  = msg.payload.npmVersion;
          document.getElementById('badge-node-ver').textContent = nodeVer ? 'v' + nodeVer : '—';
          document.getElementById('badge-npm-ver').textContent  = npmVer  ? 'v' + npmVer  : '—';
          document.getElementById('runtime-badges').style.display = (nodeVer || npmVer) ? 'flex' : 'none';
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

        case 'searchResults':
          renderBrowseResults(msg.results);
          break;

        case 'searchError':
          renderBrowseError(msg.message);
          break;
      }
    });

    // ── Browse & Install panel ─────────────────────────────────────────────
    let browseSearchTimer = null;

    const BROWSE_IDLE_HTML =
      '<div class="browse-state" id="browse-idle">' +
      '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" fill="currentColor"/></svg>' +
      '<span>Search for any npm package to browse and install it into your project.</span>' +
      '</div>';

    function resetBrowsePanel() {
      clearTimeout(browseSearchTimer);
      document.getElementById('browse-search-input').value = '';
      document.getElementById('browse-results').innerHTML = BROWSE_IDLE_HTML;
    }

    function openBrowsePanel() {
      document.getElementById('browse-backdrop').classList.add('visible');
      document.getElementById('browse-search-input').focus();
    }

    function closeBrowsePanel() {
      document.getElementById('browse-backdrop').classList.remove('visible');
      resetBrowsePanel();
    }

    function setBrowseLoading() {
      document.getElementById('browse-results').innerHTML =
        '<div class="browse-state"><div class="browse-spinner"></div><span>Searching…</span></div>';
    }

    function renderBrowseResults(results) {
      const container = document.getElementById('browse-results');
      if (!results || results.length === 0) {
        container.innerHTML =
          '<div class="browse-state">' +
          '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="36"><path d="M8 1.5a.5.5 0 0 1 .44.26l6 10.5A.5.5 0 0 1 14 13H2a.5.5 0 0 1-.44-.74l6-10.5A.5.5 0 0 1 8 1.5zm0 1.06L2.87 12h10.26L8 2.56zM8 6a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-3A.5.5 0 0 1 8 6zm0 5.5a.6.6 0 1 1 0 1.2.6.6 0 0 1 0-1.2z" fill="currentColor"/></svg>' +
          '<span>No packages found. Try a different search term.</span></div>';
        return;
      }
      const installedNames = new Set(allPackages.map(p => p.name));
      container.innerHTML = results.map(r => {
        const isInstalled = installedNames.has(r.name);
        const installBtns = isInstalled
          ? '<span class="browse-result-installed">✓ Installed</span>'
          : '<button class="btn-primary browse-install-btn" data-name="' + esc(r.name) + '" data-dev="false">+ Install</button>' +
            '<button class="btn-secondary browse-install-btn" data-name="' + esc(r.name) + '" data-dev="true">+ Dev</button>';
        return '<div class="browse-result-item">' +
          '<div class="browse-result-top">' +
            '<span class="browse-result-name" data-name="' + esc(r.name) + '">' + esc(r.name) + '</span>' +
            '<span class="browse-result-version">v' + esc(r.version) + '</span>' +
            (isInstalled ? '<span class="browse-result-installed">✓ Installed</span>' : '') +
          '</div>' +
          '<div class="browse-result-desc">' + esc(r.description || 'No description available.') + '</div>' +
          '<div class="browse-result-actions">' + (isInstalled ? '' : installBtns) + '</div>' +
        '</div>';
      }).join('');
    }

    function renderBrowseError(msg) {
      document.getElementById('browse-results').innerHTML =
        '<div class="browse-state" style="color:var(--accent-red)">' +
        '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="36"><path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 1a6 6 0 1 0 0 12A6 6 0 0 0 8 2zm0 3a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0v-4A.5.5 0 0 1 8 5zm0 6.5a.6.6 0 1 1 0 1.2.6.6 0 0 1 0-1.2z" fill="currentColor"/></svg>' +
        '<span>' + esc(msg) + '</span></div>';
    }

    function doSearch() {
      const q = document.getElementById('browse-search-input').value.trim();
      if (!q) return;
      setBrowseLoading();
      vscode.postMessage({ command: 'searchPackages', query: q });
    }

    document.getElementById('btn-browse').addEventListener('click', openBrowsePanel);

    document.getElementById('browse-close').addEventListener('click', closeBrowsePanel);
    document.getElementById('browse-backdrop').addEventListener('click', e => {
      if (e.target === document.getElementById('browse-backdrop')) closeBrowsePanel();
    });

    document.getElementById('browse-search-btn').addEventListener('click', doSearch);
    document.getElementById('browse-search-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') { clearTimeout(browseSearchTimer); doSearch(); }
    });
    document.getElementById('browse-search-input').addEventListener('input', () => {
      clearTimeout(browseSearchTimer);
      const q = document.getElementById('browse-search-input').value.trim();
      if (!q) {
        document.getElementById('browse-results').innerHTML = BROWSE_IDLE_HTML;
        return;
      }
      browseSearchTimer = setTimeout(doSearch, 400);
    });

    // Install button delegation
    document.getElementById('browse-results').addEventListener('click', e => {
      const btn = e.target.closest('.browse-install-btn');
      if (btn) {
        const packageName = btn.dataset.name;
        const isDev = btn.dataset.dev === 'true';
        closeBrowsePanel();
        vscode.postMessage({ command: 'installPackage', packageName, isDev });
        return;
      }
      // Package name click → open on npmjs via extension (window.open is sandboxed)
      const nameSpan = e.target.closest('.browse-result-name');
      if (nameSpan) {
        vscode.postMessage({ command: 'openNpm', packageName: nameSpan.dataset.name });
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.getElementById('browse-backdrop').classList.contains('visible')) {
        closeBrowsePanel();
      }
    });

    // ── UI scale control ───────────────────────────────────────────────────
    const SCALE_MIN  = 0.7;
    const SCALE_MAX  = 1.4;
    const SCALE_STEP = 0.05;
    const SCALE_KEY  = 'packSight.uiScale';

    function applyScale(scale) {
      document.body.style.setProperty('--ui-scale', scale);
      document.getElementById('scale-label').textContent = Math.round(scale * 100) + '%';
      document.getElementById('btn-scale-down').disabled = scale <= SCALE_MIN;
      document.getElementById('btn-scale-up').disabled   = scale >= SCALE_MAX;
      try { localStorage.setItem(SCALE_KEY, String(scale)); } catch {}
    }

    // Restore persisted scale on load
    (function () {
      let saved = 1;
      try { saved = parseFloat(localStorage.getItem(SCALE_KEY) || '1') || 1; } catch {}
      saved = Math.min(SCALE_MAX, Math.max(SCALE_MIN, saved));
      applyScale(saved);
    })();

    document.getElementById('btn-scale-down').addEventListener('click', () => {
      const cur = parseFloat(document.body.style.getPropertyValue('--ui-scale') || '1');
      applyScale(Math.max(SCALE_MIN, Math.round((cur - SCALE_STEP) * 100) / 100));
    });
    document.getElementById('btn-scale-up').addEventListener('click', () => {
      const cur = parseFloat(document.body.style.getPropertyValue('--ui-scale') || '1');
      applyScale(Math.min(SCALE_MAX, Math.round((cur + SCALE_STEP) * 100) / 100));
    });

    // Ctrl + scroll wheel to adjust scale
    window.addEventListener('wheel', e => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const cur = parseFloat(document.body.style.getPropertyValue('--ui-scale') || '1');
      const delta = e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP;
      const next = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round((cur + delta) * 100) / 100));
      applyScale(next);
    }, { passive: false });

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

    // ── Select-all checkbox ────────────────────────────────────────────────
    document.getElementById('select-all').addEventListener('change', e => {
      const checked = e.target.checked;
      allPackages.filter(p => p.latest !== null).forEach(p => {
        if (checked) selectedPackages.add(p.name);
        else         selectedPackages.delete(p.name);
      });
      renderTable();
    });

    // Row checkbox delegation
    document.getElementById('pkg-tbody').addEventListener('change', e => {
      const target = e.target;
      if (!target.classList.contains('row-check')) return;
      const name = target.dataset.name;
      if (target.checked) selectedPackages.add(name);
      else                selectedPackages.delete(name);
      updateBulkBar();
    });

    // Bulk update button
    document.getElementById('btn-bulk-update').addEventListener('click', () => {
      const names = [...selectedPackages];
      if (names.length === 0) return;
      const bulkItems = names.map(n => {
        const pkg = allPackages.find(p => p.name === n);
        const rawVer  = pkg ? pkg.version : '';
        const cleanVer = rawVer.replace(/^[^\d]+/, '') || rawVer;
        return {
          name: n,
          from: '^' + cleanVer,
          to:   pkg ? (pkg.latest ?? '?') : '?',
        };
      });
      showConfirm(
        'Update Selected Packages',
        names.length + ' package(s) will be updated to their latest versions.',
        'Update All',
        'btn-primary',
        () => {
          selectedPackages.clear();
          updateBulkBar();
          vscode.postMessage({ command: 'bulkUpdate', packageNames: names });
        },
        null,
        bulkItems
      );
    });

    // Clear selection
    document.getElementById('btn-bulk-clear').addEventListener('click', () => {
      selectedPackages.clear();
      renderTable();
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

    function showConfirm(title, body, okLabel, okClass, onConfirm, versionInfo, bulkItems) {
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-body').textContent  = body;
      const okBtn = document.getElementById('confirm-ok');
      okBtn.textContent  = okLabel;
      okBtn.className    = okClass;
      pendingAction      = onConfirm;

      // Single-package version upgrade arrow
      const arrow = document.getElementById('confirm-version-arrow');
      if (versionInfo) {
        document.getElementById('ver-from').textContent = versionInfo.from;
        document.getElementById('ver-to').textContent   = '^' + versionInfo.to;
        const bump = bumpType(versionInfo.from, versionInfo.to);
        const bumpEl = document.getElementById('ver-bump');
        bumpEl.textContent = bump ? bump.charAt(0).toUpperCase() + bump.slice(1) : '';
        bumpEl.className   = 'ver-bump-tag' + (bump ? ' ver-bump-' + bump : '');
        arrow.classList.add('visible');
      } else {
        arrow.classList.remove('visible');
      }

      // Bulk package list
      const bulkList = document.getElementById('confirm-bulk-list');
      if (bulkItems && bulkItems.length > 0) {
        bulkList.innerHTML = bulkItems.map(item => {
          const bump = bumpType(item.from, item.to);
          const bumpCls = bump ? ' ver-bump-' + bump : '';
          const bumpLabel = bump ? bump.charAt(0).toUpperCase() + bump.slice(1) : '';
          return '<div class="bulk-list-row">' +
            '<span class="bulk-list-name">' + esc(item.name) + '</span>' +
            '<div class="bulk-list-versions">' +
              '<span class="ver-chip ver-chip-from">' + esc(item.from) + '</span>' +
              '<span class="ver-arrow">→</span>' +
              '<span class="ver-chip ver-chip-to">^' + esc(item.to) + '</span>' +
              (bumpLabel ? '<span class="ver-bump-tag' + bumpCls + '">' + bumpLabel + '</span>' : '') +
            '</div>' +
          '</div>';
        }).join('');
        bulkList.classList.add('visible');
      } else {
        bulkList.classList.remove('visible');
      }

      document.getElementById('confirm-backdrop').classList.add('visible');
      okBtn.focus();
    }

    function closeConfirm() {
      document.getElementById('confirm-backdrop').classList.remove('visible');
      document.getElementById('confirm-version-arrow').classList.remove('visible');
      document.getElementById('confirm-bulk-list').classList.remove('visible');
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
        const name    = target.dataset.name;
        const from    = target.dataset.version;
        const to      = target.dataset.latest;
        showConfirm(
          'Update Package',
          'Update "' + name + '" to the latest version?',
          'Update',
          'btn-primary',
          () => vscode.postMessage({ command: 'update', packageName: name }),
          { from, to }
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

    // ── Shared fixed-position tooltip ──────────────────────────────────────
    const psTooltip = document.getElementById('ps-tooltip');

    function showTooltip(text, anchorRect, alignCenter) {
      psTooltip.textContent = text;
      if (alignCenter) {
        psTooltip.style.left = (anchorRect.left + anchorRect.width / 2) + 'px';
        psTooltip.style.transform = 'translateX(-50%) translateY(-100%) scale(0.92)';
      } else {
        psTooltip.style.left = anchorRect.left + 'px';
        psTooltip.style.transform = 'translateY(-100%) scale(0.92)';
      }
      psTooltip.style.top = (anchorRect.top - 8) + 'px';
      psTooltip.getBoundingClientRect(); // force reflow so transition fires
      psTooltip.classList.add('visible');
      psTooltip.style.transform = psTooltip.style.transform.replace('0.92', '1');
    }

    function hideTooltip() {
      psTooltip.classList.remove('visible');
    }

    // ── Last Update cell tooltip ───────────────────────────────────────────
    document.getElementById('pkg-tbody').addEventListener('mouseenter', e => {
      const span = e.target.closest('.date-text');
      if (!span) return;
      const td = span.closest('td.col-date');
      if (!td || !td.dataset.iso) return;
      const d = new Date(td.dataset.iso);
      if (isNaN(d.getTime())) return;
      const label = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      showTooltip(label, span.getBoundingClientRect(), false);
    }, true);

    document.getElementById('pkg-tbody').addEventListener('mouseleave', e => {
      if (e.target.closest('.date-text')) hideTooltip();
    }, true);

    // ── Package name → npmjs ───────────────────────────────────────────────
    document.getElementById('pkg-tbody').addEventListener('mouseenter', e => {
      const span = e.target.closest('.pkg-name-link');
      if (!span) return;
      showTooltip('View on npmjs.com', span.getBoundingClientRect(), false);
    }, true);

    document.getElementById('pkg-tbody').addEventListener('mouseleave', e => {
      if (e.target.closest('.pkg-name-link')) hideTooltip();
    }, true);

    document.getElementById('pkg-tbody').addEventListener('click', e => {
      const span = e.target.closest('.pkg-name-link');
      if (!span) return;
      hideTooltip();
      vscode.postMessage({ command: 'openNpm', packageName: span.dataset.name });
    });

    // ── Vulnerability icon tooltip ─────────────────────────────────────────
    const VULN_LABELS = {
      critical: '🔴 Critical vulnerability detected',
      high:     '🟠 High severity vulnerability detected',
      moderate: '🟡 Moderate severity vulnerability detected',
      low:      '🟢 Low severity vulnerability detected',
      secure:   '✅ No known vulnerabilities',
    };
    document.getElementById('pkg-tbody').addEventListener('mouseenter', e => {
      const icon = e.target.closest('.vuln-icon');
      if (!icon) return;
      const label = VULN_LABELS[icon.dataset.vuln] || 'Vulnerability detected';
      showTooltip(label, icon.getBoundingClientRect(), true);
    }, true);
    document.getElementById('pkg-tbody').addEventListener('mouseleave', e => {
      if (e.target.closest('.vuln-icon')) hideTooltip();
    }, true);

    // ── Changelog button delegation ────────────────────────────────────────
    document.getElementById('pkg-tbody').addEventListener('mouseenter', e => {
      const btn = e.target.closest('.btn-changelog');
      if (!btn) return;
      const text = btn.closest('.btn-changelog-wrap').dataset.tooltip;
      showTooltip(text, btn.getBoundingClientRect(), true);
    }, true);

    document.getElementById('pkg-tbody').addEventListener('mouseleave', e => {
      if (e.target.closest('.btn-changelog')) hideTooltip();
    }, true);

    document.getElementById('pkg-tbody').addEventListener('click', e => {
      const target = e.target.closest('.btn-changelog');
      if (!target) return;
      hideTooltip();
      vscode.postMessage({ command: 'openChangelog', url: target.dataset.url });
    });

    // ── Runtime badge tooltips ─────────────────────────────────────────────
    document.getElementById('badge-node').addEventListener('mouseenter', e => {
      showTooltip('Your current Node.js version', e.currentTarget.getBoundingClientRect(), true);
    });
    document.getElementById('badge-node').addEventListener('mouseleave', hideTooltip);

    document.getElementById('badge-npm').addEventListener('mouseenter', e => {
      showTooltip('Your current npm version', e.currentTarget.getBoundingClientRect(), true);
    });
    document.getElementById('badge-npm').addEventListener('mouseleave', hideTooltip);

    // Signal the extension that the webview DOM is ready and can receive messages.
    // The extension listener is registered before html is set, so this is always heard.
    vscode.postMessage({ command: 'ready' });
  </script>
</body>
</html>`;
}
