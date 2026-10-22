import { describe, expect, it, vi } from 'vitest';
import { convertHtmlToPdf, GotenbergError } from '../src/gotenberg';
import { resolvePage } from '../src/htmlDocument';

const page = resolvePage({ orientation: 'landscape' });

describe('convertHtmlToPdf', () => {
  it('posts index/header/footer files and page fields to the Chromium HTML route', async () => {
    const fetchImpl = vi.fn(async (_url: any, init: any) => {
      const f = init.body as FormData;
      const names = f.getAll('files').map((x) => (x as File).name);
      expect(names).toEqual(['index.html', 'header.html', 'footer.html']);
      expect(f.get('landscape')).toBe('true');
      expect(f.get('paperWidth')).toBe('8.27');
      expect(f.get('printBackground')).toBe('true');
      return new Response(new Uint8Array([37, 80, 68, 70]), { status: 200 });
    });
    const pdf = await convertHtmlToPdf({ body: '<p/>', header: '<p/>', footer: '<p/>', page }, { baseUrl: 'http://g:3000/', fetchImpl: fetchImpl as any });
    expect(Array.from(pdf)).toEqual([37, 80, 68, 70]);
    expect(fetchImpl.mock.calls[0][0]).toBe('http://g:3000/forms/chromium/convert/html');
  });
  it('omits header/footer files when not provided', async () => {
    const fetchImpl = vi.fn(async (_u: any, init: any) => {
      expect((init.body as FormData).getAll('files')).toHaveLength(1);
      return new Response(new Uint8Array([1]));
    });
    await convertHtmlToPdf({ body: '<p/>', page }, { fetchImpl: fetchImpl as any });
  });
  it('maps non-2xx to GotenbergError with status', async () => {
    const fetchImpl = async () => new Response('forbidden', { status: 403 });
    await expect(convertHtmlToPdf({ body: '<p/>', page }, { fetchImpl: fetchImpl as any })).rejects.toMatchObject({ name: 'GotenbergError', status: 403 });
  });
  it('maps network failure to GotenbergError', async () => {
    const fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
    await expect(convertHtmlToPdf({ body: '<p/>', page }, { fetchImpl: fetchImpl as any })).rejects.toBeInstanceOf(GotenbergError);
  });
});
