import * as vscode from 'vscode';
import * as cp from 'child_process';

export interface OutdatedEntry {
  current: string;
  wanted: string;
  latest: string;
}

/** Raw shape returned by `npm outdated --json` */
type RawOutdatedJson = Record<
  string,
  { current: string; wanted: string; latest: string }
>;

/**
 * Runs an npm command in the VS Code integrated terminal and resolves
 * when the terminal is closed (i.e. the command has finished).
 *
 * @param command   - Full command string, e.g. `npm uninstall lodash`
 * @param cwd       - Working directory (workspace root)
 * @param termName  - Label shown on the terminal tab
 */
export function runInTerminal(
  command: string,
  cwd: string,
  termName: string
): Promise<void> {
  return new Promise((resolve) => {
    const terminal = vscode.window.createTerminal({
      name: termName,
      cwd,
      // Exit the shell automatically when the command finishes so we can
      // detect closure via onDidCloseTerminal.
      shellArgs: [],
    });

    // Send the command followed by `exit` so the terminal closes on completion
    terminal.sendText(`${command} ; exit`);
    terminal.show(true);

    const disposable = vscode.window.onDidCloseTerminal((closed) => {
      if (closed === terminal) {
        disposable.dispose();
        resolve();
      }
    });
  });
}

/**
 * Runs `npm outdated --json` synchronously and returns a map of
 * package name → { current, wanted, latest }.
 *
 * npm outdated exits with code 1 when outdated packages exist, so we
 * must not throw on non-zero exit — we parse stdout regardless.
 *
 * @param workspaceRoot - Absolute path to the workspace root
 */
export function getOutdatedPackages(
  workspaceRoot: string
): Map<string, OutdatedEntry> {
  let stdout = '';

  try {
    stdout = cp.execSync('npm outdated --json', {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      // npm outdated exits 1 when packages are outdated — suppress throw
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err: unknown) {
    // execSync throws when exit code !== 0; stdout is still on the error object
    if (isExecError(err) && err.stdout) {
      stdout = err.stdout;
    } else {
      return new Map();
    }
  }

  if (!stdout.trim()) {
    return new Map();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return new Map();
  }

  if (!isRawOutdatedJson(parsed)) {
    return new Map();
  }

  const result = new Map<string, OutdatedEntry>();
  for (const [name, info] of Object.entries(parsed)) {
    result.set(name, {
      current: info.current,
      wanted: info.wanted,
      latest: info.latest,
    });
  }
  return result;
}

/**
 * Runs an npm command as a background child process (no terminal window).
 * Resolves on exit code 0, rejects with stderr on any non-zero exit.
 *
 * Used by the dashboard so it can detect success/failure and post the
 * correct message back to the webview without relying on terminal close events.
 *
 * @param command       - Full command string, e.g. `npm uninstall lodash`
 * @param workspaceRoot - Working directory (workspace root)
 */
export function runCommand(
  command: string,
  workspaceRoot: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    cp.exec(command, { cwd: workspaceRoot }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Fetches the publish date of a specific installed package version from the
 * npm registry. Returns an ISO date string or null if unavailable/offline.
 *
 * Uses the per-version endpoint: GET https://registry.npmjs.org/<name>/<version>
 * which is a small JSON document containing a `time` field.
 *
 * @param name    - Package name
 * @param version - Installed version string (e.g. "1.2.3")
 */
export async function getPackageLastUpdated(
  name: string,
  version: string
): Promise<string | null> {
  return new Promise((resolve) => {
    // Strip semver range prefixes that may appear in package.json
    const clean = version.replace(/^[\^~>=<]+/, '');
    const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(clean)}`;

    const https = require('https') as typeof import('https');
    const req = https.get(url, { timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => {
        try {
          const json = JSON.parse(body) as Record<string, unknown>;
          // The per-version doc has a top-level `time` string
          const time = typeof json['time'] === 'string' ? json['time'] : null;
          resolve(time);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * Fetches last-updated dates for all packages in parallel, capped at
 * `concurrency` simultaneous requests to avoid hammering the registry.
 */
export async function getPackagesLastUpdated(
  packages: Array<{ name: string; version: string }>
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const concurrency = 6;
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < packages.length) {
      const pkg = packages[idx++];
      const date = await getPackageLastUpdated(pkg.name, pkg.version);
      if (date !== null) {
        result.set(pkg.name, date);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, packages.length) }, worker);
  await Promise.all(workers);
  return result;
}

interface ExecError {
  stdout: string;
  stderr: string;
}

function isExecError(value: unknown): value is ExecError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'stdout' in value &&
    typeof (value as ExecError).stdout === 'string'
  );
}

function isRawOutdatedJson(value: unknown): value is RawOutdatedJson {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
