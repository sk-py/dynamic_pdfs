# PDF template builder (spike)

Word-like template editor (Tiptap) -> JSON stored in your DB -> server fills it with API data
-> Gotenberg (headless Chromium) -> PDF. Everything is open source (MIT / Apache-2.0 / MIT-licensed Gotenberg).

```
packages/schema        shared Tiptap nodes + whitelists (ONE schema for editor and server)
apps/render-api        Fastify: POST /render, JSON walker, Gotenberg client, tests
apps/editor            Vite + React + Tiptap, with a server-rendered "Preview PDF" button
docker-compose.yml     Gotenberg with SSRF / JS hardening flags
```

## Run it
Node >= 20 and Docker.

```bash
npm install
npm run gotenberg      # starts Gotenberg on 127.0.0.1:3000
npm run dev:api        # render API on :4000
npm run dev:editor     # editor on :5173  (proxies /api -> :4000)
npm test               # 43 tests, no Docker needed
npm run smoke          # needs Gotenberg: writes PDFs to apps/render-api/out/
```

Open http://localhost:5173, press **Preview PDF**.

## Using it from your existing app
```
POST /render   { "templateId": "invoice", "data": { ... } }      -> application/pdf
POST /render   { "template": { body, header?, footer?, page? }, "data": { ... } }   (what the editor preview uses)
```
Set `API_KEY` to require an `x-api-key` header. Today stored templates are files in `apps/render-api/templates/<id>.template.json`;
replace `loadTemplate` in `server.ts` with a DB lookup. Keep Gotenberg on a private network, never public.

## How templates work
- `{{key}}` chips (dotted keys like `customer.name`) are replaced by text. Values are escaped by Tiptap's serializer.
- **Repeat row**: put the cursor in a table row, click *Repeat row*, give it a data key (e.g. `items`). Inside it, `{{name}}`
  reads from each item (`{{this}}` for arrays of strings, `{{item.x}}` to be explicit). Root fields stay reachable unless an item field has the same name.
- **Dynamic table** block: columns AND rows from `data[key] = { columns: [{key,label}], rows: [{...}] }`.
- Header/footer: `{{key}}`, `{page}`, `{total}`.
- The server never templates strings. It walks the JSON, so text like `{{{x}}}` typed into a document stays literal text.

## What is verified vs NOT verified
Verified (automated): JSON walker edge cases (empty/null values, empty arrays, primitive arrays, nested tables, injection,
CSS/key whitelists, caps), schema-validity of expanded output, header-row hoisting to `<thead>`, the exact multipart request over real HTTP,
API status codes, type-check of both apps, production build of the editor.

**NOT verified (needs your machine):**
1. A real Gotenberg render. Run `npm run smoke` first and look at the PDFs in `apps/render-api/out/`:
   repeated table header across the 300-row pages, "Page X of Y", 12 landscape columns, 20 concurrent renders.
2. The editor UI in a browser (it builds and type-checks; I did not click through it).
3. The `--chromium-allow-list=^file:///tmp/.*` line. If renders fail with 403, start here. Also check whether `data:` image URLs are
   blocked by the allow-list; if images fail, host them on the allow-listed domain.
4. Fonts: the CSS uses Noto/DejaVu/Liberation/Arial. Check your actual languages (e.g. Devanagari) render correctly; bake brand fonts into a custom Gotenberg image.
5. Editor <-> PDF fidelity of column widths set by dragging. Both apps share one schema, but the PDF has not been compared visually.
6. Pin the Gotenberg image to an exact tag >= 8.32.0 (check Docker Hub). The compose file uses the floating `8` tag.

## Next steps once the smoke test looks right
1. Move `apps/editor` code into your React app as a route; point `/api` at your backend, which calls render-api.
2. Replace the file-based template store with your DB (name, tenant, version, body/header/footer JSON, page settings).
3. Optional: swap in `tiptap-table-plus` / `tiptap-pagination-plus` for on-screen pages. They ship extensionless ESM imports, so they work in a bundler but not in plain Node.
   Only the editor should use them; the server keeps the official table extensions. Keep the server-rendered preview as the source of truth.
4. Add tenant auth, per-tenant rate limits, and a render queue if you need bulk generation.
