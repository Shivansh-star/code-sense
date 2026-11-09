/**
 * fileWalker.js
 *
 * Recursively walks a directory tree and collects all JS/TS source files,
 * skipping common noise directories (node_modules, dist, .git, build, etc.).
 */

import fs from 'fs';
import path from 'path';

const SUPPORTED_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.py']);
const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  'build',
  'out',
  '.next',
  '.nuxt',
  'coverage',
  '__pycache__',
  '.cache',
  'vendor',
]);

/**
 * Walk `dir` recursively and return an array of absolute file paths
 * for every JS/TS file found.
 *
 * @param {string} dir  Root directory to start from.
 * @returns {string[]}
 */
export function walkDirectory(dir) {
  const results = [];

  function walk(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return; // Permission error or broken symlink – skip silently
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;

      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return results;
}
