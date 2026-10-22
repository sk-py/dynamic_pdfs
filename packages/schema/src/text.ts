import { SAFE_KEY_REGEX } from './keys';
import type { JSONNode } from './types';

/** Turns plain text with {{key}} into a Tiptap doc (used for simple header/footer inputs). */
export function textToDoc(text: string): JSONNode {
  const lines = text.split('\n');
  return {
    type: 'doc',
    content: lines.map((line) => {
      const content: JSONNode[] = [];
      for (const part of line.split(/(\{\{[^{}]*\}\})/)) {
        if (!part) continue;
        const m = /^\{\{\s*([^{}]*?)\s*\}\}$/.exec(part);
        if (m && SAFE_KEY_REGEX.test(m[1])) content.push({ type: 'variableChip', attrs: { key: m[1] } });
        else content.push({ type: 'text', text: part });
      }
      return { type: 'paragraph', content };
    }),
  };
}
