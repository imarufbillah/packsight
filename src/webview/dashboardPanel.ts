import * as vscode from "vscode";
import { parseDependencies } from "../services/dependencyService";
import { getOutdatedPackages, getPackagesLastUpdated, getPackageSizes, getPackageRepoUrls, getRuntimeVersions, getVulnerabilities } from "../services/npmService";
import { scanUsedPackages } from "../services/scanService";
import { getDashboardHtml } from "./dashboardHtml";
import { handleWebviewMessage } from "./messageHandler";
import { SidebarWebviewProvider } from "./sidebarWebview";
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
  /** Cached payload from the last successful loadData — survives panel dispose/recreate */
  private static cachedData: DashboardData | undefined;
  /** Reference to the sidebar so it stays in sync on manual close */
  private static viewSwitchProvider: SidebarWebviewProvider | undefined;

  public static setViewSwitchProvider(p: SidebarWebviewProvider): void {
    DashboardPanel.viewSwitchProvider = p;
  }

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
        if (!isWebviewMessage(raw)) { return; }

        if (raw.command === 'ready') {
          // Serve cache instantly so the UI renders without a loading screen,
          // then revalidate in the background.
          void this.loadData(false);
          return;
        }

        void handleWebviewMessage(
          raw,
          this.panel.webview,
          this.workspaceRoot,
          () => this.loadData(true), // user-triggered: always bypass cache
          (mutate) => this.applyOptimisticUpdate(mutate),
        );
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
   * Applies an optimistic mutation to the cached data and posts it
   * immediately so the UI updates without waiting for registry fetches.
   * The full background refresh will follow and correct any inaccuracies.
   */
  public applyOptimisticUpdate(
    mutate: (packages: DashboardData['packages']) => DashboardData['packages']
  ): void {
    if (!DashboardPanel.cachedData) { return; }
    const updated: DashboardData = {
      ...DashboardPanel.cachedData,
      packages: mutate(DashboardPanel.cachedData.packages),
    };
    DashboardPanel.cachedData = updated;
    void this.panel.webview.postMessage({
      command: 'loadData',
      payload: updated,
    } satisfies ExtensionMessage);
  }

  /**
   * Serves cached data immediately (if available) so the UI renders
   * without a loading screen, then fetches fresh data in the background
   * and posts it again once ready.
   *
   * Called on initial load, after npm operations, and on manual refresh.
   * For manual refresh the cache is intentionally bypassed so the user
   * always gets up-to-date data when they explicitly ask for it.
   */
  public async loadData(bypassCache = false): Promise<void> {
    // Serve stale-while-revalidate: push cached data instantly so the
    // panel renders immediately, then fetch fresh data behind the scenes.
    if (!bypassCache && DashboardPanel.cachedData) {
      void this.panel.webview.postMessage({
        command: "loadData",
        payload: DashboardPanel.cachedData,
      } satisfies ExtensionMessage);
    }

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

      // Fetch outdated, last-updated, sizes, repo URLs, runtime versions, and vulnerabilities in parallel
      const [outdatedMap, lastUpdatedMap, sizeMap, repoUrlMap, runtimeVersions, vulnMap] = await Promise.all([
        getOutdatedPackages(allEntries),
        getPackagesLastUpdated(allEntries),
        getPackageSizes(allEntries),
        getPackageRepoUrls(allEntries),
        getRuntimeVersions(),
        getVulnerabilities(this.workspaceRoot),
      ]);

      data = {
        workspaceRoot: this.workspaceRoot,
        nodeVersion: runtimeVersions.node,
        npmVersion: runtimeVersions.npm,
        packages: allEntries.map((entry) => ({
          name: entry.name,
          version: entry.version,
          latest: outdatedMap.get(entry.name)?.latest ?? null,
          isUnused: !usedPackages.has(entry.name),
          isDev: entry.isDev,
          lastUpdated: lastUpdatedMap.get(entry.name) ?? null,
          size: sizeMap.get(entry.name) ?? null,
          repoUrl: repoUrlMap.get(entry.name) ?? null,
          vulnSeverity: vulnMap.get(entry.name) ?? null,
        })),
      };
    } catch (err) {
      data = { workspaceRoot: this.workspaceRoot, packages: [], nodeVersion: null, npmVersion: null };
    }

    // Update the cache and push fresh data to the webview
    DashboardPanel.cachedData = data;
    void this.panel.webview.postMessage({
      command: "loadData",
      payload: data,
    } satisfies ExtensionMessage);
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
    // Sync the sidebar switch button when the panel is closed manually
    DashboardPanel.viewSwitchProvider?.setDashboardOpen(false);
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
