<script setup lang="ts">
/**
 * 侧边 Canvas（P1）：渲染 + 版本切换 + 版本 diff + 编辑后重发。
 * - code     → highlight.js 高亮
 * - markdown → marked + DOMPurify
 * - html/svg → 沙箱 iframe（可"新标签打开"）
 * - mermaid  → 懒加载 mermaid 真渲染（securityLevel=strict）
 */
import { computed, ref, watch } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs, { ensureLanguage } from '../utils/hljsRegistered';
import { diffLines, type SideBySideRow } from '../composables/useLineDiff';
import type { Artifact } from '../types/message';
import { buildShareableHtml, shareableFileName } from '../utils/artifactHtml';
import AssistantIcon from './AssistantIcon.vue';
import ArtifactRunner from './ArtifactRunner.vue';

const props = defineProps<{ artifact: Artifact | null; versions?: Artifact[] }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'resend', text: string): void }>();

const versions = computed<Artifact[]>(() => {
  if (props.versions && props.versions.length) return props.versions;
  return props.artifact ? [props.artifact] : [];
});

const viewIndex = ref(0);
const showDiff = ref(false);
const editing = ref(false);
const draft = ref('');
const copied = ref(false);
const mermaidSvg = ref('');
const mermaidError = ref('');
/** P2：是否处于"运行/实时预览"视图（react/vue 默认开；可运行 JS 默认看代码）。 */
const previewMode = ref(false);

const displayed = computed<Artifact | null>(
  () => versions.value[viewIndex.value] ?? props.artifact,
);
const hasVersions = computed(() => versions.value.length > 1);
const canDiff = computed(() => viewIndex.value > 0);

/** P2：可在沙箱里运行/预览的语言（type=code 时）。 */
const JS_RUN_LANGS = new Set(['js', 'javascript', 'node', 'nodejs', 'mjs', 'ts', 'typescript']);
const isLivePreviewType = computed(
  () => displayed.value?.type === 'react' || displayed.value?.type === 'vue',
);
const isRunnableCode = computed(() => {
  const a = displayed.value;
  return a?.type === 'code' && JS_RUN_LANGS.has((a.lang || '').toLowerCase());
});
const isRunnable = computed(() => isLivePreviewType.value || isRunnableCode.value);
/** 运行按钮文案：react/vue 叫"预览"，可运行 JS 叫"运行"。 */
const runLabel = computed(() => (isLivePreviewType.value ? '预览' : '运行'));

/* 切换打开的 artifact / 新版本到来时，跳到最新版并复位面板状态。 */
watch(
  () => [props.artifact?.id, versions.value.length],
  () => {
    viewIndex.value = Math.max(0, versions.value.length - 1);
    showDiff.value = false;
    editing.value = false;
    // react/vue 打开即进实时预览；可运行 JS 默认先看代码（点"运行"再进沙箱）。
    previewMode.value = isLivePreviewType.value;
  },
  { immediate: true },
);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const isFramePreview = computed(
  () => displayed.value?.type === 'html' || displayed.value?.type === 'svg',
);

const highlightedCode = computed(() => {
  const a = displayed.value;
  if (!a) return '';
  const lang = (a.lang || '').toLowerCase();
  try {
    if (lang && hljs.getLanguage(lang)) return hljs.highlight(a.content, { language: lang }).value;
    if (lang) ensureLanguage(lang);
    return hljs.highlightAuto(a.content).value;
  } catch {
    return escapeHtml(a.content);
  }
});

const renderedMarkdown = computed(() => {
  const a = displayed.value;
  if (!a) return '';
  try {
    return DOMPurify.sanitize(marked.parse(a.content, { async: false }) as string);
  } catch {
    return escapeHtml(a.content);
  }
});

const frameDoc = computed(() => {
  const a = displayed.value;
  if (!a) return '';
  if (a.type === 'svg') {
    return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;background:#fff}svg{max-width:100%;max-height:100%}</style></head><body>${a.content}</body></html>`;
  }
  return a.content;
});

const diffRows = computed<SideBySideRow[]>(() => {
  if (!showDiff.value || viewIndex.value <= 0) return [];
  const prev = versions.value[viewIndex.value - 1]?.content ?? '';
  const cur = displayed.value?.content ?? '';
  return diffLines(prev, cur).rows;
});

