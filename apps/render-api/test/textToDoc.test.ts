import { describe, expect, it } from 'vitest';
import { textToDoc } from '@pdf-templates/schema';
import { renderDocToHtml } from '../src/astCompiler';

describe('textToDoc', () => {
  it('turns {{key}} into chips and keeps other text', () => {
    const d = textToDoc('Hello {{customer.name}}!');
    expect(d.content![0].content).toEqual([
      { type: 'text', text: 'Hello ' },
      { type: 'variableChip', attrs: { key: 'customer.name' } },
      { type: 'text', text: '!' },
    ]);
  });
  it('leaves unsafe placeholders as literal text', () => {
    expect(textToDoc('{{a b}}').content![0].content).toEqual([{ type: 'text', text: '{{a b}}' }]);
  });
  it('round-trips to HTML with data', () => {
    expect(renderDocToHtml(textToDoc('{{company}}\nPage {page}'), { company: 'Acme' })).toBe('<p>Acme</p><p>Page {page}</p>');
  });
});
