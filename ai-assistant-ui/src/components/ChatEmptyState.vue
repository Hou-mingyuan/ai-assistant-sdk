<template>
  <div class="ai-empty">
    <div class="ai-empty-brand-badge" aria-hidden="true">
      <BrandMark class="ai-empty-brand-icon" :size="28" data-assistant-icon="sparkles" />
    </div>
    <p class="ai-empty-greeting">{{ greeting }}</p>
    <p v-if="subtitle" class="ai-empty-subtitle">{{ subtitle }}</p>
    <div v-if="cards.length > 0" class="ai-empty-featured">
      <button
        v-for="card in cards"
        :key="card.id"
        type="button"
        class="ai-empty-starter"
        :data-starter-tone="card.tone"
        @click="handleCardClick(card)"
      >
        <span class="ai-empty-starter-icon" aria-hidden="true">
          <AssistantIcon :name="card.icon" :size="16" />
        </span>
        <span class="ai-empty-starter-body">
          <span class="ai-empty-starter-text">{{ card.title }}</span>
          <span class="ai-empty-starter-desc">{{ card.desc }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AssistantIcon from './AssistantIcon.vue';
import BrandMark from './BrandMark.vue';

export interface LeanEmptyCard {
  id: string;
  icon: string;
  title: string;
  desc: string;
  tone: string;
  action: 'prompt' | 'upload' | 'form-fill';
  prompt?: string;
}

const props = defineProps<{
  greeting: string;
  subtitle?: string;
  formAutoFillEnabled?: boolean;
  quickPrompts?: { label: string; text: string }[];
  isZh?: boolean;
}>();

const emit = defineEmits<{
  (e: 'apply-prompt', text: string): void;
  (e: 'trigger-upload'): void;
  (e: 'trigger-form-fill'): void;
}>();

const cards = computed<LeanEmptyCard[]>(() => {
  if (props.quickPrompts && props.quickPrompts.length > 0) {
    return props.quickPrompts.slice(0, 4).map((qp, idx) => ({
      id: `qp-${idx}`,
      icon: 'sparkles',
      title: qp.label,
      desc: qp.text,
      tone: 'blue',
      action: 'prompt',
      prompt: qp.text,
    }));
  }
  const zh = props.isZh ?? true;
  const list: LeanEmptyCard[] = [
    {
      id: 'chat',
      icon: 'message-circle',
      title: zh ? '开始对话' : 'Start a conversation',
      desc: zh ? '基于当前页面或任意问题提问' : 'Ask anything or analyze this page',
      tone: 'blue',
      action: 'prompt',
      prompt: zh
        ? '请简要介绍一下当前页面内容并给我使用建议'
        : 'Summarize this page and suggest next steps',
    },
    {
      id: 'upload',
      icon: 'upload',
      title: zh ? '上传文件问答' : 'Ask about a file',
      desc: zh ? '支持 PDF / Word / Excel / TXT 文档' : 'Upload PDF, Word, Excel, or text files',
      tone: 'teal',
      action: 'upload',
    },
  ];
  if (props.formAutoFillEnabled) {
    list.push({
      id: 'fill',
      icon: 'square-check-big',
      title: zh ? '剪贴板自动填表' : 'Auto-fill page form',
      desc: zh
        ? '从剪贴板识别「键: 值」批量写入表单'
        : 'Match key-value text into page form fields',
      tone: 'amber',
      action: 'form-fill',
    });
  }
  return list;
});

function handleCardClick(card: LeanEmptyCard) {
  if (card.action === 'upload') emit('trigger-upload');
  else if (card.action === 'form-fill') emit('trigger-form-fill');
  else if (card.prompt) emit('apply-prompt', card.prompt);
}
</script>
