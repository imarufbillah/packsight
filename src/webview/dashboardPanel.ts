import * as vscode from "vscode";
import { parseDependencies } from "../services/dependencyService";
import { getOutdatedPackages, getPackagesLastUpdated, getPackageSizes, getPackageRepoUrls } from "../services/npmService";
import { scanUsedPackages } from "../services/scanService";
import { getDashboardHtml } from "./dashboardHtml";
import { handleWebviewMessage } from "./messageHandler";
import { CONTEXT_KEYS } from "../constants";
import {
  DashboardData,
  ExtensionMessage,
  WebviewMessage,
} from "../types/dashboard";

/**
 * Singleton manager for the PackSight Dashboard WebviewPanel.
 * Only one panel may exist at a time; calling createOrShow() when a panel
 * already exists simply brings it to the foreground.
 */
export class DashboardPanel {
  private static instance: DashboardPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly workspaceRoot: string;
  private readonly extensionUri: vscode.Uri;
  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    workspaceRoot: string,
    extensionUri: vscode.Uri,
  ) {
    this.panel = panel;
    this.workspaceRoot = workspaceRoot;
    this.extensionUri = extensionUri;

    // Register the message listener BEFORE setting html so the very first
    // 'ready' message from the webview script is never missed.
    this.panel.webview.onDidReceiveMessage(
      (raw: unknown) => {
        if (isWebviewMessage(raw)) {
          void handleWebviewMessage(
            raw,
            this.panel.webview,
            this.workspaceRoot,
            () => this.loadData(),
          );
        }
      },
      undefined,
      this.disposables,
    );

    // Setting html triggers the webview to load. The script inside posts
    // { command: 'ready' } once the DOM is live, which we handle below by
    // calling loadData() — guaranteeing the webview can receive the message.
    this.panel.webview.html = getDashboardHtml(
      this.panel.webview,
      this.extensionUri,
    );

    // Clean up when the panel is closed by the user
    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Opens the dashboard panel, or focuses the existing one.
   * Sets the `packSight.dashboardOpen` context key to true.
   */
  public static createOrShow(
    context: vscode.ExtensionContext,
    workspaceRoot: string,
  ): DashboardPanel {
    if (DashboardPanel.instance) {
      DashboardPanel.instance.panel.reveal(vscode.ViewColumn.One);
      return DashboardPanel.instance;
    }

    const panel = vscode.window.createWebviewPanel(
      "packSightDashboard",
      "Package Manager",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          context.extensionUri,
          vscode.Uri.joinPath(context.extensionUri, "node_modules"),
        ],
      },
    );

    // Set the SVG icon shown on the panel tab
    const iconUri = vscode.Uri.joinPath(
      context.extensionUri,
      "resources",
      "icon.svg",
    );
    panel.iconPath = iconUri;

    DashboardPanel.instance = new DashboardPanel(
      panel,
      workspaceRoot,
      context.extensionUri,
    );
    void vscode.commands.executeCommand(
      "setContext",
      CONTEXT_KEYS.DASHBOARD_OPEN,
      true,
    );
    return DashboardPanel.instance;
  }

  /**
   * Closes the panel programmatically (e.g. when the user clicks "Switch to Tree View").
   */
  public static closeIfOpen(): void {
    DashboardPanel.instance?.dispose();
  }

  /**
   * Returns true if a panel is currently open.
   */
  public static isOpen(): boolean {
    return DashboardPanel.instance !== undefined;
  }

  /**
   * Fetches fresh data from the existing services and sends it to the webview.
   * Called on initial load, after npm operations, and on manual refresh.
   */
  public async loadData(): Promise<void> {
    let data: DashboardData;

    try {
      const { dependencies, devDependencies } = parseDependencies(
        this.workspaceRoot,
      );
      const usedPackages = scanUsedPackages(this.workspaceRoot);

      const allEntries = [
        ...dependencies.map((p) => ({ ...p, isDev: false })),
        ...devDependencies.map((p) => ({ ...p, isDev: true })),
      ];

      // Fetch outdated, last-updated, sizes, and repo URLs in parallel
      const [outdatedMap, lastUpdatedMap, sizeMap, repoUrlMap] = await Promise.all([
        getOutdatedPackages(allEntries),
        getPackagesLastUpdated(allEntries),
        getPackageSizes(allEntries),
        getPackageRepoUrls(allEntries),
      ]);

      data = {
        workspaceRoot: this.workspaceRoot,
        packages: allEntries.map((entry) => ({
          name: entry.name,
          version: entry.version,
          latest: outdatedMap.get(entry.name)?.latest ?? null,
          isUnused: !usedPackages.has(entry.name),
          isDev: entry.isDev,
          lastUpdated: lastUpdatedMap.get(entry.name) ?? null,
          size: sizeMap.get(entry.name) ?? null,
          repoUrl: repoUrlMap.get(entry.name) ?? null,
        })),
      };
    } catch (err) {
      data = { workspaceRoot: this.workspaceRoot, packages: [] };
    }

    const msg: ExtensionMessage = { command: "loadData", payload: data };
    void this.panel.webview.postMessage(msg);
  }

  /**
   * Posts any ExtensionMessage to the webview (used by external callers
   * such as the file-watcher in extension.ts for Phase 5 data sync).
   */
  public postMessage(msg: ExtensionMessage): void {
    void this.panel.webview.postMessage(msg);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  private dispose(): void {
    DashboardPanel.instance = undefined;
    void vscode.commands.executeCommand(
      "setContext",
      CONTEXT_KEYS.DASHBOARD_OPEN,
      false,
    );
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }
}

// ─── Type guard ───────────────────────────────────────────────────────────────

function isWebviewMessage(value: unknown): value is WebviewMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "command" in value &&
    typeof (value as Record<string, unknown>)["command"] === "string"
  );
}
