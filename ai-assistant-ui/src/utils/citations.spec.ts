import { describe, it, expect } from 'vitest';
import { linkifyCitations } from './citations';

describe('linkifyCitations', () => {
  const sources = [
    { url: 'https://www.example.com/a', title: 'Doc A', snippet: 's' },
    { url: 'https://news.site.org/b', title: 'Doc B' },
  ];

  it('turns valid [n] into a clickable citation chip', () => {
    const out = linkifyCitations('See [1] and [2].', sources);
    expect(out).toContain('<a class="ai-cite" href="https://www.example.com/a"');
    expect(out).toContain('>1</a>');
    expect(out).toContain('>2</a>');
    expect(out).toContain('example.com');
  });

  it('leaves out-of-range markers untouched', () => {
    expect(linkifyCitations('ref [3] [0]', sources)).toBe('ref [3] [0]');
  });

  it('does not rewrite inside code or pre blocks', () => {
    expect(linkifyCitations('<code>arr[1]</code>', sources)).toBe('<code>arr[1]</code>');
    expect(linkifyCitations('<pre>x[1]</pre>', sources)).toBe('<pre>x[1]</pre>');
  });

  it('does not nest inside existing anchors', () => {
    const html = '<a href="x">link [1]</a>';
    expect(linkifyCitations(html, sources)).toBe(html);
  });

  it('returns html unchanged when there are no sources', () => {
    expect(linkifyCitations('hi [1]', [])).toBe('hi [1]');
  });

  it('renders a non-link chip when the source has no url', () => {
    const out = linkifyCitations('see [1]', [{ title: 'No URL' }]);
    expect(out).toContain('<span class="ai-cite ai-cite-plain"');
    expect(out).toContain('>1</span>');
  });
});
