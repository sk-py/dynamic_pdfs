// End-to-end check against a REAL Gotenberg. Start it first: `npm run gotenberg` (from the repo root).
// Produces PDFs in apps/render-api/out/ for you to open and inspect.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { TemplateDef } from '@pdf-templates/schema';
import { renderTemplateToPdf } from '../src/render';

const dir = new URL('../templates/', import.meta.url);
const out = new URL('../out/', import.meta.url);
const template: TemplateDef = JSON.parse(await readFile(new URL('invoice.template.json', dir), 'utf8'));
const sample = JSON.parse(await readFile(new URL('invoice.sample.json', dir), 'utf8'));
await mkdir(out, { recursive: true });

async function run(name: string, tpl: TemplateDef, data: Record<string, any>) {
  const t0 = Date.now();
  const pdf = await renderTemplateToPdf(tpl, data);
  await writeFile(new URL(`${name}.pdf`, out), pdf);
  console.log(`${name}.pdf  ${(pdf.length / 1024).toFixed(0)} KB  ${Date.now() - t0} ms`);
}

try {
  // 1) as-is
  await run('invoice-small', template, sample);

  // 2) 300 line items -> expect several pages, repeated table header, "Page X of Y" footer
  const items = Array.from({ length: 300 }, (_, i) => ({ name: `Item ${i + 1}`, qty: (i % 7) + 1, price: (10 + i).toFixed(2) }));
  await run('invoice-300-rows', template, { ...sample, items });

  // 3) 12 dynamic columns, landscape
  const columns = Array.from({ length: 12 }, (_, i) => ({ key: `c${i}`, label: `Column ${i + 1}` }));
  const rows = Array.from({ length: 40 }, (_, r) => Object.fromEntries(columns.map((c, i) => [c.key, `r${r}-${i}`])));
  await run('matrix-12-cols-landscape', { ...template, page: { ...template.page, orientation: 'landscape' } }, { ...sample, matrix: { columns, rows } });

  // 4) 20 concurrent renders
  const t0 = Date.now();
  await Promise.all(Array.from({ length: 20 }, () => renderTemplateToPdf(template, { ...sample, items })));
  console.log(`20 concurrent renders (300 rows each): ${Date.now() - t0} ms total`);
} catch (e) {
  console.error('\nSmoke test failed:', (e as Error).message);
  console.error('Is Gotenberg running? (npm run gotenberg). If you get 403, check --chromium-allow-list in docker-compose.yml.');
  process.exit(1);
}
