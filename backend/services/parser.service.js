/**
 * parser.service.js
 *
 * Uses tree-sitter to parse JS/TS files and extract top-level
 * function_declaration, class_declaration, method_definition,
 * and arrow_function (when assigned to a variable) nodes.
 *
 * Each extracted chunk carries rich metadata for RAG retrieval.
 */

import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import { typescriptParser, tsxParser } from './parser.ts-loader.js';
import fs from 'fs';
import path from 'path';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return a tree-sitter parser pre-loaded with the right grammar
 * based on file extension.
 */
function getParser(ext) {
  const parser = new Parser();
  switch (ext) {
    case '.ts':
      parser.setLanguage(typescriptParser);
      break;
    case '.tsx':
      parser.setLanguage(tsxParser);
      break;
    case '.py':
      parser.setLanguage(Python);
      break;
    case '.js':
    case '.jsx':
    default:
      parser.setLanguage(JavaScript);
      break;
  }
  return parser;
}

/**
 * Walk the tree-sitter CST and collect nodes of the target types.
 * We only descend into the tree up to a configurable depth to avoid
 * capturing deeply-nested closures as independent chunks.
 */
function collectTargetNodes(node, targetTypes, depth = 0, maxDepth = 3) {
  const results = [];
  if (depth > maxDepth) return results;

  if (targetTypes.includes(node.type)) {
    results.push(node);
    // Do NOT descend into this node – its children are part of this chunk.
    return results;
  }

  for (const child of node.children) {
    results.push(...collectTargetNodes(child, targetTypes, depth + 1, maxDepth));
  }
  return results;
}

/**
 * Try to extract a meaningful name from a node.
 * Works for function declarations, class declarations, and
 * variable declarators containing arrow functions.
 */
function extractName(node, sourceCode) {
  // function_declaration / class_declaration → first named child is the identifier
  const nameNode = node.childForFieldName?.('name');
  if (nameNode) return nameNode.text;

  // arrow_function inside a variable_declarator → parent's name field
  if (node.parent?.type === 'variable_declarator') {
    const parentName = node.parent.childForFieldName?.('name');
    if (parentName) return parentName.text;
  }

  // method_definition → key field
  const keyNode = node.childForFieldName?.('key');
  if (keyNode) return keyNode.text;

  // Fallback – first 40 chars of source
  return sourceCode.slice(node.startIndex, node.startIndex + 40).replace(/\n/g, ' ');
}

// ─── Main export ──────────────────────────────────────────────────────────────

const TARGET_TYPES = [
  'function_declaration',
  'function_definition', // Python def foo():
  'class_declaration',
  'class_definition',    // Python class Foo:
  'method_definition',
  // Arrow functions that are bound to a variable: `const foo = () => {}`
  'arrow_function',
  'function_expression',
];

/**
 * Parse a single source file and return an array of code chunks.
 *
 * @param {string} filePath   Absolute path to the source file.
 * @param {string} repoRoot   Absolute path to the cloned repo root (for relative paths).
 * @returns {Array<{
 *   id:           string,
 *   code:         string,
 *   filePath:     string,
 *   functionName: string,
 *   nodeType:     string,
 *   startLine:    number,
 *   endLine:      number,
 * }>}
 */
export function parseFile(filePath, repoRoot) {
  const ext = path.extname(filePath).toLowerCase();
  const sourceCode = fs.readFileSync(filePath, 'utf8');

  let parser;
  try {
    parser = getParser(ext);
  } catch (err) {
    console.warn(`[parser] Skipping ${filePath}: ${err.message}`);
    return [];
  }

  let tree;
  try {
    tree = parser.parse(sourceCode);
  } catch (err) {
    console.warn(`[parser] Failed to parse ${filePath}: ${err.message}`);
    return [];
  }

  const nodes = collectTargetNodes(tree.rootNode, TARGET_TYPES);
  const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');

  const chunks = [];
  for (const node of nodes) {
    const code = sourceCode.slice(node.startIndex, node.endIndex);

    // Skip empty stubs (< 10 chars)
    if (code.trim().length < 10) continue;

    const functionName = extractName(node, sourceCode);
    const startLine = node.startPosition.row + 1; // tree-sitter is 0-based
    const endLine = node.endPosition.row + 1;

    chunks.push({
      id: `${relativePath}::${functionName}::${startLine}`,
      code,
      filePath: relativePath,
      functionName,
      nodeType: node.type,
      startLine,
      endLine,
    });
  }

  return chunks;
}
