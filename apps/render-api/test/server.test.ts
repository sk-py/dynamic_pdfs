import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from '../src/server';
import { TemplateError } from '../src/errors';
import { GotenbergError } from '../src/gotenberg';

process.env.NODE_ENV = 'test';
const body = { type: 'doc', content: [{ type: 'paragraph' }] };
const okRender = async () => new Uint8Array([37, 80, 68, 70]);

afterEach(() => { delete process.env.API_KEY; });

describe('POST /render', () => {
  it('returns a PDF for an inline template', async () => {
    const app = buildServer({ render: okRender });
    const res = await app.inject({ method: 'POST', url: '/render', payload: { template: { body }, data: {} } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
  });
  it('loads a stored template by id', async () => {
    const app = buildServer({ render: okRender, loadTemplate: async () => ({ body } as any) });
    const res = await app.inject({ method: 'POST', url: '/render', payload: { templateId: 'invoice', data: {} } });
    expect(res.statusCode).toBe(200);
  });
  it('rejects path-like template ids', async () => {
    const app = buildServer({ render: okRender });
    const res = await app.inject({ method: 'POST', url: '/render', payload: { templateId: '../../etc/passwd' } });
    expect(res.statusCode).toBe(400);
  });
  it('400 when neither templateId nor template is given', async () => {
    const res = await buildServer({ render: okRender }).inject({ method: 'POST', url: '/render', payload: {} });
    expect(res.statusCode).toBe(400);
  });
  it('maps TemplateError to 400 and GotenbergError to 502', async () => {
    const bad = buildServer({ render: async () => { throw new TemplateError('bad key'); } });
    expect((await bad.inject({ method: 'POST', url: '/render', payload: { template: { body } } })).statusCode).toBe(400);
    const down = buildServer({ render: async () => { throw new GotenbergError('down'); } });
    expect((await down.inject({ method: 'POST', url: '/render', payload: { template: { body } } })).statusCode).toBe(502);
  });
  it('404 for an unknown stored template', async () => {
    const app = buildServer({ render: okRender });
    const res = await app.inject({ method: 'POST', url: '/render', payload: { templateId: 'does-not-exist' } });
    expect(res.statusCode).toBe(404);
  });
  it('enforces x-api-key when API_KEY is set (health stays open)', async () => {
    process.env.API_KEY = 's3cret';
    const app = buildServer({ render: okRender });
    expect((await app.inject({ method: 'POST', url: '/render', payload: { template: { body } } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    const ok = await app.inject({ method: 'POST', url: '/render', headers: { 'x-api-key': 's3cret' }, payload: { template: { body } } });
    expect(ok.statusCode).toBe(200);
  });
});