/* mermaid 懒加载渲染 */
watch(
  [displayed, showDiff, editing],
  async () => {
    mermaidSvg.value = '';
    mermaidError.value = '';
    const a = displayed.value;
    if (!a || a.type !== 'mermaid' || showDiff.value || editing.value) return;
    try {
      const mod = await import('mermaid');
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'strict',
        suppressErrorRendering: true,
      });
      const { svg } = await mermaid.render(`ai-art-mmd-${Date.now()}`, a.content);
      mermaidSvg.value = svg;
    } catch (e) {
      mermaidError.value = e instanceof Error ? e.message : String(e);
    }
  },
  { immediate: true },
);

const typeLabel = computed(() => {
  const a = displayed.value;
  if (!a) return '';
  if (a.type === 'code') return (a.lang || 'code').toUpperCase();
  return a.type.toUpperCase();
});

function selectVersion(i: number) {
  viewIndex.value = i;
  showDiff.value = false;
  editing.value = false;
}

function extForArtifact(a: Artifact): string {
  if (a.type === 'markdown') return 'md';
  if (a.type === 'html') return 'html';
  if (a.type === 'svg') return 'svg';
  if (a.type === 'mermaid') return 'mmd';
  if (a.type === 'react') return a.lang === 'tsx' ? 'tsx' : 'jsx';
  if (a.type === 'vue') return 'vue';
  const lang = (a.lang || '').toLowerCase();
  const map: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    bash: 'sh',
    shell: 'sh',
    java: 'java',
    go: 'go',
    rust: 'rs',
    csharp: 'cs',
    ruby: 'rb',
    kotlin: 'kt',
  };
  return map[lang] || lang || 'txt';
}

async function copyContent() {
  const a = displayed.value;
  if (!a) return;
  try {
    await navigator.clipboard.writeText(a.content);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    /* clipboard 不可用时静默 */
  }
}

