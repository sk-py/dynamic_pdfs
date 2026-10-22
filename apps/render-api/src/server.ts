import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import Fastify from 'fastify';
import { z } from 'zod';
import type { TemplateDef } from '@pdf-templates/schema';
import { TemplateError } from './errors';
import { GotenbergError } from './gotenberg';
import { renderTemplateToPdf } from './render';

const TEMPLATES_DIR = new URL('../templates/', import.meta.url);

const nodeSchema = z.record(z.string(), z.unknown());
const templateSchema = z.object({
  body: nodeSchema,
  header: nodeSchema.optional(),
  footer: nodeSchema.optional(),
  page: z
    .object({
      size: z.enum(['A4', 'Letter']).optional(),
      orientation: z.enum(['portrait', 'landscape']).optional(),
      marginsMm: z
        .object({
          top: z.number().min(0).max(100),
          right: z.number().min(0).max(100),
          bottom: z.number().min(0).max(100),
          left: z.number().min(0).max(100),
        })
        .optional(),
    })
    .optional(),
});

const requestSchema = z
  .object({
    templateId: z.string().regex(/^[a-z0-9_-]{1,64}$/).optional(),
    template: templateSchema.optional(),
    data: z.record(z.string(), z.unknown()).default({}),
  })
  .refine((b) => b.templateId || b.template, { message: 'Provide templateId or template' });

type Renderer = (t: TemplateDef, data: Record<string, any>) => Promise<Uint8Array>;

export function buildServer(deps: { render?: Renderer; loadTemplate?: (id: string) => Promise<TemplateDef> } = {}) {
  const render = deps.render ?? ((t, d) => renderTemplateToPdf(t, d));
  const loadTemplate =
    deps.loadTemplate ??
    (async (id: string) => JSON.parse(await readFile(new URL(`${id}.template.json`, TEMPLATES_DIR), 'utf8')) as TemplateDef);

  const app = Fastify({ logger: process.env.NODE_ENV !== 'test', bodyLimit: 5 * 1024 * 1024 });

  app.addHook('onRequest', async (req, reply) => {
    const key = process.env.API_KEY;
    if (key && req.url !== '/health' && req.headers['x-api-key'] !== key) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  app.get('/health', async () => ({ ok: true }));

  // Used by your app (templateId + data) and by the editor's Preview button (inline template + data).
  app.post('/render', async (req, reply) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid request', details: parsed.error.issues });
    const { templateId, template, data } = parsed.data;

    try {
      const def = template ? (template as unknown as TemplateDef) : await loadTemplate(templateId!);
      const pdf = await render(def, data);
      return reply.header('content-type', 'application/pdf').send(Buffer.from(pdf));
    } catch (e) {
      if (e instanceof TemplateError) return reply.code(400).send({ error: e.message });
      if (e instanceof GotenbergError) {
        req.log.error(e);
        return reply.code(502).send({ error: 'PDF renderer unavailable or rejected the document', detail: e.message });
      }
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return reply.code(404).send({ error: 'Template not found' });
      throw e;
    }
  });

  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4000);
  buildServer().listen({ port, host: process.env.HOST ?? '127.0.0.1' }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
