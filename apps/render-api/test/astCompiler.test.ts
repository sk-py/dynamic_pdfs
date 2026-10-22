import { describe, expect, it } from 'vitest';
import { renderDocToHtml, resolveValue } from '../src/astCompiler';
import { TemplateError } from '../src/errors';

const T = (text: string, marks?: any[]) => ({ type: 'text', text, ...(marks ? { marks } : {}) });
const chip = (key: string, marks?: any[]) => ({ type: 'variableChip', attrs: { key }, ...(marks ? { marks } : {}) });
const P = (...content: any[]) => ({ type: 'paragraph', content });
const cell = (...content: any[]) => ({ type: 'tableCell', content });
const doc = (...content: any[]) => ({ type: 'doc', content }) as any;
const repeatTable = (key: string, ...cells: any[]) =>
  ({ type: 'table', content: [{ type: 'tableRow', attrs: { repeatKey: key }, content: cells }] });

describe('variables', () => {
  it('substitutes values and keeps marks', () => {
    const html = renderDocToHtml(doc(P(chip('name', [{ type: 'bold' }]))), { name: 'Acme' });
    expect(html).toBe('<p><strong>Acme</strong></p>');
  });
  it('resolves dotted keys', () => {
    expect(renderDocToHtml(doc(P(chip('customer.name'))), { customer: { name: 'M' } })).toBe('<p>M</p>');
  });
  it('empty, null and missing values do not crash', () => {
    for (const data of [{ n: '' }, { n: null }, {}]) {
      expect(renderDocToHtml(doc(P(chip('n'), T(' x'))), data)).toBe('<p> x</p>');
    }
  });
  it('does not leak prototype properties', () => {
    expect(renderDocToHtml(doc(P(chip('constructor'))), {})).toBe('<p></p>');
    expect(resolveValue('toString', null, {})).toBe('');
  });
  it('rejects unsafe keys', () => {
    expect(() => renderDocToHtml(doc(P(chip('a}}{{{b'))), {})).toThrow(TemplateError);
  });
  it('treats "{{" typed in normal text as literal text (no template injection)', () => {
    const html = renderDocToHtml(doc(P(T('{{{secret}}} {{#each items}}'))), { secret: 'TOPSECRET' });
    expect(html).not.toContain('TOPSECRET');
    expect(html).toContain('{{{secret}}}');
  });
  it('escapes HTML inside values', () => {
    const html = renderDocToHtml(doc(P(chip('n'))), { n: '<img src=x onerror=alert(1)>' });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});

describe('repeat rows', () => {
  it('clones one row per item', () => {
    const html = renderDocToHtml(doc(repeatTable('items', cell(P(chip('n'))))), { items: [{ n: 'x' }, { n: 'y' }] });
    expect(html).toContain('<td><p>x</p></td>');
    expect(html).toContain('<td><p>y</p></td>');
    expect(html).not.toContain('data-repeat-key');
  });
  it('drops a table that would have zero rows', () => {
    expect(renderDocToHtml(doc(repeatTable('items', cell(P(chip('n'))))), { items: [] })).toBe('<p></p>');
  });
  it('supports primitive arrays via {{this}}', () => {
    const html = renderDocToHtml(doc(repeatTable('items', cell(P(chip('this'))))), { items: ['a', 'b'] });
    expect(html).toContain('<p>a</p>');
    expect(html).toContain('<p>b</p>');
  });
  it('handles a nested table inside a repeated row', () => {
    const inner = { type: 'table', content: [{ type: 'tableRow', content: [cell(P(chip('n')))] }] };
    const html = renderDocToHtml(doc(repeatTable('items', cell(inner))), { items: [{ n: 'x' }, { n: 'y' }] });
    expect(html.match(/<table/g)).toHaveLength(3); // outer + 2 clones of inner
    expect(html).toContain('<p>x</p>');
    expect(html).toContain('<p>y</p>');
  });
  it('item fields shadow root fields; root fields still reachable', () => {
    const html = renderDocToHtml(doc(repeatTable('items', cell(P(chip('n'), T('|'), chip('currency'))))), {
      n: 'ROOT', currency: 'INR', items: [{ n: 'item' }],
    });
    expect(html).toContain('<p>item|INR</p>');
  });
  it('enforces the row cap', () => {
    const items = Array.from({ length: 5001 }, () => ({ n: 'x' }));
    expect(() => renderDocToHtml(doc(repeatTable('items', cell(P(chip('n'))))), { items })).toThrow(TemplateError);
  });
});

describe('matrix table', () => {
  const matrixDoc = (attrs: any = {}) => doc({ type: 'dynamicMatrixTable', attrs: { dataKey: 'm', ...attrs } });
  const data = { m: { columns: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], rows: [{ a: 1, b: null }] } };

  it('builds header + body from API columns and rows', () => {
    const html = renderDocToHtml(matrixDoc({ headerBg: '#eee', fontSize: '9px' }), data);
    expect(html).toContain('<th style="background-color: #eee; font-size: 9px;"><p>A</p></th>');
    expect(html).toContain('<td style="font-size: 9px;"><p>1</p></td>');
    expect(html).toContain('<td style="font-size: 9px;"><p></p></td>');
  });
  it('falls back to safe style values (blocks CSS injection)', () => {
    const html = renderDocToHtml(matrixDoc({ headerBg: 'red;background:url(http://169.254.169.254)', fontSize: '99px' }), data);
    expect(html).not.toContain('169.254');
    expect(html).toContain('font-size: 12px;');
  });
  it('emits nothing when there are no columns', () => {
    expect(renderDocToHtml(matrixDoc(), {})).toBe('<p></p>');
  });
  it('rejects an unsafe dataKey', () => {
    expect(() => renderDocToHtml(matrixDoc({ dataKey: '__proto__;x' }), data)).toThrow(TemplateError);
  });
});

describe('document guards', () => {
  it('rejects non-doc bodies', () => {
    expect(() => renderDocToHtml({ type: 'paragraph' } as any, {})).toThrow(TemplateError);
  });
  it('rejects absurd nesting', () => {
    let node: any = P(T('x'));
    for (let i = 0; i < 60; i++) node = { type: 'blockquote', content: [node] };
    expect(() => renderDocToHtml(doc(node), {})).toThrow(TemplateError);
  });
});
