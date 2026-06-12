/**
 * message.ts artifact 提取的回归测试，重点覆盖修复点：
 * 模型被 max_tokens 截断、代码围栏**未闭合**时，promoteLargeCodeBlocks 仍应把它提升为
 * artifact（否则整段代码会以原文残留、进不了画布——deepseek 长回复实测触发过）。
 */
import { describe, it, expect } from 'vitest';
import { promoteLargeCodeBlocks, extractArtifacts } from './message';

describe('promoteLargeCodeBlocks 围栏提升', () => {
  it('闭合的 ```vue 围栏 → 提升为 vue artifact', () => {
    const raw = '这是组件：\n\n```vue\n<template><div/></template>\n```\n';
    const r = promoteLargeCodeBlocks(raw);
    expect(r.artifacts).toHaveLength(1);
    expect(r.artifacts[0].type).toBe('vue');
    expect(r.content).not.toContain('```');
  });

  it('末尾未闭合的 ```vue 围栏（截断）→ 仍提升为 vue artifact', () => {
    const raw =
      '一个计数器组件：\n\n```vue\n<template>\n  <div>{{ n }}</div>\n</template>\n' +
      '<script setup>\nimport { ref } from "vue";\nconst n = ref(0);\n// 被截断，无结尾围栏';
    const r = promoteLargeCodeBlocks(raw);
    expect(r.artifacts).toHaveLength(1);
    expect(r.artifacts[0].type).toBe('vue');
    expect(r.artifacts[0].content).toContain('const n = ref(0)');
    expect(r.content).not.toContain('```');
  });

  it('末尾未闭合的普通代码围栏，行数达标 → 提升为 code', () => {
    const body = Array.from({ length: 14 }, (_, i) => `line${i}`).join('\n');
    const r = promoteLargeCodeBlocks('看代码：\n\n```python\n' + body);
    expect(r.artifacts).toHaveLength(1);
    expect(r.artifacts[0].type).toBe('code');
    expect(r.artifacts[0].lang).toBe('python');
  });

  it('末尾未闭合的短普通围栏（不足 minLines）→ 不提升', () => {
    const r = promoteLargeCodeBlocks('小片段：\n\n```python\nprint(1)\nprint(2)');
    expect(r.artifacts).toHaveLength(0);
  });

  it('未闭合的 ```mermaid 围栏（特殊类型，不看行数）→ 提升', () => {
    const r = promoteLargeCodeBlocks('流程：\n\n```mermaid\ngraph TD\nA-->B');
    expect(r.artifacts).toHaveLength(1);
    expect(r.artifacts[0].type).toBe('mermaid');
  });

  it('extractArtifacts 仍能解析闭合 <artifact> 标签', () => {
    const r = extractArtifacts('<artifact id="a1" type="vue" title="X">CONTENT</artifact>');
    expect(r.artifacts).toHaveLength(1);
    expect(r.artifacts[0].type).toBe('vue');
  });
});

describe('extractArtifacts 兼容 deepseek 各种 artifact 格式', () => {
  it('裸 <artifact>（无属性）内包 ```vue 围栏 → vue 类型且去掉围栏标记', () => {
    const raw = '说明\n<artifact>\n```vue\n<template><div/></template>\n```\n</artifact>';
    const r = extractArtifacts(raw);
    expect(r.artifacts).toHaveLength(1);
    expect(r.artifacts[0].type).toBe('vue');
    expect(r.artifacts[0].content).not.toContain('```');
    expect(r.content).not.toContain('<artifact');
  });

  it('Claude 风格 identifier/language 属性 → 正确 id 与类型', () => {
    const raw =
      '<artifact identifier="todo" title="待办" version="1.0.0" language="html"><div>hi</div></artifact>';
    const r = extractArtifacts(raw);
    expect(r.artifacts).toHaveLength(1);
    expect(r.artifacts[0].id).toBe('todo');
    expect(r.artifacts[0].type).toBe('html');
  });

  it('未闭合的裸 <artifact> 内包未闭合 ```vue（双重截断）→ 仍提取为 vue', () => {
    const raw =
      '看组件：\n<artifact>\n```vue\n<template>\n<div>{{ n }}</div>\n</template>\n<script setup>\nconst n = 1;';
    const r = extractArtifacts(raw);
    expect(r.artifacts).toHaveLength(1);
    expect(r.artifacts[0].type).toBe('vue');
    expect(r.content).not.toContain('<artifact');
  });
});
