/**
 * markdownHljs.worker
 * --------------------
 * Web Worker that bundles {@link Marked} + {@link markedHighlight} + a subset
 * of {@link hljs} languages so the entire Markdown -> highlighted-HTML pass
 * can run off the main thread.
 *
 * Wire it via {@link createHljsMarkdownWorker}; the protocol mirrors the
 * default Blob-URL worker in {@link useMarkdownWorker} so the wrapper can be
 * reused untouched.
 *
 * Bundled languages (6 core, ~30 KB minified together):
 *   javascript / typescript / json / python / bash / xml
 *
 * Why only 6: the worker bundle ships verbatim inside the host's main JS
 * bundle (via `?worker&inline` in Vite library mode). Each extra language
 * adds ~3-8 KB; the long tail (rust/swift/kotlin/...) is already dynamically
 * imported on the main thread by {@link hljsRegistered}, so we keep the worker
 * focused on the most common cases.
 *
 * Falls back gracefully:
 *  - Unknown language => plaintext (via hljs default)
 *  - Marked exception => returns `{ error }`; wrapper degrades to syncRenderer.
 *
 * Message protocol:
 *  - inbound:  { id: number, markdown: string }
 *  - outbound: { id: number, html?: string, error?: string }
 */

import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import xml from 'highlight.js/lib/languages/xml';

hljs.registerLanguage('javascript', javascript);
hljs.registerAliases(['js'], { languageName: 'javascript' });
hljs.registerLanguage('typescript', typescript);
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' });
hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);
hljs.registerAliases(['py'], { languageName: 'python' });
hljs.registerLanguage('bash', bash);
hljs.registerAliases(['sh', 'zsh', 'shell'], { languageName: 'bash' });
hljs.registerLanguage('xml', xml);
hljs.registerAliases(['html', 'xhtml'], { languageName: 'xml' });

const marked = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'language-',
    highlight(code, lang) {
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
      try {
        return hljs.highlight(code, { language, ignoreIllegals: true }).value;
      } catch {
        return hljs.highlightAuto(code).value;
      }
    },
  }),
  { gfm: true, breaks: true },
);

self.onmessage = (event: MessageEvent<{ id: number; markdown: string }>) => {
  const { id, markdown } = event.data || ({} as { id: number; markdown: string });
  if (typeof markdown !== 'string') {
    self.postMessage({ id, error: 'invalid input' });
    return;
  }
  try {
    const html = marked.parse(markdown, { async: false }) as string;
    self.postMessage({ id, html });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    self.postMessage({ id, error: msg });
  }
};

export {};
