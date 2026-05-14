<template>
  <Transition name="ai-panel">
    <div v-if="memoryOpen" class="ai-memory-overlay" @click.self="emit('update:memoryOpen', false)">
      <div class="ai-memory-panel">
        <div class="ai-memory-header">
          <span class="ai-memory-title">{{ t.memoryLabel || '记忆管理' }}</span>
          <button type="button" class="ai-memory-close" @click="emit('update:memoryOpen', false)">
            &times;
          </button>
        </div>
        <div class="ai-memory-body">
          <div class="ai-memory-add-row">
            <input
              v-model="memoryNewText"
              class="ai-memory-input"
              :placeholder="t.memoryAddPlaceholder || '添加一条记忆…'"
              @keydown.enter.prevent="addMemoryItem"
            />
            <button
              type="button"
              class="ai-memory-add-btn"
              :disabled="!memoryNewText.trim()"
              @click="addMemoryItem"
            >
              +
            </button>
          </div>
          <div v-if="crossMemory.items.value.length === 0" class="ai-memory-empty">
            {{ t.memoryEmpty || '暂无记忆条目' }}
          </div>
          <div v-for="m in crossMemory.items.value" :key="m.id" class="ai-memory-item">
            <span class="ai-memory-item-text">{{ m.text }}</span>
            <button type="button" class="ai-memory-item-del" @click="crossMemory.removeItem(m.id)">
              &times;
            </button>
          </div>
        </div>
        <div v-if="crossMemory.items.value.length > 0" class="ai-memory-footer">
          <button type="button" class="ai-memory-clear" @click="crossMemory.clearAll()">
            {{ t.memoryClearAll || '清除全部' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <Transition name="ai-panel">
    <div v-if="kbOpen" class="ai-memory-overlay" @click.self="emit('update:kbOpen', false)">
      <div class="ai-memory-panel" style="width: min(420px, 92%)">
        <div class="ai-memory-header">
          <span class="ai-memory-title">{{ t.kbLabel || '知识库管理' }}</span>
          <button type="button" class="ai-memory-close" @click="emit('update:kbOpen', false)">
            &times;
          </button>
        </div>
        <div class="ai-memory-body">
          <div class="ai-memory-add-row">
            <input
              v-model="kbNewName"
              class="ai-memory-input"
              :placeholder="t.kbAddPlaceholder || '新建知识库名称…'"
              @keydown.enter.prevent="createKb"
            />
            <button
              type="button"
              class="ai-memory-add-btn"
              :disabled="!kbNewName.trim()"
              @click="createKb"
            >
              +
            </button>
          </div>
          <input
            ref="kbFileInputRef"
            type="file"
            accept=".txt,.md,.pdf,.docx,.csv,.json"
            style="display: none"
            @change="onKbFileSelect"
          />
          <div v-if="knowledgeBase.bases.value.length === 0" class="ai-memory-empty">
            {{ t.kbEmpty || '暂无知识库' }}
          </div>
          <details v-for="kb in knowledgeBase.bases.value" :key="kb.id" class="ai-kb-item">
            <summary class="ai-kb-summary">
              <label class="ai-kb-toggle">
                <input
                  type="checkbox"
                  :checked="kb.enabled"
                  @change="knowledgeBase.toggleBase(kb.id)"
                />
                <span class="ai-kb-name">{{ kb.name }}</span>
                <span class="ai-kb-count">({{ kb.docs.length }})</span>
              </label>
              <button
                type="button"
                class="ai-memory-item-del"
                @click.stop="knowledgeBase.deleteBase(kb.id)"
              >
                &times;
              </button>
            </summary>
            <div class="ai-kb-docs">
              <div v-for="doc in kb.docs" :key="doc.id" class="ai-kb-doc">
                <span class="ai-kb-doc-status" :class="'ai-kb-' + doc.status">
                  {{ doc.status === 'ready' ? '✓' : doc.status === 'error' ? '✗' : '…' }}
                </span>
                <span class="ai-kb-doc-name">{{ doc.name }}</span>
                <span class="ai-kb-doc-size">{{ (doc.size / 1024).toFixed(1) }}KB</span>
                <button
                  type="button"
                  class="ai-memory-item-del"
                  @click="knowledgeBase.removeDoc(kb.id, doc.id)"
                >
                  &times;
                </button>
              </div>
              <button type="button" class="ai-kb-upload-btn" @click="triggerKbUpload(kb.id)">
                + {{ t.kbUploadDoc || '上传文档' }}
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
  </Transition>

  <Transition name="ai-panel">
    <div
      v-if="pluginsOpen"
      class="ai-memory-overlay"
      @click.self="emit('update:pluginsOpen', false)"
    >
      <div class="ai-memory-panel">
        <div class="ai-memory-header">
          <span class="ai-memory-title">{{ t.pluginsLabel || '插件管理' }}</span>
          <button type="button" class="ai-memory-close" @click="emit('update:pluginsOpen', false)">
            &times;
          </button>
        </div>
        <div class="ai-memory-body">
          <div v-if="plugins.length === 0" class="ai-memory-empty">
            {{ t.pluginsEmpty || '暂无已注册插件' }}
          </div>
          <div v-for="pl in plugins" :key="pl.id" class="ai-memory-item">
            <span class="ai-memory-item-text">
              <strong>{{ pl.label }}</strong>
              <span style="opacity: 0.6; font-size: 11px; margin-left: 4px">
                [{{ pl.position }}]
              </span>
            </span>
            <button
              type="button"
              class="ai-memory-item-del"
              @click="emit('unregister-plugin', pl.id)"
            >
              &times;
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * AssistantInlineOverlays
 * ------------------------
 * Groups the three lightweight inline panels that all share the
 * `.ai-memory-overlay > .ai-memory-panel` visual template:
 *
 *  1. Cross-session memory (manual fact recording)
 *  2. Knowledge base (per-base doc upload)
 *  3. Plugin registry (host-registered plugins)
 *
 * K21 Phase 1 split-out from AiAssistant.vue:
 *   - Removes ~135 lines of repetitive inline template from the host file.
 *   - Owns its OWN private refs (memoryNewText / kbNewName / kbFileInputRef
 *     / kbUploadTargetId) so the parent's setup script shrinks too.
 *   - Open/close state stays in the parent (v-model) so the rest of the
 *     panel logic (Settings popover menu actions) doesn't have to be touched.
 *
 * Why we accept the broad-prop interface (passing whole composable refs):
 *   the composable objects (crossMemory / knowledgeBase) own their own state
 *   AND methods, so passing them through is a single ref read each. The
 *   alternative — provide/inject — would hide the wiring contract; this
 *   prop interface is explicit and type-checked.
 */
import { ref, type Ref } from 'vue';
import type { I18nMessages } from '../utils/i18n';
import type { useCrossSessionMemory } from '../composables/useCrossSessionMemory';
import type { useKnowledgeBase } from '../composables/useKnowledgeBase';
import type { AiPlugin } from '../composables/usePluginRegistry';

type CrossMemoryApi = ReturnType<typeof useCrossSessionMemory>;
type KnowledgeBaseApi = ReturnType<typeof useKnowledgeBase>;

const props = defineProps<{
  memoryOpen: boolean;
  kbOpen: boolean;
  pluginsOpen: boolean;
  crossMemory: CrossMemoryApi;
  knowledgeBase: KnowledgeBaseApi;
  plugins: AiPlugin[];
  t: I18nMessages;
}>();

const emit = defineEmits<{
  (e: 'update:memoryOpen', open: boolean): void;
  (e: 'update:kbOpen', open: boolean): void;
  (e: 'update:pluginsOpen', open: boolean): void;
  (e: 'unregister-plugin', id: string): void;
}>();

const memoryNewText = ref('');
const kbNewName = ref('');
const kbFileInputRef = ref<HTMLInputElement>() as Ref<HTMLInputElement | undefined>;
const kbUploadTargetId = ref('');

function addMemoryItem() {
  const txt = memoryNewText.value.trim();
  if (!txt) return;
  props.crossMemory.addItem(txt, 'manual');
  memoryNewText.value = '';
}

function createKb() {
  const name = kbNewName.value.trim();
  if (!name) return;
  props.knowledgeBase.createBase(name);
  kbNewName.value = '';
}

function triggerKbUpload(baseId: string) {
  kbUploadTargetId.value = baseId;
  kbFileInputRef.value?.click();
}

function onKbFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file && kbUploadTargetId.value) {
    props.knowledgeBase.addDoc(kbUploadTargetId.value, file);
  }
}
</script>
