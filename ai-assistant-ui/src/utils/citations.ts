/**
 * Inline citation linkifier.
 *
 * Turns `[n]` markers in already-rendered, sanitized assistant HTML into clickable
 * superscript citation chips that open the matching source. Only `[n]` where
 * 1 <= n <= sources.length is transformed; everything else is left untouched.
 *
 * Safety: operates on a tokenized stream so it never rewrites inside HTML tags,
 * `<pre>` / `<code>` blocks, existing `<a>` anchors, or mermaid placeholders. The
 * generated markup is self-built with escaped attributes, so feeding the result
 * back into v-html does not widen the XSS surface (input is already DOMPurified).
 */

export interface CitationSource {
  url?: string;
  title?: string;
  snippet?: string;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function domainOf(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Segments we must never rewrite inside (tags, code, anchors, mermaid source). */
const SKIP_TOKENS =
  /(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<a\b[\s\S]*?<\/a>|<div[^>]*ai-mermaid-placeholder[\s\S]*?<\/div>|<[^>]+>)/gi;

export function linkifyCitations(html: string, sources: CitationSource[]): string {
  const count = sources.length;
  if (!count || !html) return html;

  return html
    .split(SKIP_TOKENS)
    .map((segment) => {
      if (!segment || segment[0] === '<') return segment;
      return segment.replace(/\[(\d{1,3})\]/g, (whole, digits) => {
        const idx = Number(digits);
        if (idx < 1 || idx > count) return whole;
        const src = sources[idx - 1] || {};
        const domain = domainOf(src.url);
        const titleText = src.title || src.url || `Source ${idx}`;
        const tip = domain ? `[${idx}] ${titleText} — ${domain}` : `[${idx}] ${titleText}`;
        // aria-label for screen readers; data-cite-* feeds the Teleported hover
        // card (v2.1). No `title` attr, to avoid a native tooltip doubling the card.
        const dataAttr =
          ` aria-label="${escapeAttr(tip)}"` +
          ` data-cite-title="${escapeAttr(titleText)}"` +
          (domain ? ` data-cite-domain="${escapeAttr(domain)}"` : '') +
          (src.snippet ? ` data-cite-snippet="${escapeAttr(src.snippet)}"` : '');
        if (src.url) {
          return (
            `<a class="ai-cite" href="${escapeAttr(src.url)}"` +
            ` target="_blank" rel="noopener noreferrer"${dataAttr}>${idx}</a>`
          );
        }
        return `<span class="ai-cite ai-cite-plain"${dataAttr}>${idx}</span>`;
      });
    })
    .join('');
}
