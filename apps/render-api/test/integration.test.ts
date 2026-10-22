import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { getSchema } from '@tiptap/core';
import { Node as PMNode } from '@tiptap/pm/model';
import { createExtensions, type TemplateDef } from '@pdf-templates/schema';
import { describe, expect, it } from 'vitest';
import { expandDoc, renderDocToHtml } from '../src/astCompiler';
import { renderTemplateToPdf } from '../src/render';

const read = (f: string) => JSON.parse(readFileSync(new URL(`../templates/${f}`, import.meta.url), 'utf8'));
const template: TemplateDef = read('invoice.template.json');
const sample = read('invoice.sample.json');

// The editor uses resizable tables; the server does not. Both must accept the same JSON.
const editorSchema = getSchema(createExtensions({ resizableTables: true }));

describe('example template', () => {
  it('is valid for the EDITOR schema (so the editor can load it)', () => {
    for (const part of [template.body, template.header!, template.footer!]) {
      expect(() => PMNode.fromJSON(editorSchema, part).check()).not.toThrow();
    }
  });
  it('expands to JSON that is schema-valid (not just renderable)', () => {
    const expanded = expandDoc(template.body, sample);
    expect(() => PMNode.fromJSON(editorSchema, expanded).check()).not.toThrow();
  });
  it('expands 3 items to 3 body rows + 2 matrix rows, and fills variables', () => {
    const html = renderDocToHtml(template.body, sample);
    expect(html).toContain('<h1>Invoice INV-001</h1>');
    expect(html).toContain('<strong>Mubashir</strong>');
    for (const n of ['Widget', 'Gadget', 'Cable', 'West', 'East']) expect(html).toContain(n);
    expect(html).not.toContain('{{');
  });
});

describe('multipart over real HTTP', () => {
  it('sends index/header/footer files and fields that Gotenberg expects', async () => {
    let raw = '';
    let url = '';
    const server = createServer((req, res) => {
      url = req.url ?? '';
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => { raw = Buffer.concat(chunks).toString('utf8'); res.end('%PDF-fake'); });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as AddressInfo).port;
    try {
      const pdf = await renderTemplateToPdf(template, sample, { baseUrl: `http://127.0.0.1:${port}` });
      expect(Buffer.from(pdf).toString()).toBe('%PDF-fake');
    } finally { server.close(); }

    expect(url).toBe('/forms/chromium/convert/html');
    for (const f of ['index.html', 'header.html', 'footer.html']) expect(raw).toContain(`name="files"; filename="${f}"`);
    for (const k of ['paperWidth', 'marginTop', 'landscape', 'printBackground']) expect(raw).toContain(`name="${k}"`);
    expect(raw).toContain('<span class="pageNumber"></span>'); // footer tokens applied
    expect(raw).toContain('<thead>'); // header row hoisted for page-repeat
    expect(raw).toContain('Acme Pvt Ltd - Invoice INV-001'); // header variables filled
  });
});
