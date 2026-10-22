import { generateHTML } from '@tiptap/html/server';
import {
  SAFE_FONT_SIZE_REGEX,
  SAFE_HEX_COLOR_REGEX,
  SAFE_KEY_REGEX,
  createExtensions,
  type JSONNode,
} from '@pdf-templates/schema';
import { TemplateError } from './errors';

/**
 * Walks the stored Tiptap JSON, substitutes data, and calls generateHTML ONCE.
 * No string templating, so text typed by template authors (e.g. "{{{x}}}") can never execute as code.
 */

const MAX_DEPTH = 40;
const MAX_ROWS = 5000;
const MAX_COLUMNS = 50;

const extensions = createExtensions();

const isPlainObject = (v: unknown): v is Record<string, any> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export function resolveValue(key: string, rowScope: unknown, root: Record<string, any>): string {
  if (!SAFE_KEY_REGEX.test(key)) throw new TemplateError(`Invalid variable key: "${key}"`);

  // Repeating over ["a","b"]: use {{this}} or {{item}} for the primitive.
  if (rowScope !== null && rowScope !== undefined && typeof rowScope !== 'object') {
    if (key === 'this' || key === 'item') return String(rowScope);
  }

  const parts = key.split('.');
  let current: unknown = root;
  let start = 0;

  if (isPlainObject(rowScope)) {
    if (parts[0] === 'item' && parts.length > 1) {
      current = rowScope; // explicit: item.price
      start = 1;
    } else if (has(rowScope, parts[0])) {
      current = rowScope; // item field shadows root field of the same name
    }
  }

  for (let i = start; i < parts.length; i++) {
    if (!isPlainObject(current) || !has(current, parts[i])) return '';
    current = current[parts[i]];
  }
  return current == null ? '' : String(current);
}

const textNode = (text: string): JSONNode[] => (text.length > 0 ? [{ type: 'text', text }] : []); // ProseMirror forbids empty text nodes

function buildMatrixTable(node: JSONNode, root: Record<string, any>): JSONNode | null {
  const dataKey = String(node.attrs?.dataKey ?? '');
  if (!SAFE_KEY_REGEX.test(dataKey)) throw new TemplateError(`Invalid matrix dataKey: "${dataKey}"`);

  const headerBg = SAFE_HEX_COLOR_REGEX.test(node.attrs?.headerBg) ? node.attrs!.headerBg : '#f1f5f9';
  const fontSize = SAFE_FONT_SIZE_REGEX.test(node.attrs?.fontSize) ? node.attrs!.fontSize : '12px';

  const matrix = root[dataKey];
  const columns: Array<{ key: string; label: string }> =
    isPlainObject(matrix) && Array.isArray(matrix.columns) ? matrix.columns : [];
  const rows: unknown[] = isPlainObject(matrix) && Array.isArray(matrix.rows) ? matrix.rows : [];

  if (columns.length === 0) return null; // never emit an empty table
  if (columns.length > MAX_COLUMNS) throw new TemplateError(`Matrix "${dataKey}" has more than ${MAX_COLUMNS} columns`);
  if (rows.length > MAX_ROWS) throw new TemplateError(`Matrix "${dataKey}" has more than ${MAX_ROWS} rows`);

  const headerRow: JSONNode = {
    type: 'tableRow',
    content: columns.map((col) => ({
      type: 'tableHeader',
      attrs: { style: `background-color: ${headerBg}; font-size: ${fontSize};` },
      content: [{ type: 'paragraph', content: textNode(col?.label == null ? '' : String(col.label)) }],
    })),
  };

  const bodyRows: JSONNode[] = rows.map((row) => ({
    type: 'tableRow',
    content: columns.map((col) => {
      const raw = isPlainObject(row) && col && has(row, String(col.key)) ? row[String(col.key)] : null;
      return {
        type: 'tableCell',
        attrs: { style: `font-size: ${fontSize};` },
        content: [{ type: 'paragraph', content: textNode(raw == null ? '' : String(raw)) }],
      };
    }),
  }));

  return { type: 'table', content: [headerRow, ...bodyRows] };
}

function walk(nodes: JSONNode[], root: Record<string, any>, scope: unknown, depth: number): JSONNode[] {
  if (depth > MAX_DEPTH) throw new TemplateError('Template is nested too deeply');
  const out: JSONNode[] = [];

  for (const node of nodes) {
    if (node.type === 'variableChip') {
      const value = resolveValue(String(node.attrs?.key ?? ''), scope, root);
      if (value.length > 0) {
        out.push({ type: 'text', text: value, ...(node.marks ? { marks: structuredClone(node.marks) } : {}) });
      }
      continue;
    }

    if (node.type === 'tableRow' && node.attrs?.repeatKey) {
      const repeatKey = String(node.attrs.repeatKey);
      if (!SAFE_KEY_REGEX.test(repeatKey)) throw new TemplateError(`Invalid repeatKey: "${repeatKey}"`);
      const items = Array.isArray(root[repeatKey]) ? (root[repeatKey] as unknown[]) : [];
      if (items.length > MAX_ROWS) throw new TemplateError(`"${repeatKey}" has more than ${MAX_ROWS} items`);
      for (const item of items) {
        const row = structuredClone(node);
        delete row.attrs?.repeatKey;
        row.content = row.content ? walk(row.content, root, item, depth + 1) : [];
        out.push(row);
      }
      continue;
    }

    if (node.type === 'dynamicMatrixTable') {
      const table = buildMatrixTable(node, root);
      if (table) out.push(table);
      continue;
    }

    const copy: JSONNode = { ...node };
    if (node.content) copy.content = walk(node.content, root, scope, depth + 1);
    if (copy.type === 'table' && (!copy.content || copy.content.length === 0)) continue; // zero-row table crashes generateHTML
    out.push(copy);
  }
  return out;
}

/** Substitutes data and expands repeat rows / matrix tables. Returns plain Tiptap JSON (no custom nodes left). */
export function expandDoc(doc: JSONNode, data: Record<string, any>): JSONNode {
  if (!doc || doc.type !== 'doc') throw new TemplateError('Template body must be a Tiptap "doc" node');
  const content = doc.content ? walk(doc.content, data, null, 0) : [];
  return { type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph' }] };
}

export function renderDocToHtml(doc: JSONNode, data: Record<string, any>): string {
  return generateHTML(expandDoc(doc, data) as any, extensions);
}
