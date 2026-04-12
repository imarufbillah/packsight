import * as fs from 'fs';
import * as path from 'path';
import { parse, type TSESTree } from '@typescript-eslint/typescript-estree';
import { collectSourceFiles } from '../utils/fileScanner';
import { extractPackageName } from '../utils/packageNameExtractor';

// ─── Scan cache ───────────────────────────────────────────────────────────────
// Key: workspaceRoot, Value: { result, filesMtime }
// Invalidated when any scanned file's mtime changes or files are added/removed.

interface ScanCache {
  result: Set<string>;
  /** Sorted list of "filepath:mtime" strings used as a fingerprint */
  fingerprint: string;
}

const scanCache = new Map<string, ScanCache>();

/** Invalidate the scan cache for a workspace (call when source files change). */
export function invalidateScanCache(workspaceRoot: string): void {
  scanCache.delete(workspaceRoot);
}

function buildFingerprint(files: string[]): string {
  return files
    .map(f => {
      try { return `${f}:${fs.statSync(f).mtimeMs}`; } catch { return f; }
    })
    .join('|');
}

/**
 * Scans all source files in the workspace using AST parsing and returns
 * the set of npm package names that are actually imported at runtime.
 * Results are cached and only re-computed when source files change.
 */
export function scanUsedPackages(workspaceRoot: string): Set<string> {
  const files = collectSourceFiles(workspaceRoot);
  const fingerprint = buildFingerprint(files);

  const cached = scanCache.get(workspaceRoot);
  if (cached && cached.fingerprint === fingerprint) {
    return cached.result;
  }

  const used = new Set<string>();

  for (const filePath of files) {
    try {
      const source = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath);
      const isTs = ext === '.ts' || ext === '.tsx';

      const ast = parse(source, {
        jsx: ext === '.jsx' || ext === '.tsx',
        ...(isTs ? { range: false } : {}),
        errorRecovery: true,
      });

      collectFromAst(ast, used);
    } catch {
      // Unparseable file — skip and continue
    }
  }

  scanCache.set(workspaceRoot, { result: used, fingerprint });
  return used;
}

// ─── AST traversal ────────────────────────────────────────────────────────────

type AstNode = TSESTree.Node;

/**
 * Walks the top-level statements of a program and extracts package names
 * from import declarations and require() calls.
 */
function collectFromAst(
  ast: TSESTree.Program,
  used: Set<string>
): void {
  for (const node of ast.body) {
    handleStatement(node, used);
  }
}

function handleStatement(node: AstNode, used: Set<string>): void {
  switch (node.type) {
    case 'ImportDeclaration':
      handleImportDeclaration(node as TSESTree.ImportDeclaration, used);
      break;

    case 'ExpressionStatement':
      handleExpressionStatement(node as TSESTree.ExpressionStatement, used);
      break;

    case 'VariableDeclaration':
      handleVariableDeclaration(node as TSESTree.VariableDeclaration, used);
      break;

    default:
      break;
  }
}

/** Handles ES module `import` statements */
function handleImportDeclaration(
  node: TSESTree.ImportDeclaration,
  used: Set<string>
): void {
  // `import type` declarations are erased at compile time — skip them
  if (node.importKind === 'type') {
    return;
  }

  addSpecifier(String(node.source.value), used);
}

/** Handles bare expression statements — catches `require('pkg')` */
function handleExpressionStatement(
  node: TSESTree.ExpressionStatement,
  used: Set<string>
): void {
  extractRequireSpecifier(node.expression, used);
}

/** Handles `const x = require('pkg')` and `const { x } = require('pkg')` */
function handleVariableDeclaration(
  node: TSESTree.VariableDeclaration,
  used: Set<string>
): void {
  for (const declarator of node.declarations) {
    if (declarator.init) {
      extractRequireSpecifier(declarator.init, used);
    }
  }
}

/**
 * Checks whether an expression is a `require('...')` call and, if so,
 * records the package name.
 */
function extractRequireSpecifier(
  node: TSESTree.Expression | TSESTree.PrivateIdentifier,
  used: Set<string>
): void {
  if (node.type !== 'CallExpression') {
    return;
  }

  const call = node as TSESTree.CallExpression;

  if (
    call.callee.type !== 'Identifier' ||
    (call.callee as TSESTree.Identifier).name !== 'require'
  ) {
    return;
  }

  if (call.arguments.length === 0) {
    return;
  }

  const arg = call.arguments[0];
  if (arg.type === 'Literal' && typeof arg.value === 'string') {
    addSpecifier(arg.value, used);
  }
}

/** Extracts the package name from a specifier and adds it to the set */
function addSpecifier(specifier: string, used: Set<string>): void {
  const name = extractPackageName(specifier);
  if (name !== null) {
    used.add(name);
  }
}
