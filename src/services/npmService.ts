import * as vscode from 'vscode';
import * as cp from 'child_process';

export interface OutdatedEntry {
  current: string;
  wanted: string;
  latest: string;
}

// ─── In-flight deduplication ──────────────────────────────────────────────────
// If the same async fetch is triggered concurrently (e.g. dashboard + sidebar
// both loading at the same time), the second caller gets the same Promise
// instead of spawning a duplicate set of child processes.
const inFlight = new Map<string, Promise<unknown>>();

function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) { return existing as Promise<T>; }
  const p = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

// ─── Per-package registry data (batched) ─────────────────────────────────────

/** All registry data fetched in a single npm view call per package */
export interface PackageRegistryData {
  latest: string | null;
  lastUpdated: string | null;
  size: number | null;
  repoUrl: string | null;
}

/** Raw shape returned by `npm view <pkg> --json` */
interface NpmViewRaw {
  version?: string;
  time?: Record<string, string>;
  dist?: { unpackedSize?: number };
  repository?: { url?: string } | string;
}

/**
 * Fetches version, publish date, size, and repository URL for a single
 * package in ONE `npm view` call instead of four separate calls.
 * This reduces child-process overhead by ~75%.
 */
function fetchPackageRegistryData(
  name: string,
  installedVersion: string
): Promise<PackageRegistryData> {
  const clean = installedVersion.replace(/^[^\d]+/, '') || installedVersion;
  return new Promise((resolve) => {
    cp.exec(
      `npm view ${name} version time dist.unpackedSize repository.url --json`,
      { timeout: 15000 },
      (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve({ latest: null, lastUpdated: null, size: null, repoUrl: null });
          return;
        }
        try {
          const raw = JSON.parse(stdout.trim()) as NpmViewRaw;

          // Latest version
          const latest = typeof raw.version === 'string' ? raw.version : null;

          // Publish date of installed version
          let lastUpdated: string | null = null;
          if (raw.time && typeof raw.time === 'object') {
            lastUpdated = raw.time[clean] ?? null;
          }

          // Unpacked size
          const size = (raw.dist?.unpackedSize && raw.dist.unpackedSize > 0)
            ? raw.dist.unpackedSize
            : null;

          // GitHub releases URL
          let repoUrl: string | null = null;
          if (raw.repository) {
            const rawUrl = typeof raw.repository === 'string'
              ? raw.repository
              : (raw.repository.url ?? '');
            repoUrl = normaliseToReleasesUrl(rawUrl);
          }

          resolve({ latest, lastUpdated, size, repoUrl });
        } catch {
          resolve({ latest: null, lastUpdated: null, size: null, repoUrl: null });
        }
      }
    );
  });
}

/**
 * Fetches registry data for all packages with controlled concurrency.
 * Uses in-flight deduplication so simultaneous callers share results.
 */
export async function getPackageRegistryDataBatch(
  packages: Array<{ name: string; version: string }>
): Promise<Map<string, PackageRegistryData>> {
  const dedupeKey = 'registry:' + packages.map(p => `${p.name}@${p.version}`).join(',');
  return dedupe(dedupeKey, () => _fetchBatch(packages));
}

async function _fetchBatch(
  packages: Array<{ name: string; version: string }>
): Promise<Map<string, PackageRegistryData>> {
  const result = new Map<string, PackageRegistryData>();
  const concurrency = 5; // reduced from 8 to avoid overwhelming the registry
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < packages.length) {
      const pkg = packages[idx++];
      const data = await fetchPackageRegistryData(pkg.name, pkg.version);
      result.set(pkg.name, data);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, packages.length) }, worker);
  await Promise.all(workers);
  return result;
}

// ─── Derived helpers (kept for backward compatibility) ────────────────────────

/**
 * Returns outdated packages derived from the batched registry data.
 * Kept so existing callers (sidebar) don't need to change.
 */
export async function getOutdatedPackages(
  packages: Array<{ name: string; version: string }>
): Promise<Map<string, OutdatedEntry>> {
  const batch = await getPackageRegistryDataBatch(packages);
  const result = new Map<string, OutdatedEntry>();
  for (const pkg of packages) {
    const data = batch.get(pkg.name);
    if (!data?.latest) { continue; }
    const installed = pkg.version.replace(/^[^\d]+/, '') || pkg.version;
    if (data.latest !== installed && isNewer(data.latest, installed)) {
      result.set(pkg.name, { current: installed, wanted: data.latest, latest: data.latest });
    }
  }
  return result;
}

