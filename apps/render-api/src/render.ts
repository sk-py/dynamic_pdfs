import type { TemplateDef } from '@pdf-templates/schema';
import { renderDocToHtml } from './astCompiler';
import { convertHtmlToPdf, type GotenbergOptions } from './gotenberg';
import { buildBodyDocument, buildHeaderFooterDocument, resolvePage } from './htmlDocument';

export async function renderTemplateToPdf(
  template: TemplateDef,
  data: Record<string, any>,
  opts?: GotenbergOptions,
): Promise<Uint8Array> {
  const body = buildBodyDocument(renderDocToHtml(template.body, data));
  const header = template.header ? buildHeaderFooterDocument(renderDocToHtml(template.header, data)) : undefined;
  const footer = template.footer ? buildHeaderFooterDocument(renderDocToHtml(template.footer, data)) : undefined;
  return convertHtmlToPdf({ body, header, footer, page: resolvePage(template.page) }, opts);
}
