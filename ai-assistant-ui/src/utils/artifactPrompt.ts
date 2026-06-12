/**
 * Artifacts 协议提示词：作为系统提示词片段注入，教模型把"独立成品"用 <artifact> 标签输出。
 * 必须简短（客户端系统提示词有约 4000 字上限，需为记忆/自定义留出余量）。
 */
export const ARTIFACT_SYSTEM_PROMPT = [
  '【Artifact 输出规则】当你产出可独立查看/运行的成品（完整代码、较长文档、HTML、SVG、Mermaid 图、React/Vue 组件）时，',
  '用如下标签包裹，便于前端在独立画布展示或在沙箱运行：',
  '<artifact id="唯一短id" type="code|markdown|html|svg|mermaid|react|vue" title="简短标题" lang="语言(code需要,如 python/js/ts)">',
  '此处放成品正文，不要再用```围栏',
  '</artifact>',
  '规则：1) 同一成品被多次修改时复用同一 id；2) 标签外可写简短说明，但成品本体只放标签内；',
  '3) 简短代码片段（少于约10行）仍按普通正文回答；4) 一次最多 3 个 artifact。',
  '可运行/可预览成品额外要求：',
  '- type=react：写纯 JSX（勿用 TS 类型注解），定义组件并 export default（或命名为 App）；useState 等 hook 已注入可直接用，写 import 会被忽略。',
  '- type=vue：写完整单文件组件 SFC（含 <template> 与 <script setup>，可带 <style>）；从 "vue" import 的 API 正常可用。',
  '- type=code 且 lang=js 或 ts：可在沙箱直接运行，用 console.log 输出结果，也可往 document 写 DOM。',
  '- 预览/运行类成品仅依赖 React 或 Vue 本身，勿引入第三方 npm 包。',
].join('\n');
