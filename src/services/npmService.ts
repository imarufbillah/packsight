import * as vscode from 'vscode';
import * as cp from 'child_process';

export interface OutdatedEntry {
  current: string;
  wanted: string;
  latest: string;
}


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
 * Fetches the true latest version for each package from the npm registry
 * and compares it against the installed version, ignoring semver ranges.
 *
 * Unlike `npm outdated`, this detects updates even when the installed version
 * satisfies the package.json range (e.g. installed 6.0.0, latest 6.0.1,
 * range ^6.0.0 — npm outdated would miss this).
 *
 * @param packages - Array of { name, version } from package.json
 */
export async function getOutdatedPackages(
  packages: Array<{ name: string; version: string }>
): Promise<Map<string, OutdatedEntry>> {
  const result = new Map<string, OutdatedEntry>();
  const concurrency = 8;
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < packages.length) {
      const pkg = packages[idx++];
      const installed = pkg.version.replace(/^[\^~>=<\s]+/, '');
      try {
        const latest = await getRegistryLatest(pkg.name);
        if (latest && latest !== installed && isNewer(latest, installed)) {
          result.set(pkg.name, { current: installed, wanted: latest, latest });
        }
      } catch {
        // skip on network error
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, packages.length) },
    worker
  );
  await Promise.all(workers);
  return result;
}

/**
 * Fetches the dist-tags.latest version for a package from the npm registry.
 */
function getRegistryLatest(name: string): Promise<string | null> {
  return new Promise((resolve) => {
    cp.exec(
      `npm view ${name} version --json`,
      { timeout: 10000 },
      (error, stdout) => {
        if (error || !stdout.trim()) { resolve(null); return; }
        try {
          const v = JSON.parse(stdout.trim());
          resolve(typeof v === 'string' ? v : null);
        } catch {
          resolve(null);
        }
      }
    );
  });
}

/**
 * Returns true if `a` is strictly newer than `b` using semver comparison.
 * Handles major.minor.patch only — pre-release tags are ignored.
 */
function isNewer(a: string, b: string): boolean {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (pa[0] !== pb[0]) return pa[0] > pb[0];
  if (pa[1] !== pb[1]) return pa[1] > pb[1];
  return pa[2] > pb[2];
}

function parseSemver(v: string): [number, number, number] {
  const m = v.replace(/^[\^~>=<\s]+/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : [0, 0, 0];
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
 * Fetches the publish date of a specific installed package version.
 * Uses `npm view <pkg>@<version> time --json` which reads from the npm
 * cache when available — fast and no raw HTTP required.
 *
 * Returns an ISO date string or null if unavailable.
 */
export async function getPackageLastUpdated(
  name: string,
  version: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const clean = version.replace(/^[\^~>=<\s]+/, '');
    cp.exec(
      `npm view ${name}@${clean} time --json`,
      { timeout: 10000 },
      (error, stdout) => {
        if (error || !stdout.trim()) { resolve(null); return; }
        try {
          const timeMap = JSON.parse(stdout.trim()) as Record<string, string>;
          resolve(timeMap[clean] ?? null);
        } catch {
          resolve(null);
        }
      }
    );
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

/**
 * Fetches the unpacked size (bytes) for each package's installed version
 * using `npm view <pkg>@<version> dist.unpackedSize --json`.
 */
export async function getPackageSizes(
  packages: Array<{ name: string; version: string }>
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const concurrency = 8;
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < packages.length) {
      const pkg = packages[idx++];
      const clean = pkg.version.replace(/^[\^~>=<\s]+/, '');
      await new Promise<void>((resolve) => {
        cp.exec(
          `npm view ${pkg.name}@${clean} dist.unpackedSize --json`,
          { timeout: 10000 },
          (error, stdout) => {
            if (!error && stdout.trim()) {
              try {
                const v = JSON.parse(stdout.trim());
                if (typeof v === 'number' && v > 0) result.set(pkg.name, v);
              } catch { /* skip */ }
            }
            resolve();
          }
        );
      });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, packages.length) }, worker);
  await Promise.all(workers);
  return result;
}

/**
 * Fetches the GitHub releases URL for each package by reading the
 * `repository.url` field from the npm registry.
 *
 * Normalises git+https / git+ssh / http URLs to a plain
 * https://github.com/<owner>/<repo>/releases URL.
 * Returns null for packages with no repository or non-GitHub hosts.
 */
export async function getPackageRepoUrls(
  packages: Array<{ name: string }>
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const concurrency = 8;
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < packages.length) {
      const pkg = packages[idx++];
      const url = await fetchRepoUrl(pkg.name);
      if (url !== null) {
        result.set(pkg.name, url);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, packages.length) }, worker);
  await Promise.all(workers);
  return result;
}

function fetchRepoUrl(name: string): Promise<string | null> {
  return new Promise((resolve) => {
    cp.exec(
      `npm view ${name} repository.url --json`,
      { timeout: 10000 },
      (error, stdout) => {
        if (error || !stdout.trim()) { resolve(null); return; }
        try {
          const raw = JSON.parse(stdout.trim());
          if (typeof raw !== 'string') { resolve(null); return; }
          resolve(normaliseToReleasesUrl(raw));
        } catch {
          resolve(null);
        }
      }
    );
  });
}

/**
 * Converts any git/http repository URL to a https://github.com/.../releases URL.
 * Returns null if the URL is not a GitHub URL.
 */
function normaliseToReleasesUrl(raw: string): string | null {
  // Strip common prefixes: git+https://, git+ssh://git@, git://
  const cleaned = raw
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^ssh:\/\/git@/, 'https://')
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/\.git$/, '');

  try {
    const url = new URL(cleaned);
    if (url.hostname !== 'github.com') { return null; }
    // pathname is /<owner>/<repo>
    return `https://github.com${url.pathname}/releases`;
  } catch {
    return null;
  }
}

/**
 * Fetches the currently active Node.js and npm versions by running
 * `node --version` and `npm --version` in the workspace.
 * Returns null for either if the binary is not found or errors.
 */
export async function getRuntimeVersions(): Promise<{ node: string | null; npm: string | null }> {
  const [node, npm] = await Promise.all([
    new Promise<string | null>((resolve) => {
      cp.exec('node --version', { timeout: 5000 }, (err, stdout) => {
        if (err || !stdout.trim()) { resolve(null); return; }
        resolve(stdout.trim().replace(/^v/, ''));
      });
    }),
    new Promise<string | null>((resolve) => {
      cp.exec('npm --version', { timeout: 5000 }, (err, stdout) => {
        if (err || !stdout.trim()) { resolve(null); return; }
        resolve(stdout.trim());
      });
    }),
  ]);
  return { node, npm };
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
