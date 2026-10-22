import { Node, mergeAttributes } from '@tiptap/core';

type AnyNode = Node<any, any>;

/** Inline placeholder: {{key}}. Replaced with text on the server. */
export const VariableChip = Node.create({
  name: 'variableChip',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      key: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-variable') ?? '',
        renderHTML: (attrs) => ({ 'data-variable': attrs.key }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-variable]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'variable-chip' }), `{{${node.attrs.key}}}`];
  },
});

/** Block placeholder for a table whose columns AND rows both come from the API. Expanded on the server. */
export const DynamicMatrixTable = Node.create({
  name: 'dynamicMatrixTable',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      dataKey: {
        default: 'matrix',
        parseHTML: (el) => el.getAttribute('data-matrix-table') ?? 'matrix',
        renderHTML: (a) => ({ 'data-matrix-table': a.dataKey }),
      },
      headerBg: {
        default: '#f1f5f9',
        parseHTML: (el) => el.getAttribute('data-header-bg') ?? '#f1f5f9',
        renderHTML: (a) => ({ 'data-header-bg': a.headerBg }),
      },
      fontSize: {
        default: '12px',
        parseHTML: (el) => el.getAttribute('data-font-size') ?? '12px',
        renderHTML: (a) => ({ 'data-font-size': a.fontSize }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-matrix-table]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'matrix-block' }), `Dynamic table: ${node.attrs.dataKey}`];
  },
});

/** Adds `repeatKey` to a table row: the row is cloned once per item of data[repeatKey]. */
export function withRepeatKey<T extends AnyNode>(base: T): T {
  return base.extend({
    addAttributes() {
      return {
        ...(this as any).parent?.(),
        repeatKey: {
          default: null,
          parseHTML: (el: HTMLElement) => el.getAttribute('data-repeat-key'),
          renderHTML: (attrs: Record<string, any>) => (attrs.repeatKey ? { 'data-repeat-key': attrs.repeatKey } : {}),
        },
      };
    },
  }) as T;
}

/** Adds an inline `style` attribute to cells/headers. Values are only ever written by the server's matrix builder. */
export function withCellStyle<T extends AnyNode>(base: T): T {
  return base.extend({
    addAttributes() {
      return {
        ...(this as any).parent?.(),
        style: {
          default: null,
          parseHTML: (el: HTMLElement) => el.getAttribute('style'),
          renderHTML: (attrs: Record<string, any>) => (attrs.style ? { style: attrs.style } : {}),
        },
      };
    },
  }) as T;
}