export async function getPackagesLastUpdated(
  packages: Array<{ name: string; version: string }>
): Promise<Map<string, string>> {
  const batch = await getPackageRegistryDataBatch(packages);
  const result = new Map<string, string>();
  for (const [name, data] of batch) {
    if (data.lastUpdated) { result.set(name, data.lastUpdated); }
  }
  return result;
}

export async function getPackageSizes(
  packages: Array<{ name: string; version: string }>
): Promise<Map<string, number>> {
  const batch = await getPackageRegistryDataBatch(packages);
  const result = new Map<string, number>();
  for (const [name, data] of batch) {
    if (data.size !== null) { result.set(name, data.size); }
  }
  return result;
}

export async function getPackageRepoUrls(
  packages: Array<{ name: string }>
): Promise<Map<string, string>> {
  // repoUrl is fetched as part of the batch; this overload accepts name-only
  // so we need the version — fall back to fetching individually if not cached
  const result = new Map<string, string>();
  // Check if batch data is already in-flight or cached via the batch key
  // For name-only callers, do a lightweight individual fetch
  const concurrency = 5;
  let idx = 0;
  const pkgs = packages as Array<{ name: string; version?: string }>;

  async function worker(): Promise<void> {
    while (idx < pkgs.length) {
      const pkg = pkgs[idx++];
      const url = await fetchRepoUrlOnly(pkg.name);
      if (url !== null) { result.set(pkg.name, url); }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, pkgs.length) }, worker);
  await Promise.all(workers);
  return result;
}

function fetchRepoUrlOnly(name: string): Promise<string | null> {
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

// ─── Semver helpers ───────────────────────────────────────────────────────────

function isNewer(a: string, b: string): boolean {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (pa[0] !== pb[0]) { return pa[0] > pb[0]; }
  if (pa[1] !== pb[1]) { return pa[1] > pb[1]; }
  return pa[2] > pb[2];
}

function parseSemver(v: string): [number, number, number] {
  const m = v.replace(/^[^\d]+/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : [0, 0, 0];
}

function normaliseToReleasesUrl(raw: string): string | null {
  const cleaned = raw
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^ssh:\/\/git@/, 'https://')
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/\.git$/, '');
  try {
    const url = new URL(cleaned);
    if (url.hostname !== 'github.com') { return null; }
    return `https://github.com${url.pathname}/releases`;
  } catch {
    return null;
  }
}

// ─── Runtime versions (cached for session) ───────────────────────────────────

let runtimeCache: { node: string | null; npm: string | null } | null = null;

/**
 * Fetches node/npm versions once per session and caches the result.
 * These never change during a VS Code session.
 */
export async function getRuntimeVersions(): Promise<{ node: string | null; npm: string | null }> {
  if (runtimeCache) { return runtimeCache; }
  return dedupe('runtime', async () => {
    const [node, npm] = await Promise.all([
      new Promise<string | null>((resolve) => {
        cp.exec('node --version', { timeout: 5000 }, (err, stdout) => {
          resolve(err || !stdout.trim() ? null : stdout.trim().replace(/^v/, ''));
        });
      }),
      new Promise<string | null>((resolve) => {
        cp.exec('npm --version', { timeout: 5000 }, (err, stdout) => {
          resolve(err || !stdout.trim() ? null : stdout.trim());
        });
      }),
    ]);
    runtimeCache = { node, npm };
    return runtimeCache;
  });
}

// ─── npm audit (cached, invalidated by package.json changes) ─────────────────

export type VulnSeverity = 'critical' | 'high' | 'moderate' | 'low';

interface AuditCache {
  result: Map<string, VulnSeverity>;
  pkgJsonHash: string;
}

let auditCache: AuditCache | null = null;

/** Invalidate the audit cache (call when package.json changes). */
export function invalidateAuditCache(): void {
  auditCache = null;
}

/**
 * Runs `npm audit --json` and caches the result keyed by package.json content.
 * Re-runs only when package.json actually changes.
 */
