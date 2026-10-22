import { describe, expect, it } from 'vitest';
import { applyPageTokens, buildBodyDocument, hoistTableHeaders, resolvePage } from '../src/htmlDocument';

describe('hoistTableHeaders', () => {
  it('moves a leading all-<th> row into <thead>', () => {
    const html = hoistTableHeaders('<table><tbody><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>');
    expect(html).toBe('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>');
  });
  it('leaves tables without a header row alone', () => {
    const src = '<table><tbody><tr><td>1</td></tr></tbody></table>';
    expect(hoistTableHeaders(src)).toBe(src);
  });
  it('does not touch a nested table\'s rows when the outer first row has <td>', () => {
    const src = '<table><tbody><tr><td><table><tbody><tr><th>x</th></tr></tbody></table></td></tr></tbody></table>';
    const out = hoistTableHeaders(src);
    expect(out.match(/<thead>/g)).toHaveLength(1); // only the inner table
    expect(out.indexOf('<thead>')).toBeGreaterThan(out.indexOf('<td>'));
  });
});

describe('page + tokens', () => {
  it('replaces {page}/{total} with Chromium classes', () => {
    expect(applyPageTokens('Page {page} of {total}')).toBe('Page <span class="pageNumber"></span> of <span class="totalPages"></span>');
  });
  it('resolves A4 portrait defaults and landscape flag', () => {
    expect(resolvePage()).toMatchObject({ paperWidth: 8.27, paperHeight: 11.69, landscape: false, marginTop: 0.984 });
    expect(resolvePage({ size: 'Letter', orientation: 'landscape' })).toMatchObject({ paperWidth: 8.5, paperHeight: 11, landscape: true });
  });
  it('body document carries print CSS for repeating headers', () => {
    expect(buildBodyDocument('<p>x</p>')).toContain('thead{display:table-header-group}');
  });
});
