import type { ResolvedPage } from './htmlDocument';

export type ConvertInput = { body: string; header?: string; footer?: string; page: ResolvedPage };
export type GotenbergOptions = { baseUrl?: string; timeoutMs?: number; fetchImpl?: typeof fetch };

export class GotenbergError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'GotenbergError';
  }
}

export async function convertHtmlToPdf(input: ConvertInput, opts: GotenbergOptions = {}): Promise<Uint8Array> {
  const baseUrl = (opts.baseUrl ?? process.env.GOTENBERG_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const doFetch = opts.fetchImpl ?? fetch;

  const form = new FormData();
  const file = (html: string, name: string) => form.append('files', new Blob([html], { type: 'text/html' }), name);
  file(input.body, 'index.html');
  if (input.header) file(input.header, 'header.html');
  if (input.footer) file(input.footer, 'footer.html');

  const p = input.page;
  form.append('paperWidth', String(p.paperWidth));
  form.append('paperHeight', String(p.paperHeight));
  form.append('marginTop', String(p.marginTop));
  form.append('marginRight', String(p.marginRight));
  form.append('marginBottom', String(p.marginBottom));
  form.append('marginLeft', String(p.marginLeft));
  form.append('landscape', String(p.landscape));
  form.append('printBackground', 'true');
  form.append('preferCssPageSize', 'false');

  let res: Response;
  try {
    res = await doFetch(`${baseUrl}/forms/chromium/convert/html`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    });
  } catch (e) {
    throw new GotenbergError(`Cannot reach Gotenberg at ${baseUrl}: ${(e as Error).message}`);
  }
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).slice(0, 300);
    throw new GotenbergError(`Gotenberg returned ${res.status}: ${text}`, res.status);
  }
  return new Uint8Array(await res.arrayBuffer());
}