export async function getVulnerabilities(
  workspaceRoot: string,
  pkgJsonContent?: string
): Promise<Map<string, VulnSeverity>> {
  const hash = pkgJsonContent ?? workspaceRoot;

  if (auditCache && auditCache.pkgJsonHash === hash) {
    return auditCache.result;
  }

  return dedupe(`audit:${workspaceRoot}`, async () => {
    const result = await _runAudit(workspaceRoot);
    auditCache = { result, pkgJsonHash: hash };
    return result;
  });
}

async function _runAudit(workspaceRoot: string): Promise<Map<string, VulnSeverity>> {
  const SEVERITY_RANK: Record<string, number> = {
    critical: 4, high: 3, moderate: 2, low: 1, info: 0,
  };

  function rankSeverity(result: Map<string, VulnSeverity>, name: string, sev: string): void {
    const s = sev.toLowerCase();
    if (!(s in SEVERITY_RANK) || s === 'info') { return; }
    const existing = result.get(name);
    if (!existing || SEVERITY_RANK[s] > SEVERITY_RANK[existing]) {
      result.set(name, s as VulnSeverity);
    }
  }

  return new Promise((resolve) => {
    cp.exec(
      'npm audit --json',
      { cwd: workspaceRoot, timeout: 30000 },
      (_error, stdout) => {
        if (!stdout.trim()) { resolve(new Map()); return; }
        try {
          const data = JSON.parse(stdout.trim()) as Record<string, unknown>;
          if (data['error']) { resolve(new Map()); return; }

          const result = new Map<string, VulnSeverity>();

          const vulnsV2 = data['vulnerabilities'];
          if (vulnsV2 && typeof vulnsV2 === 'object') {
            for (const [name, info] of Object.entries(vulnsV2 as Record<string, Record<string, unknown>>)) {
              rankSeverity(result, name, String(info['severity'] ?? ''));
            }
            resolve(result);
            return;
          }

          const advisories = data['advisories'];
          if (advisories && typeof advisories === 'object') {
            for (const advisory of Object.values(advisories as Record<string, Record<string, unknown>>)) {
              const sev = String(advisory['severity'] ?? '');
              const findings = advisory['findings'];
              if (Array.isArray(findings)) {
                for (const finding of findings as Array<Record<string, unknown>>) {
                  const paths = finding['paths'];
                  if (Array.isArray(paths)) {
                    for (const p of paths as string[]) {
                      rankSeverity(result, p.split('>').pop() ?? p, sev);
                    }
                  }
                }
              }
            }
          }
          resolve(result);
        } catch {
          resolve(new Map());
        }
      }
    );
  });
}

// ─── npm search ───────────────────────────────────────────────────────────────

export async function searchNpmPackages(
  query: string,
  size = 10
): Promise<Array<{ name: string; version: string; description: string; weeklyDownloads: number | null }>> {
  return new Promise((resolve) => {
    cp.exec(
      `npm search ${JSON.stringify(query)} --json --searchlimit ${size}`,
      { timeout: 15000 },
      (error, stdout) => {
        if (error || !stdout.trim()) { resolve([]); return; }
        try {
          const raw = JSON.parse(stdout.trim());
          if (!Array.isArray(raw)) { resolve([]); return; }
          resolve(
            raw.slice(0, size).map((item: Record<string, unknown>) => ({
              name: typeof item['name'] === 'string' ? item['name'] : '',
              version: typeof item['version'] === 'string' ? item['version'] : '',
              description: typeof item['description'] === 'string' ? item['description'] : '',
              weeklyDownloads: null,
            })).filter(r => r.name.length > 0)
          );
        } catch {
          resolve([]);
        }
      }
    );
  });
}

// ─── npm run (background, no terminal) ───────────────────────────────────────

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

export function runInTerminal(
  command: string,
  cwd: string,
  termName: string
): Promise<void> {
  return new Promise((resolve) => {
    const terminal = vscode.window.createTerminal({ name: termName, cwd, shellArgs: [] });
    terminal.sendText(`${command} ; exit`);
    terminal.show(true);
    const disposable = vscode.window.onDidCloseTerminal((closed) => {
      if (closed === terminal) { disposable.dispose(); resolve(); }
    });
  });
}
