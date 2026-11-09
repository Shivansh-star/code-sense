/**
 * parser.ts-loader.js
 *
 * Loads TypeScript tree-sitter grammars.
 * tree-sitter-typescript ships two grammars:
 *   - typescript  (for .ts files)
 *   - tsx         (for .tsx files)
 *
 * We load them lazily so the parser service can import them safely.
 */

import treeSitterTypescript from 'tree-sitter-typescript';

export const typescriptParser = treeSitterTypescript.typescript;
export const tsxParser = treeSitterTypescript.tsx;