function downloadContent() {
  const a = displayed.value;
  if (!a) return;
  const safeTitle = (a.title || 'artifact').replace(/[^\w.-]+/g, '_').slice(0, 40) || 'artifact';
  const blob = new Blob([a.content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeTitle}.${extForArtifact(a)}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** 在新标签页打开「渲染后的自包含预览」（所有类型适用，等于即时发布预览）。 */
function openInNewTab() {
  const a = displayed.value;
  if (!a) return;
  const blob = new Blob([buildShareableHtml(a)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** 分享/发布：导出渲染后的自包含单文件 HTML（脱离本服务也能打开）。 */
function shareDownload() {
  const a = displayed.value;
  if (!a) return;
  const blob = new Blob([buildShareableHtml(a)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = shareableFileName(a);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function startEdit() {
  const a = displayed.value;
  if (!a) return;
  draft.value = a.content;
  editing.value = true;
  showDiff.value = false;
}

function cancelEdit() {
  editing.value = false;
}

function applyResend() {
  const a = displayed.value;
  if (!a) return;
  const langAttr = a.lang ? ` lang="${a.lang}"` : '';
  const prompt =
    `请基于我手动修改后的版本，更新名为「${a.title}」的成品` +
    `（继续用 <artifact id="${a.id}" type="${a.type}"${langAttr} title="${a.title}"> 输出，沿用同一 id；如有问题请一并修正）。\n\n修改后的内容：\n` +
    draft.value;
  editing.value = false;
  emit('resend', prompt);
}
</script>

<template>
  <section v-if="artifact" class="ai-artifact-canvas" aria-label="Artifact canvas">
    <header class="ai-artifact-canvas-head">
      <div class="ai-artifact-canvas-title">
        <span class="ai-artifact-canvas-type">{{ typeLabel }}</span>
        <span class="ai-artifact-canvas-name">{{ displayed?.title }}</span>
      </div>
      <div class="ai-artifact-canvas-actions">
        <button
          v-if="isRunnable && !editing && !showDiff"
          type="button"
          class="ai-artifact-btn"
          :class="{ 'is-active': previewMode }"
          :title="previewMode ? '查看源码' : '在沙箱运行 / 预览'"
          @click="previewMode = !previewMode"
        >
          <span class="ai-artifact-run-icon" aria-hidden="true">
            <AssistantIcon :name="previewMode ? 'code-xml' : 'play'" :size="14" />
          </span>
          <span>{{ previewMode ? '查看代码' : runLabel }}</span>
        </button>
        <button
          v-if="!editing"
          type="button"
          class="ai-artifact-btn"
          title="在新标签页打开渲染后的预览"
          @click="openInNewTab"
        >
          <span class="ai-artifact-external-icon" aria-hidden="true">
            <AssistantIcon name="external-link" :size="14" />
          </span>
        </button>
        <button
          v-if="!editing"
          type="button"
          class="ai-artifact-btn"
          title="编辑后重发"
          @click="startEdit"
        >
          <AssistantIcon name="pencil" :size="14" />
          <span>编辑</span>
        </button>
        <button
          v-if="canDiff && !editing"
          type="button"
          class="ai-artifact-btn"
          :class="{ 'is-active': showDiff }"
          title="对比上一版"
          @click="showDiff = !showDiff"
        >
          <AssistantIcon name="git-compare-arrows" :size="14" />
          <span>对比</span>
        </button>
        <button
          type="button"
          class="ai-artifact-btn"
          :title="copied ? '已复制' : '复制'"
          @click="copyContent"
        >
          <AssistantIcon :name="copied ? 'check' : 'copy'" :size="14" />
          <span>{{ copied ? '已复制' : '复制' }}</span>
        </button>
        <button type="button" class="ai-artifact-btn" title="下载源码文件" @click="downloadContent">
          <AssistantIcon name="file-down" :size="14" />
          <span>下载</span>
        </button>
        <button
          type="button"
          class="ai-artifact-btn"
          title="导出自包含 HTML（可分享 / 发布）"
          @click="shareDownload"
        >
          <AssistantIcon name="share-2" :size="14" />
          <span>分享</span>
        </button>
        <button
          type="button"
          class="ai-artifact-btn ai-artifact-btn-close"
          title="关闭"
          aria-label="关闭"
          @click="emit('close')"
        >
          <AssistantIcon name="x" :size="15" />
        </button>
      </div>
    </header>

    <!-- 版本切换条 -->
    <div v-if="hasVersions" class="ai-artifact-versions">
      <span class="ai-artifact-versions-label">版本</span>
      <button
        v-for="(v, i) in versions"
        :key="i"
        type="button"
        class="ai-artifact-version-pill"
        :class="{ 'is-active': i === viewIndex }"
        @click="selectVersion(i)"
      >
        v{{ i + 1 }}
      </button>
    </div>

    <div class="ai-artifact-canvas-body">
      <!-- 编辑模式 -->
      <div v-if="editing" class="ai-artifact-edit">
        <textarea v-model="draft" class="ai-artifact-edit-area" spellcheck="false"></textarea>
        <div class="ai-artifact-edit-actions">
          <button type="button" class="ai-artifact-btn" @click="cancelEdit">取消</button>
          <button
            type="button"
            class="ai-artifact-btn ai-artifact-btn-primary"
            @click="applyResend"
          >
            应用并重发
          </button>
        </div>
      </div>

      <!-- 版本 diff -->
      <div v-else-if="showDiff" class="ai-artifact-diff">
        <div
          v-for="(row, i) in diffRows"
          :key="i"
          class="ai-artifact-diff-row"
          :class="`is-${row.kind}`"
        >
          <pre class="ai-artifact-diff-col is-left">{{ row.leftText }}</pre>
          <pre class="ai-artifact-diff-col is-right">{{ row.rightText }}</pre>
        </div>
      </div>

      <!-- P2：React / Vue / 可运行 JS —— 沙箱实时运行 -->
      <ArtifactRunner
        v-else-if="previewMode && isRunnable && displayed"
        :artifact="displayed"
        class="ai-artifact-runner-host"
      />

      <!-- HTML / SVG 沙箱预览 -->
      <iframe
        v-else-if="isFramePreview"
        class="ai-artifact-frame"
        sandbox="allow-scripts allow-popups"
        :srcdoc="frameDoc"
        title="Artifact preview"
      ></iframe>

      <!--
        Mermaid 使用 securityLevel=strict，Markdown 经 DOMPurify 清洗，highlight.js
        输出会转义原始代码。下面三个 v-html 入口只接收这些受控结果。
      -->
      <!-- eslint-disable vue/no-v-html -->
      <!-- Mermaid 渲染 -->
      <div v-else-if="displayed?.type === 'mermaid'" class="ai-artifact-mermaid">
        <p v-if="mermaidError" class="ai-artifact-mermaid-err">图渲染失败：{{ mermaidError }}</p>
        <div v-else-if="mermaidSvg" v-html="mermaidSvg"></div>
        <p v-else class="ai-artifact-mermaid-loading">图渲染中…</p>
      </div>

      <!-- Markdown -->
      <div
        v-else-if="displayed?.type === 'markdown'"
        class="ai-artifact-md"
        v-html="renderedMarkdown"
      ></div>

      <!-- Code -->
      <pre v-else class="ai-artifact-code"><code v-html="highlightedCode"></code></pre>
      <!-- eslint-enable vue/no-v-html -->
    </div>
  </section>
</template>
