/**
 * Core languages are bundled eagerly (~40 KB gzipped vs ~120 KB for all 21).
 * Extended languages are loaded on first encounter via dynamic import.
 */
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import shell from 'highlight.js/lib/languages/shell';
import xml from 'highlight.js/lib/languages/xml';

hljs.registerLanguage('javascript', javascript);
hljs.registerAliases(['js'], { languageName: 'javascript' });
hljs.registerLanguage('typescript', typescript);
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' });
hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);
hljs.registerAliases(['py'], { languageName: 'python' });
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', shell);
hljs.registerAliases(['sh', 'zsh'], { languageName: 'shell' });
hljs.registerLanguage('xml', xml);
hljs.registerAliases(['html', 'xhtml'], { languageName: 'xml' });
type LangLoader = () => Promise<{ default: Parameters<typeof hljs.registerLanguage>[1] }>;

const extendedLangs: Record<string, { loader: LangLoader; aliases?: string[] }> = {
  java: { loader: () => import('highlight.js/lib/languages/java') },
  go: { loader: () => import('highlight.js/lib/languages/go') },
  rust: { loader: () => import('highlight.js/lib/languages/rust'), aliases: ['rs'] },
  c: { loader: () => import('highlight.js/lib/languages/c') },
  cpp: { loader: () => import('highlight.js/lib/languages/cpp') },
  csharp: { loader: () => import('highlight.js/lib/languages/csharp'), aliases: ['cs'] },
  kotlin: { loader: () => import('highlight.js/lib/languages/kotlin'), aliases: ['kt'] },
  swift: { loader: () => import('highlight.js/lib/languages/swift') },
  ruby: { loader: () => import('highlight.js/lib/languages/ruby'), aliases: ['rb'] },
  php: { loader: () => import('highlight.js/lib/languages/php') },
  yaml: { loader: () => import('highlight.js/lib/languages/yaml'), aliases: ['yml'] },
  css: { loader: () => import('highlight.js/lib/languages/css'), aliases: ['scss', 'less'] },
  markdown: { loader: () => import('highlight.js/lib/languages/markdown'), aliases: ['md', 'mkd'] },
  sql: { loader: () => import('highlight.js/lib/languages/sql') },
};

const aliasMap = new Map<string, string>();
for (const [name, cfg] of Object.entries(extendedLangs)) {
  aliasMap.set(name, name);
  cfg.aliases?.forEach((a) => aliasMap.set(a, name));
}

const loading = new Set<string>();

/**
 * Attempt to load an extended language on demand.
 * Returns true synchronously if the language is already registered;
 * otherwise triggers an async load (for next render).
 */
export function ensureLanguage(lang: string): boolean {
  if (hljs.getLanguage(lang)) return true;
  const canonical = aliasMap.get(lang);
  if (!canonical) return false;
  if (loading.has(canonical)) return false;
  loading.add(canonical);
  const cfg = extendedLangs[canonical];
  cfg
    .loader()
    .then((mod) => {
      hljs.registerLanguage(canonical, mod.default);
      cfg.aliases?.forEach((a) => hljs.registerAliases([a], { languageName: canonical }));
    })
    .catch(() => {
      loading.delete(canonical);
    });
  return false;
}

export default hljs;
