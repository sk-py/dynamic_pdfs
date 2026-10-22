import * as cheerio from 'cheerio';
import type { PageSettings } from '@pdf-templates/schema';

const PAGE_SIZES_IN = { A4: { w: 8.27, h: 11.69 }, Letter: { w: 8.5, h: 11 } } as const;
const DEFAULT_MARGINS_MM = { top: 25, right: 15, bottom: 25, left: 15 };

export type ResolvedPage = {
  paperWidth: number;
  paperHeight: number;
  landscape: boolean;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
};

const mmToIn = (mm: number) => Math.round((mm / 25.4) * 1000) / 1000;

/** Gotenberg takes portrait paper size + a landscape flag, margins in inches. */
export function resolvePage(page: PageSettings = {}): ResolvedPage {
  const size = PAGE_SIZES_IN[page.size ?? 'A4'];
  const m = page.marginsMm ?? DEFAULT_MARGINS_MM;
  return {
    paperWidth: size.w,
    paperHeight: size.h,
    landscape: page.orientation === 'landscape',
    marginTop: mmToIn(m.top),
    marginRight: mmToIn(m.right),
    marginBottom: mmToIn(m.bottom),
    marginLeft: mmToIn(m.left),
  };
}

/**
 * Tiptap renders header rows as <tr><th> inside <tbody>. Chromium only repeats a table header on each page
 * when it lives in <thead>, so move a leading all-<th> row there.
 */
export function hoistTableHeaders(html: string): string {
  const $ = cheerio.load(html, null, false);
  $('table').each((_, table) => {
    const firstRow = $(table).find('> tbody > tr').first();
    const cells = firstRow.children();
    if (cells.length > 0 && cells.toArray().every((c) => (c as any).tagName === 'th')) {
      const thead = $('<thead></thead>');
      thead.append(firstRow);
      $(table).prepend(thead);
    }
  });
  return $.html();
}

// Header/footer docs must be complete HTML documents; Chromium fills .pageNumber / .totalPages itself.
export function applyPageTokens(html: string): string {
  return html
    .replaceAll('{page}', '<span class="pageNumber"></span>')
    .replaceAll('{total}', '<span class="totalPages"></span>');
}

const FONT_STACK = `"Noto Sans","DejaVu Sans","Liberation Sans",Arial,sans-serif`;

export function buildBodyDocument(innerHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0}
  body{font-family:${FONT_STACK};font-size:12px;line-height:1.45;color:#111}
  p{margin:0 0 .6em}
  table{border-collapse:collapse;width:100%;margin:0 0 1em}
  th,td{border:1px solid #9ca3af;padding:4px 6px;text-align:left;vertical-align:top}
  th{background:#f1f5f9}
  thead{display:table-header-group}
  tr{break-inside:avoid}
  img{max-width:100%}
</style></head><body>${hoistTableHeaders(innerHtml)}</body></html>`;
}

export function buildHeaderFooterDocument(innerHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0}
  body{font-family:${FONT_STACK};font-size:9px;color:#444;width:100%;padding:0 15mm;box-sizing:border-box}
  p{margin:0}
</style></head><body>${applyPageTokens(innerHtml)}</body></html>`;
}
