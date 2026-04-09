import * as vscode from 'vscode';

/** Discriminates between group nodes and package leaf nodes */
export type DependencyItemKind = 'group' | 'package' | 'loading' | 'error';

/** All data needed to construct a DependencyItem */
export interface DependencyItemOptions {
  kind: DependencyItemKind;
  label: string;
  packageName: string;
  packageVersion: string;
  isDev: boolean;
  collapsibleState: vscode.TreeItemCollapsibleState;
  /** Optional badge text shown next to the group label (e.g. "3 unused") */
  badge?: string;
  /** Whether this package was not found in any scanned source file */
  isUnused?: boolean;
  /** Latest version available on the registry, if newer than installed */
  latestVersion?: string;
}

/**
 * A single node in the NPM UI tree view.
 *
 * Kinds:
 * - `group`   → top-level "Dependencies" / "Dev Dependencies" header
 * - `package` → individual npm package leaf node
 * - `loading` → spinner shown while scanning
 * - `error`   → shown when package.json is missing or unreadable
 */
export class DependencyItem extends vscode.TreeItem {
  public readonly kind: DependencyItemKind;
  public readonly packageName: string;
  public readonly packageVersion: string;
  public readonly isDev: boolean;
  public readonly isUnused: boolean;
  public readonly latestVersion: string | undefined;

  constructor(options: DependencyItemOptions) {
    // Drop the emoji prefix — the icon colour carries the unused signal instead
    super(options.label, options.collapsibleState);

    this.kind = options.kind;
    this.packageName = options.packageName;
    this.packageVersion = options.packageVersion;
    this.isDev = options.isDev;
    this.isUnused = options.isUnused ?? false;
    this.latestVersion = options.latestVersion;

    if (options.kind === 'package') {
      this.description = options.packageVersion;
      this.contextValue = 'package';

      const isOutdated = Boolean(options.latestVersion);

      if (isOutdated && this.isUnused) {
        // Outdated AND unused — red circle-slash icon
        this.iconPath = new vscode.ThemeIcon(
          'circle-slash',
          new vscode.ThemeColor('errorForeground')
        );
      } else if (isOutdated) {
        // Has an update — blue arrow-circle-up
        this.iconPath = new vscode.ThemeIcon(
          'arrow-circle-up',
          new vscode.ThemeColor('charts.blue')
        );
      } else if (this.isUnused) {
        // Unused — yellow warning icon
        this.iconPath = new vscode.ThemeIcon(
          'warning',
          new vscode.ThemeColor('editorWarning.foreground')
        );
      } else {
        // Healthy — green circle-filled
        this.iconPath = new vscode.ThemeIcon(
          'circle-filled',
          new vscode.ThemeColor('testing.iconPassed')
        );
      }

      const unusedNote = this.isUnused
        ? '\n\n$(warning) _Not found in any scanned source file_'
        : '';
      const outdatedNote = isOutdated
        ? `\n\n$(arrow-circle-up) **Update available:** \`${options.packageVersion}\` → \`${options.latestVersion}\``
        : '';

      this.tooltip = new vscode.MarkdownString(
        `$(package) **${options.packageName}**\n\n` +
          `Version: \`${options.packageVersion}\`\n\n` +
          `${options.isDev ? '$(tools) _Dev dependency_' : '$(library) _Dependency_'}` +
          outdatedNote +
          unusedNote,
        true  // enable icon rendering in tooltip
      );
    } else if (options.kind === 'loading') {
      this.iconPath = new vscode.ThemeIcon('loading~spin');
      this.contextValue = 'loading';
    } else if (options.kind === 'error') {
      this.iconPath = new vscode.ThemeIcon(
        'error',
        new vscode.ThemeColor('errorForeground')
      );
      this.contextValue = 'error';
    } else {
      // group
      this.contextValue = 'group';
      this.iconPath = new vscode.ThemeIcon(
        options.isDev ? 'beaker' : 'package',
        new vscode.ThemeColor(options.isDev ? 'charts.purple' : 'charts.blue')
      );
      if (options.badge) {
        this.description = options.badge;
      }
    }
  }

  // ─── Static factories ──────────────────────────────────────────────────────

  /** Creates a spinner node shown while scanning is in progress */
  public static createLoading(): DependencyItem {
    return new DependencyItem({
      kind: 'loading',
      label: 'Scanning dependencies…',
      packageName: '',
      packageVersion: '',
      isDev: false,
      collapsibleState: vscode.TreeItemCollapsibleState.None,
    });
  }

  /** Creates an error node shown when package.json is missing or malformed */
  public static createError(message: string): DependencyItem {
    return new DependencyItem({
      kind: 'error',
      label: message,
      packageName: '',
      packageVersion: '',
      isDev: false,
      collapsibleState: vscode.TreeItemCollapsibleState.None,
    });
  }
}
