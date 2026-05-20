<template>
  <!--
    无消息时的空状态：欢迎语 + skill chip 条 + starter 卡片 + capability 提示 + prompt template 按钮组。
    所有 i18n 静态内容通过 useEmptyStateContent composable 注入，本组件只负责渲染与事件转发。
    Refactor (T1)：从 AiAssistant.vue 抽出。
  -->
  <div class="ai-empty">
    <p>{{ greeting }}</p>
    <button
      v-if="hasTaskEntries"
      type="button"
      class="ai-empty-task-toggle"
      :aria-expanded="taskPanelOpen ? 'true' : 'false'"
      @click="taskPanelOpen = !taskPanelOpen"
    >
      <span>{{ taskPanelOpen ? taskLauncherCloseLabel : taskLauncherLabel }}</span>
    </button>
    <div v-if="hasTaskEntries && taskPanelOpen" class="ai-empty-task-panel">
      <section v-if="mode === 'chat' && skills.length > 0" class="ai-empty-task-section">
        <div class="ai-empty-section-title">{{ skillStripLabel }}</div>
        <div class="ai-empty-skills" :aria-label="skillStripLabel">
          <button
            v-for="skill in skills"
            :key="skill.label"
            type="button"
            class="ai-empty-skill"
            :data-skill-tone="skill.tone"
            @click="emit('apply-skill', skill)"
          >
            <span class="ai-empty-skill-icon" aria-hidden="true">{{ skill.icon }}</span>
            <span>{{ skill.label }}</span>
          </button>
        </div>
      </section>
      <section v-if="starters.length > 0" class="ai-empty-task-section">
        <div class="ai-empty-section-title">{{ starterSectionLabel }}</div>
        <div class="ai-empty-starters">
          <button
            v-for="starter in starters"
            :key="starter.title"
            type="button"
            class="ai-empty-starter"
            :data-starter-tone="starter.tone"
            @click="emit('apply-starter', starter)"
          >
            <span class="ai-empty-starter-icon" aria-hidden="true">{{ starter.icon }}</span>
            <span class="ai-empty-starter-body">
              <span class="ai-empty-starter-text">{{ starter.title }}</span>
              <span class="ai-empty-starter-desc">{{ starter.desc }}</span>
            </span>
          </button>
        </div>
      </section>
      <section v-if="capabilityHints.length > 0" class="ai-empty-task-section">
        <div class="ai-empty-section-title">{{ capabilitySectionLabel }}</div>
        <div class="ai-empty-capabilities" :aria-label="capabilitySectionLabel">
          <span v-for="hint in capabilityHints" :key="hint.label" class="ai-empty-capability">
            <span class="ai-empty-capability-icon" aria-hidden="true">{{ hint.icon }}</span>
            <span>{{ hint.label }}</span>
          </span>
        </div>
      </section>
      <section v-if="promptTemplates.length > 0" class="ai-empty-task-section">
        <div class="ai-empty-section-title">{{ templateSectionLabel }}</div>
        <div class="ai-prompt-templates">
          <button
            v-for="(tpl, ti) in promptTemplates"
            :key="ti"
            type="button"
            class="ai-prompt-tpl-btn"
            @click="emit('apply-template', tpl)"
          >
            {{ tpl.label }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type {
  EmptySkillChip,
  EmptyStarterCard,
  EmptyCapabilityHint,
} from '../composables/useEmptyStateContent';

export interface PromptTemplateItem {
  label: string;
  template: string;
  variables?: { name: string; label: string; default?: string }[];
}

const props = defineProps<{
  mode: 'translate' | 'summarize' | 'chat';
  greeting: string;
  skillStripLabel: string;
  taskLauncherLabel: string;
  taskLauncherCloseLabel: string;
  starterSectionLabel: string;
  capabilitySectionLabel: string;
  templateSectionLabel: string;
  skills: EmptySkillChip[];
  starters: EmptyStarterCard[];
  capabilityHints: EmptyCapabilityHint[];
  promptTemplates: PromptTemplateItem[];
}>();

const emit = defineEmits<{
  (e: 'apply-skill', skill: EmptySkillChip): void;
  (e: 'apply-starter', starter: EmptyStarterCard): void;
  (e: 'apply-template', tpl: PromptTemplateItem): void;
}>();

const taskPanelOpen = ref(false);
const hasTaskEntries = computed(
  () =>
    (props.mode === 'chat' && props.skills.length > 0) ||
    props.starters.length > 0 ||
    props.capabilityHints.length > 0 ||
    props.promptTemplates.length > 0,
);
</script>
