import * as vscode from 'vscode';
import { runCommand, searchNpmPackages } from '../services/npmService';
import { DashboardPackage, ExtensionMessage, RevertInfo, WebviewMessage } from '../types/dashboard';

type OptimisticMutator = (
  packages: DashboardPackage[]
) => DashboardPackage[];

export async function handleWebviewMessage(
  message: WebviewMessage,
  webview: vscode.Webview,
  workspaceRoot: string,
  onRefresh: () => Promise<void>,
  onOptimistic: (mutate: OptimisticMutator) => void = () => { /* no-op when no cache */ }
): Promise<void> {
  const post = (msg: ExtensionMessage): void => {
    void webview.postMessage(msg);
  };

  switch (message.command) {
    case 'ready':
    case 'refresh':
      await onRefresh();
      break;

    case 'uninstall': {
      const { packageName, isDev } = message;
      const revertVersion = message.version?.trim() || null;
      post({ command: 'operationStart', packageName });
      try {
        const cfg = vscode.workspace.getConfiguration('packSight');
        const flags = cfg.get<string>('uninstallFlags', '--legacy-peer-deps').trim();
        const flagStr = flags.length > 0 ? ` ${flags}` : '';
        const saveFlag = isDev ? '--save-dev' : '--save';
        await runCommand(`npm uninstall ${saveFlag} ${packageName}${flagStr}`, workspaceRoot);
        // Always include revertInfo — even if version is unknown, use 'latest' as fallback
        const revertInfo: RevertInfo = {
          packageName,
          version: revertVersion ?? 'latest',
          isDev,
          kind: 'uninstall',
        };
        post({ command: 'operationSuccess', message: `Uninstalled ${packageName}`, revertInfo });
        onOptimistic(pkgs => pkgs.filter(p => p.name !== packageName));
        void onRefresh();
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message.split('\n')[0] : String(err);
        post({ command: 'operationError', message: `Could not uninstall ${packageName} — ${detail}` });
      }
      break;
    }

    case 'update': {
      const { packageName } = message;
      const oldVersion = message.oldVersion?.trim() || null;
      post({ command: 'operationStart', packageName });
      try {
        const flags = vscode.workspace
          .getConfiguration('packSight')
          .get<string>('updateFlags', '--legacy-peer-deps')
          .trim();
        const flagStr = flags.length > 0 ? ` ${flags}` : '';
        await runCommand(`npm install ${packageName}@latest${flagStr}`, workspaceRoot);
        // Always include revertInfo when we have the old version
        const revertInfo: RevertInfo | undefined = oldVersion
          ? { packageName, version: oldVersion, isDev: message.isDev ?? false, kind: 'update' }
          : undefined;
        post({ command: 'operationSuccess', message: `Updated ${packageName} to latest`, revertInfo });
        onOptimistic(pkgs => pkgs.map(p =>
          p.name === packageName
            ? { ...p, version: p.latest ?? p.version, latest: null }
            : p
        ));
        void onRefresh();
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message.split('\n')[0] : String(err);
        post({ command: 'operationError', message: `Could not update ${packageName} — ${detail}` });
      }
      break;
    }

    case 'bulkUpdate': {
      const { packageNames } = message;
      const flags = vscode.workspace
        .getConfiguration('packSight')
        .get<string>('updateFlags', '--legacy-peer-deps')
        .trim();
      const flagStr = flags.length > 0 ? ` ${flags}` : '';
      let failed = 0;
      const succeeded = new Set<string>();

      for (const packageName of packageNames) {
        post({ command: 'operationStart', packageName });
        try {
          await runCommand(`npm install ${packageName}@latest${flagStr}`, workspaceRoot);
          succeeded.add(packageName);
        } catch {
          failed++;
        }
      }

      if (failed === 0) {
        post({ command: 'operationSuccess', message: `Updated ${packageNames.length} package(s) successfully` });
      } else {
        post({ command: 'operationError', message: `${packageNames.length - failed} updated, ${failed} failed` });
      }
      onOptimistic(pkgs => pkgs.map(p =>
        succeeded.has(p.name)
          ? { ...p, version: p.latest ?? p.version, latest: null }
          : p
      ));
      void onRefresh();
      break;
    }

    case 'revert': {
      const { packageName, version, isDev } = message;
      post({ command: 'operationStart', packageName });
      try {
        const cfg = vscode.workspace.getConfiguration('packSight');
        const flags = cfg.get<string>('updateFlags', '--legacy-peer-deps').trim();
        const flagStr = flags.length > 0 ? ` ${flags}` : '';
        const saveFlag = isDev ? '--save-dev' : '--save';
        // Re-install the specific version (works for both uninstall revert and update downgrade)
        await runCommand(`npm install ${saveFlag} ${packageName}@${version}${flagStr}`, workspaceRoot);
        post({ command: 'operationSuccess', message: `Reverted ${packageName} to ${version}` });
        void onRefresh();
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message.split('\n')[0] : String(err);
        post({ command: 'operationError', message: `Could not revert ${packageName} — ${detail}` });
      }
      break;
    }

    case 'openChangelog': {
      const { url } = message;
      await vscode.env.openExternal(vscode.Uri.parse(url));
      break;
    }

    case 'openNpm': {
      const { packageName } = message;
      await vscode.commands.executeCommand(
        'vscode.open',
        vscode.Uri.parse(`https://www.npmjs.com/package/${encodeURIComponent(packageName)}`)
      );
      break;
    }

    case 'searchPackages': {
      const { query } = message;
      try {
        const results = await searchNpmPackages(query);
        post({ command: 'searchResults', results });
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message.split('\n')[0] : String(err);
        post({ command: 'searchError', message: detail });
      }
      break;
    }

    case 'installPackage': {
      const { packageName, isDev } = message;
      post({ command: 'operationStart', packageName });
      try {
        const cfg = vscode.workspace.getConfiguration('packSight');
        const flags = cfg.get<string>('updateFlags', '--legacy-peer-deps').trim();
        const flagStr = flags.length > 0 ? ` ${flags}` : '';
        const saveFlag = isDev ? '--save-dev' : '--save';
        await runCommand(`npm install ${saveFlag} ${packageName}${flagStr}`, workspaceRoot);
        post({ command: 'operationSuccess', message: `Installed ${packageName}` });
        onOptimistic(pkgs => {
          if (pkgs.some(p => p.name === packageName)) { return pkgs; }
          return [...pkgs, {
            name: packageName, version: 'latest', latest: null,
            isUnused: false, isDev, lastUpdated: null, size: null,
            repoUrl: null, vulnSeverity: null,
          }];
        });
        void onRefresh();
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message.split('\n')[0] : String(err);
        post({ command: 'operationError', message: `Could not install ${packageName} — ${detail}` });
      }
      break;
    }
  }
}
