import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { SAFE_KEY_REGEX, createExtensions, textToDoc, type TemplateDef } from '@pdf-templates/schema';
// Reuse the API's example so the spike starts with something real.
import exampleTemplate from '../../render-api/templates/invoice.template.json';
import exampleData from '../../render-api/templates/invoice.sample.json';

const example = exampleTemplate as unknown as TemplateDef;

export function App() {
  const [dataText, setDataText] = useState(JSON.stringify(exampleData, null, 2));
  const [headerText, setHeaderText] = useState('{{company}} - Invoice {{invoice_no}}');
  const [footerText, setFooterText] = useState('Page {page} of {total}');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'error'; msg?: string }>({ kind: 'idle' });
  const lastUrl = useRef<string | null>(null);

  const editor = useEditor({
    extensions: useMemo(() => createExtensions({ resizableTables: true }), []),
    content: example.body,
  });

  useEffect(() => () => { if (lastUrl.current) URL.revokeObjectURL(lastUrl.current); }, []);
  if (!editor) return null;

  const ask = (label: string) => {
    const key = window.prompt(label)?.trim();
    if (!key) return null;
    if (!SAFE_KEY_REGEX.test(key)) { window.alert('Use letters, numbers, underscores and dots only, e.g. customer.name'); return null; }
    return key;
  };
  const chain = () => editor.chain().focus();

  const insertVariable = () => { const key = ask('Variable key (e.g. customer.name)'); if (key) chain().insertContent({ type: 'variableChip', attrs: { key } }).run(); };
  const insertMatrix = () => { const key = ask('Data key holding { columns, rows } (e.g. matrix)'); if (key) chain().insertContent({ type: 'dynamicMatrixTable', attrs: { dataKey: key } }).run(); };
  const setRepeat = () => {
    const current = editor.getAttributes('tableRow').repeatKey as string | null;
    if (current) { chain().updateAttributes('tableRow', { repeatKey: null }).run(); return; }
    const key = ask('Repeat this row for each item in data key (e.g. items)');
    if (key) chain().updateAttributes('tableRow', { repeatKey: key }).run();
  };
  const insertImage = () => {
    const src = window.prompt('Image URL (must be on the Gotenberg allow-list)')?.trim();
    if (src) chain().setImage({ src }).run();
  };

  async function preview() {
    let data: unknown;
    try { data = JSON.parse(dataText); } catch { setStatus({ kind: 'error', msg: 'Sample data is not valid JSON' }); return; }
    const template: TemplateDef = {
      body: editor!.getJSON() as TemplateDef['body'],
      header: headerText.trim() ? textToDoc(headerText) : undefined,
      footer: footerText.trim() ? textToDoc(footerText) : undefined,
      page: { size: 'A4', orientation },
    };
    setStatus({ kind: 'busy' });
    try {
      const res = await fetch('/api/render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ template, data }) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`${res.status}: ${err.error ?? res.statusText}${err.detail ? ` (${err.detail})` : ''}`);
      }
      const url = URL.createObjectURL(await res.blob());
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
      lastUrl.current = url;
      setPdfUrl(url);
      setStatus({ kind: 'idle' });
    } catch (e) {
      setStatus({ kind: 'error', msg: (e as Error).message });
    }
  }

  const B = ({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title?: string }) => (
    <button type="button" title={title} className={active ? 'active' : ''} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{children}</button>
  );

  return (
    <div className="layout">
      <section className="left">
        <div className="toolbar">
          <B onClick={() => chain().toggleBold().run()} active={editor.isActive('bold')}>B</B>
          <B onClick={() => chain().toggleItalic().run()} active={editor.isActive('italic')}>I</B>
          <B onClick={() => chain().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}>H1</B>
          <B onClick={() => chain().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>H2</B>
          <B onClick={() => chain().toggleBulletList().run()} active={editor.isActive('bulletList')}>• List</B>
          <span className="sep" />
          <B onClick={() => chain().insertTable({ rows: 2, cols: 3, withHeaderRow: true }).run()}>Table</B>
          <B onClick={() => chain().addRowAfter().run()}>+Row</B>
          <B onClick={() => chain().addColumnAfter().run()}>+Col</B>
          <B onClick={() => chain().deleteRow().run()}>-Row</B>
          <B onClick={() => chain().deleteColumn().run()}>-Col</B>
          <B onClick={() => chain().deleteTable().run()}>Del table</B>
          <B onClick={setRepeat} active={!!editor.getAttributes('tableRow').repeatKey} title="Cursor in a row: repeat it per API item">Repeat row</B>
          <span className="sep" />
          <B onClick={insertVariable}>{'{{ }} Variable'}</B>
          <B onClick={insertMatrix}>Dynamic table</B>
          <B onClick={insertImage}>Image</B>
        </div>
        <EditorContent editor={editor} className="page" />
        <label>Header (supports {'{{key}}'})<input value={headerText} onChange={(e) => setHeaderText(e.target.value)} /></label>
        <label>Footer (supports {'{{key}}'}, {'{page}'}, {'{total}'})<input value={footerText} onChange={(e) => setFooterText(e.target.value)} /></label>
        <label>Orientation
          <select value={orientation} onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}>
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>
        <label>Sample data (JSON)<textarea rows={10} value={dataText} onChange={(e) => setDataText(e.target.value)} spellCheck={false} /></label>
        <button type="button" className="primary" onClick={preview} disabled={status.kind === 'busy'}>
          {status.kind === 'busy' ? 'Rendering…' : 'Preview PDF (server-rendered)'}
        </button>
        {status.kind === 'error' && <p className="error">{status.msg}</p>}
      </section>
      <section className="right">
        {pdfUrl ? <iframe title="PDF preview" src={pdfUrl} /> : <p className="hint">The preview is the real PDF from Gotenberg, not an approximation. The editor view is only a rough guide.</p>}
      </section>
    </div>
  );
}
