/**
 * 仅注册常用语言，避免 `import hljs from 'highlight.js'` 打全量 ~190+ 种语法。
 * 未注册的语言在 ```lang 中仍会以 plaintext 渲染。
 */
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

hljs.registerLanguage('javascript', javascript);
hljs.registerAliases(['js'], { languageName: 'javascript' });

hljs.registerLanguage('typescript', typescript);
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' });

hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);
hljs.registerAliases(['py'], { languageName: 'python' });
hljs.registerLanguage('java', java);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerAliases(['rs'], { languageName: 'rust' });
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('csharp', csharp);
hljs.registerAliases(['cs'], { languageName: 'csharp' });
hljs.registerLanguage('kotlin', kotlin);
hljs.registerAliases(['kt'], { languageName: 'kotlin' });
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('ruby', ruby);
hljs.registerAliases(['rb'], { languageName: 'ruby' });
hljs.registerLanguage('php', php);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('yaml', yaml);
hljs.registerAliases(['yml'], { languageName: 'yaml' });
hljs.registerLanguage('xml', xml);
hljs.registerAliases(['html', 'xhtml'], { languageName: 'xml' });
hljs.registerLanguage('css', css);
hljs.registerAliases(['scss', 'less'], { languageName: 'css' });
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', shell);
hljs.registerAliases(['sh', 'zsh'], { languageName: 'shell' });
hljs.registerLanguage('markdown', markdown);
hljs.registerAliases(['md', 'mkd'], { languageName: 'markdown' });

export default hljs;
