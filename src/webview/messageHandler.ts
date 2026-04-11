import * as vscode from 'vscode';
import { runCommand, searchNpmPackages } from '../services/npmService';
import { ExtensionMessage, WebviewMessage } from '../types/dashboard';

/**
 * Handles a postMessage arriving from the webview.
 *
 * Uses `runCommand` (child_process.exec) rather than `runInTerminal` so that:
 *  - Operations run silently in the background (no terminal window pops up)
 *  - We get a real success/failure signal to post back to the webview
 *  - Works cross-platform (no `; exit` shell separator needed)
 *
 * @param message       - Discriminated-union message from the webview
 * @param webview       - The panel's webview (used to post replies)
 * @param workspaceRoot - Absolute path to the workspace root
 * @param onRefresh     - Callback that re-fetches data and sends loadData
 */
export async function handleWebviewMessage(
  message: WebviewMessage,
  webview: vscode.Webview,
  workspaceRoot: string,
  onRefresh: () => Promise<void>
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
      post({ command: 'operationStart', packageName });
      try {
        const cfg = vscode.workspace.getConfiguration('packSight');
        const flags = cfg.get<string>('uninstallFlags', '--legacy-peer-deps').trim();
        const flagStr = flags.length > 0 ? ` ${flags}` : '';
        const saveFlag = isDev ? '--save-dev' : '--save';
        await runCommand(`npm uninstall ${saveFlag} ${packageName}${flagStr}`, workspaceRoot);
        post({ command: 'operationSuccess', message: `Uninstalled ${packageName}` });
        await onRefresh();
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message.split('\n')[0] : String(err);
        post({ command: 'operationError', message: `Could not uninstall ${packageName} — ${detail}` });
      }
      break;
    }

    case 'update': {
      const { packageName } = message;
      post({ command: 'operationStart', packageName });
      try {
        const flags = vscode.workspace
          .getConfiguration('packSight')
          .get<string>('updateFlags', '--legacy-peer-deps')
          .trim();
        const flagStr = flags.length > 0 ? ` ${flags}` : '';
        await runCommand(`npm install ${packageName}@latest${flagStr}`, workspaceRoot);
        post({ command: 'operationSuccess', message: `Updated ${packageName} to latest` });
        await onRefresh();
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

      for (const packageName of packageNames) {
        post({ command: 'operationStart', packageName });
        try {
          await runCommand(`npm install ${packageName}@latest${flagStr}`, workspaceRoot);
        } catch {
          failed++;
        }
      }

      if (failed === 0) {
        post({ command: 'operationSuccess', message: `Updated ${packageNames.length} package(s) successfully` });
      } else {
        post({ command: 'operationError', message: `${packageNames.length - failed} updated, ${failed} failed` });
      }
      await onRefresh();
      break;
    }

    case 'openChangelog': {
      const { url } = message;
      await vscode.env.openExternal(vscode.Uri.parse(url));
      break;
    }

    case 'openNpm': {
      const { packageName } = message;
      // executeCommand('vscode.open') bypasses the trusted-domain prompt
      // that env.openExternal triggers for external https:// URLs.
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
        await onRefresh();
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message.split('\n')[0] : String(err);
        post({ command: 'operationError', message: `Could not install ${packageName} — ${detail}` });
      }
      break;
    }
  }
}
