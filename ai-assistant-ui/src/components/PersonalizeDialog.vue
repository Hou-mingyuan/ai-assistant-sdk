<template>
  <Teleport to="body">
    <Transition name="ai-modal">
      <div
        v-if="open"
        class="ai-personalize-overlay"
        :class="{ 'ai-dark': isDark }"
        role="presentation"
        @click.self="$emit('close')"
      >
        <div
          class="ai-personalize-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          @click.stop
        >
          <div class="ai-personalize-head">
            <h2 :id="titleId" class="ai-personalize-title">{{ t.personalizeTitle }}</h2>
            <button
              type="button"
              class="ai-personalize-close"
              :aria-label="t.closePanel"
              @click="$emit('close')"
            >
              &times;
            </button>
          </div>
          <p class="ai-personalize-desc">{{ t.systemPromptPlaceholder }}</p>
          <textarea
            ref="taRef"
            :value="modelValue"
            class="ai-personalize-textarea"
            rows="5"
            :disabled="disabled"
            :maxlength="maxChars"
            :placeholder="t.personalizePlaceholder"
            :aria-label="t.personalizeTitle"
            @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
          />
          <div class="ai-personalize-meta" aria-live="polite">
            {{
              t.personalizeCharCount
                .replace('{cur}', String(modelValue.length))
                .replace('{max}', String(maxChars))
            }}
          </div>
          <!-- K25: optional ColorThemeSwitcher row. Only rendered when the host
             actually passes a `theme` prop, so legacy hosts that don't wire it
             see no visual change. -->
          <div v-if="theme !== undefined" class="ai-personalize-theme-row">
            <span class="ai-personalize-theme-label">
              {{ t.personalizeThemeLabel || '主题色 / Theme' }}
            </span>
            <ColorThemeSwitcher
              :model-value="theme"
              @update:model-value="(v) => $emit('update:theme', v)"
            />
          </div>
          <!-- K37: optional AudioOutput segment - only rendered when the host
             wires the `audio` prop and the browser supports SpeechSynthesis.
             Voice picker / rate slider / auto-read toggle all stream their
             changes back via update:audio so the host can persist them. -->
          <div v-if="audio && audio.supported" class="ai-personalize-audio-section">
            <div class="ai-personalize-audio-head">
              <span class="ai-personalize-audio-label">
                {{ t.personalizeAudioLabel || 'Audio output' }}
              </span>
            </div>
            <div class="ai-personalize-audio-row">
              <label class="ai-personalize-audio-row-label" :for="voiceSelectId">
                {{ t.personalizeAudioVoice || 'Voice' }}
              </label>
              <select
                :id="voiceSelectId"
                class="ai-personalize-audio-voice"
                :value="audio.voice"
                @change="
                  emitAudio({
                    voice: ($event.target as HTMLSelectElement).value,
                  })
                "
              >
                <option value="">{{ t.personalizeAudioVoiceAuto || 'Auto (by language)' }}</option>
                <option v-for="v in audio.voices" :key="v.voiceURI" :value="v.voiceURI">
                  {{ v.name }} ({{ v.lang }})
                </option>
              </select>
            </div>
            <div class="ai-personalize-audio-row">
              <label class="ai-personalize-audio-row-label" :for="rateSliderId">
                {{ t.personalizeAudioRate || 'Speed' }}
              </label>
              <input
                :id="rateSliderId"
                type="range"
                class="ai-personalize-audio-rate"
                min="0.5"
                max="2"
                step="0.1"
                :value="audio.rate"
                @input="
                  emitAudio({
                    rate: parseFloat(($event.target as HTMLInputElement).value),
                  })
                "
              />
              <span class="ai-personalize-audio-rate-value">{{ audio.rate.toFixed(1) }}x</span>
            </div>
            <div class="ai-personalize-audio-row ai-personalize-audio-row-toggle">
              <label class="ai-personalize-audio-toggle">
                <input
                  type="checkbox"
                  :checked="audio.autoRead"
                  @change="
                    emitAudio({
                      autoRead: ($event.target as HTMLInputElement).checked,
                    })
                  "
                />
                <span>{{ t.personalizeAudioAutoRead || 'Auto-read assistant replies' }}</span>
              </label>
            </div>
          </div>
          <div v-if="providerConfigEnabled !== false" class="ai-personalize-model-section">
            <div class="ai-personalize-audio-head">
              <span class="ai-personalize-audio-label">
                {{ t.providerConfigTitle || 'Model provider connection' }}
              </span>
            </div>
            <div class="ai-personalize-model-presets">
              <button type="button" @click="applyProviderPreset('minimax')">
                {{ t.providerConfigPresetMinimax || 'MiniMax' }}
              </button>
              <button type="button" @click="applyProviderPreset('openai')">
                {{ t.providerConfigPresetOpenai || 'OpenAI' }}
              </button>
              <button type="button" @click="applyProviderPreset('deepseek')">
                {{ t.providerConfigPresetDeepseek || 'DeepSeek' }}
              </button>
              <button type="button" :disabled="disabled" @click="$emit('discoverProviderModels')">
                {{ t.providerConfigDetectModels || 'Detect models' }}
              </button>
            </div>
            <label class="ai-personalize-model-field">
              <span>{{ t.providerConfigProvider || 'Provider' }}</span>
              <input
                :value="providerInput"
                type="text"
                :placeholder="t.providerConfigProviderPlaceholder || 'minimax / openai / deepseek'"
                autocomplete="off"
                @input="$emit('update:providerInput', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="ai-personalize-model-field">
              <span>{{ t.providerConfigBaseUrl || 'Model API Base URL' }}</span>
              <input
                :value="providerBaseUrlInput"
                type="text"
                :placeholder="t.providerConfigBaseUrlPlaceholder || 'https://api.minimaxi.com/v1'"
                autocomplete="off"
                @input="
                  $emit('update:providerBaseUrlInput', ($event.target as HTMLInputElement).value)
                "
              />
            </label>
            <label class="ai-personalize-model-field">
              <span>{{ t.providerConfigApiKey || 'Model API key' }}</span>
              <input
                :value="providerApiKeyInput"
                type="password"
                :placeholder="
                  t.providerConfigApiKeyPlaceholder || 'Leave blank to keep current key'
                "
                autocomplete="off"
                @input="
                  $emit('update:providerApiKeyInput', ($event.target as HTMLInputElement).value)
                "
              />
            </label>
            <label class="ai-personalize-model-field">
              <span>{{ t.providerConfigDefaultModel || 'Default model' }}</span>
              <input
                :value="providerModelInput"
                type="text"
                :placeholder="t.providerConfigDefaultModelPlaceholder || 'MiniMax-M2.5'"
                autocomplete="off"
                @input="
                  $emit('update:providerModelInput', ($event.target as HTMLInputElement).value)
                "
              />
            </label>
            <label class="ai-personalize-model-field">
              <span>{{ t.providerConfigAllowedModels || 'Allowed models' }}</span>
              <input
                :value="providerAllowedModelsInput"
                type="text"
                :placeholder="
                  t.providerConfigAllowedModelsPlaceholder || 'MiniMax-M2.5, MiniMax-M2.7'
                "
                autocomplete="off"
                @input="
                  $emit(
                    'update:providerAllowedModelsInput',
                    ($event.target as HTMLInputElement).value,
                  )
                "
              />
            </label>
            <label class="ai-personalize-model-field ai-personalize-model-check">
              <input
                :checked="warmupEnabledInput"
                type="checkbox"
                @change="
                  $emit('update:warmupEnabledInput', ($event.target as HTMLInputElement).checked)
                "
              />
              <span>{{ t.providerConfigWarmup || 'Warm up default model after startup' }}</span>
            </label>
            <label class="ai-personalize-model-field">
              <span>Fast route max chars</span>
              <input
                :value="fastRouteMaxCharsInput"
                type="number"
                min="1"
                max="200"
                autocomplete="off"
                @input="
                  $emit('update:fastRouteMaxCharsInput', ($event.target as HTMLInputElement).value)
                "
              />
            </label>
            <label class="ai-personalize-model-field">
              <span>Slow TTFT ms</span>
              <input
                :value="slowTtftThresholdMsInput"
                type="number"
                min="100"
                autocomplete="off"
                @input="
                  $emit(
                    'update:slowTtftThresholdMsInput',
                    ($event.target as HTMLInputElement).value,
                  )
                "
              />
            </label>
            <label class="ai-personalize-model-field">
              <span>Slow total ms</span>
              <input
                :value="slowTotalThresholdMsInput"
                type="number"
                min="100"
                autocomplete="off"
                @input="
                  $emit(
                    'update:slowTotalThresholdMsInput',
                    ($event.target as HTMLInputElement).value,
                  )
                "
              />
            </label>
            <label class="ai-personalize-model-field">
              <span>Slow streak</span>
              <input
                :value="slowRequestWarningStreakInput"
                type="number"
                min="1"
                max="10"
                autocomplete="off"
                @input="
                  $emit(
                    'update:slowRequestWarningStreakInput',
                    ($event.target as HTMLInputElement).value,
                  )
                "
              />
            </label>
            <button
              type="button"
              class="ai-personalize-done"
              :disabled="disabled"
              @click="$emit('saveProviderConfig')"
            >
              {{ t.providerConfigSaveAndRefresh || 'Save model config and refresh list' }}
            </button>
          </div>
          <div v-else class="ai-personalize-model-section">
            <div class="ai-personalize-audio-head">
              <span class="ai-personalize-audio-label">
                {{ t.providerConfigTitle || 'Model provider connection' }}
              </span>
            </div>
            <p class="ai-personalize-permission" role="status">
              {{
                t.providerConfigPermissionRequired ||
                'Configure an admin or access token in the host application to manage providers.'
              }}
            </p>
          </div>
          <div v-if="providerConfigEnabled !== false" class="ai-personalize-model-section">
            <div class="ai-personalize-audio-head">
              <span class="ai-personalize-audio-label">
                {{ t.webSearchLabel || 'Web search' }}
              </span>
            </div>
            <label class="ai-personalize-model-field">
              <span>{{ t.providerConfigProvider || 'Provider' }}</span>
              <input
                :value="webSearchProviderInput"
                type="text"
                placeholder="duckduckgo / tavily"
                autocomplete="off"
                @input="
                  $emit('update:webSearchProviderInput', ($event.target as HTMLInputElement).value)
                "
              />
            </label>
            <label class="ai-personalize-model-field">
              <span>{{ t.providerConfigApiKey || 'API key' }}</span>
              <input
                :value="webSearchApiKeyInput"
                type="password"
                :placeholder="
                  t.providerConfigApiKeyPlaceholder || 'Leave blank to keep current key'
                "
                autocomplete="off"
                @input="
                  $emit('update:webSearchApiKeyInput', ($event.target as HTMLInputElement).value)
                "
              />
            </label>
            <label class="ai-personalize-model-field">
              <span>Max results</span>
              <input
                :value="webSearchMaxResultsInput"
                type="number"
                min="1"
                max="10"
                autocomplete="off"
                @input="
                  $emit(
                    'update:webSearchMaxResultsInput',
                    ($event.target as HTMLInputElement).value,
                  )
                "
              />
            </label>
            <label class="ai-personalize-model-field">
              <span>Allow domains</span>
              <input
                :value="webSearchAllowedDomainsInput"
                type="text"
                placeholder="docs.example.com, gov"
                autocomplete="off"
                @input="
                  $emit(
                    'update:webSearchAllowedDomainsInput',
                    ($event.target as HTMLInputElement).value,
                  )
                "
              />
            </label>
            <label class="ai-personalize-model-field">
              <span>Block domains</span>
              <input
                :value="webSearchBlockedDomainsInput"
                type="text"
                placeholder="spam.example.com"
                autocomplete="off"
                @input="
                  $emit(
                    'update:webSearchBlockedDomainsInput',
                    ($event.target as HTMLInputElement).value,
                  )
                "
              />
            </label>
            <button
              type="button"
              class="ai-personalize-done"
              :disabled="disabled"
              @click="$emit('saveProviderConfig')"
            >
              {{ t.providerConfigSaveAndRefresh || 'Save config and refresh' }}
            </button>
          </div>
          <div class="ai-personalize-actions">
            <button type="button" class="ai-personalize-done" @click="$emit('close')">
              {{ t.personalizeDone }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, defineAsyncComponent } from 'vue';
import type { I18nMessages } from '../utils/i18n';

/* K25: lazy-load ColorThemeSwitcher so the dialog stays slim when the host
 * doesn't wire it. */
const ColorThemeSwitcher = defineAsyncComponent(() => import('./ColorThemeSwitcher.vue'));

/**
 * K37: 给 PersonalizeDialog 通过 prop 传入的 audio 偏好快照 + voices 列表。
 * `supported=false` 或不传 audio 时整个 section 不渲染（legacy host 零影响）。
 */
export interface PersonalizeAudioPrefs {
  /** 来自 useTextToSpeech.supported.value */
  supported: boolean;
  /** 当前选中的 voiceURI（''= auto by language） */
  voice: string;
  /** 0.5 - 2.0 */
  rate: number;
  /** 自动朗读 assistant 回复 */
  autoRead: boolean;
  /** 来自 useTextToSpeech.voices.value（轻量 view-model） */
  voices: { voiceURI: string; name: string; lang: string }[];
}

const props = withDefaults(
  defineProps<{
    open: boolean;
    modelValue: string;
    isDark: boolean;
    disabled: boolean;
    maxChars: number;
    t: I18nMessages;
    /** K25: optional theme id (sky / sunset / forest / plum / graphite). */
    theme?: string;
    /** K37: optional audio preferences; section hidden if undefined or unsupported. */
    audio?: PersonalizeAudioPrefs;
    /** Runtime provider controls require a host-provided admin or fallback access token. */
    providerConfigEnabled?: boolean;
    providerInput?: string;
    providerBaseUrlInput?: string;
    providerApiKeyInput?: string;
    providerModelInput?: string;
    providerAllowedModelsInput?: string;
    warmupEnabledInput?: boolean;
    webSearchProviderInput?: string;
    webSearchApiKeyInput?: string;
    webSearchMaxResultsInput?: string;
    webSearchAllowedDomainsInput?: string;
    webSearchBlockedDomainsInput?: string;
    fastRouteMaxCharsInput?: string;
    slowTtftThresholdMsInput?: string;
    slowTotalThresholdMsInput?: string;
    slowRequestWarningStreakInput?: string;
  }>(),
  { providerConfigEnabled: true },
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update:modelValue', value: string): void;
  /** K25: emitted when user clicks a new theme swatch. */
  (e: 'update:theme', value: string): void;
  /** K37: partial audio prefs update; host merges into its full state. */
  (
    e: 'update:audio',
    value: Partial<Pick<PersonalizeAudioPrefs, 'voice' | 'rate' | 'autoRead'>>,
  ): void;
  (e: 'saveProviderConfig'): void;
  (e: 'discoverProviderModels'): void;
  (e: 'update:providerInput', value: string): void;
  (e: 'update:providerBaseUrlInput', value: string): void;
  (e: 'update:providerApiKeyInput', value: string): void;
  (e: 'update:providerModelInput', value: string): void;
  (e: 'update:providerAllowedModelsInput', value: string): void;
  (e: 'update:warmupEnabledInput', value: boolean): void;
  (e: 'update:webSearchProviderInput', value: string): void;
  (e: 'update:webSearchApiKeyInput', value: string): void;
  (e: 'update:webSearchMaxResultsInput', value: string): void;
  (e: 'update:webSearchAllowedDomainsInput', value: string): void;
  (e: 'update:webSearchBlockedDomainsInput', value: string): void;
  (e: 'update:fastRouteMaxCharsInput', value: string): void;
  (e: 'update:slowTtftThresholdMsInput', value: string): void;
  (e: 'update:slowTotalThresholdMsInput', value: string): void;
  (e: 'update:slowRequestWarningStreakInput', value: string): void;
}>();

function emitAudio(patch: Partial<Pick<PersonalizeAudioPrefs, 'voice' | 'rate' | 'autoRead'>>) {
  emit('update:audio', patch);
}

function applyProviderPreset(provider: 'minimax' | 'openai' | 'deepseek') {
  const presets = {
    minimax: {
      baseUrl: 'https://api.minimaxi.com/v1',
      model: 'MiniMax-M2.5',
      models: 'MiniMax-M2.5, MiniMax-M2.7, MiniMax-M2',
    },
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-5.4-mini',
      models: 'gpt-5.4-mini, gpt-5.4',
    },
    deepseek: {
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-flash',
      models: 'deepseek-v4-flash, deepseek-chat',
    },
  }[provider];
  emit('update:providerInput', provider);
  emit('update:providerBaseUrlInput', presets.baseUrl);
  emit('update:providerModelInput', presets.model);
  emit('update:providerAllowedModelsInput', presets.models);
}

const titleId = `ai-personalize-title-${Math.random().toString(36).slice(2, 8)}`;
const voiceSelectId = `ai-personalize-voice-${Math.random().toString(36).slice(2, 8)}`;
const rateSliderId = `ai-personalize-rate-${Math.random().toString(36).slice(2, 8)}`;
const taRef = ref<HTMLTextAreaElement>();

watch(
  () => props.open,
  (v) => {
    if (v) nextTick(() => taRef.value?.focus({ preventScroll: true }));
  },
);
</script>

<style scoped>
/* K25: theme-row styling matches the existing dialog typography spacing. */
.ai-personalize-theme-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding: 8px 0;
}

.ai-personalize-theme-label {
  font-size: 13px;
  color: #52525b;
  font-weight: 500;
  white-space: nowrap;
}

.ai-dark .ai-personalize-theme-label {
  color: #d4d4d8;
}

/* K37: AudioOutput section ------------------------------------------------ */
.ai-personalize-audio-section {
  margin-top: 14px;
  padding: 10px 12px 12px;
  border: 1px solid rgba(161, 161, 170, 0.25);
  border-radius: 10px;
  background: rgba(244, 244, 245, 0.45);
}

.ai-personalize-model-section {
  margin-top: 14px;
  padding: 10px 12px 12px;
  border: 1px solid rgba(161, 161, 170, 0.25);
  border-radius: 10px;
  background: rgba(244, 244, 245, 0.45);
}

.ai-dark .ai-personalize-model-section {
  border-color: rgba(82, 82, 91, 0.55);
  background: rgba(39, 39, 42, 0.45);
}

.ai-personalize-permission {
  margin: 0;
  color: #52525b;
  font-size: 12.5px;
  line-height: 1.6;
}

.ai-dark .ai-personalize-permission {
  color: #d4d4d8;
}

.ai-personalize-model-field {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  font-size: 12.5px;
  color: #52525b;
}

.ai-personalize-model-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0 4px;
}

.ai-personalize-model-presets button {
  border: 1px solid rgba(161, 161, 170, 0.35);
  border-radius: 999px;
  padding: 5px 10px;
  background: white;
  color: #3f3f46;
  cursor: pointer;
  font-size: 12px;
}

.ai-dark .ai-personalize-model-presets button {
  background: #27272a;
  color: #e4e4e7;
  border-color: rgba(82, 82, 91, 0.6);
}

.ai-personalize-model-field input {
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid rgba(161, 161, 170, 0.4);
  border-radius: 6px;
  color: #27272a;
  background: white;
}

.ai-dark .ai-personalize-model-field {
  color: #d4d4d8;
}

.ai-dark .ai-personalize-model-field input {
  background: #27272a;
  color: #e4e4e7;
  border-color: rgba(82, 82, 91, 0.6);
}

.ai-dark .ai-personalize-audio-section {
  border-color: rgba(82, 82, 91, 0.55);
  background: rgba(39, 39, 42, 0.45);
}

.ai-personalize-audio-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.ai-personalize-audio-label {
  font-size: 13px;
  font-weight: 600;
  color: #27272a;
  letter-spacing: 0.01em;
}

.ai-dark .ai-personalize-audio-label {
  color: #e4e4e7;
}

.ai-personalize-audio-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.ai-personalize-audio-row-label {
  width: 64px;
  font-size: 12.5px;
  color: #52525b;
  font-weight: 500;
  flex-shrink: 0;
}

.ai-dark .ai-personalize-audio-row-label {
  color: #d4d4d8;
}

.ai-personalize-audio-voice {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  font-size: 12.5px;
  border: 1px solid rgba(161, 161, 170, 0.4);
  border-radius: 6px;
  background: white;
  color: #27272a;
  outline: none;
}

.ai-personalize-audio-voice:focus-visible {
  border-color: var(--ai-color-primary, #171717);
  box-shadow: 0 0 0 2px var(--ai-color-primary-soft, rgba(17, 17, 17, 0.18));
}

.ai-dark .ai-personalize-audio-voice {
  background: #27272a;
  color: #e4e4e7;
  border-color: rgba(82, 82, 91, 0.6);
}

.ai-personalize-audio-rate {
  flex: 1;
  min-width: 0;
  accent-color: var(--ai-color-primary, #171717);
}

.ai-personalize-audio-rate-value {
  width: 36px;
  text-align: right;
  font-size: 12px;
  color: #52525b;
  font-variant-numeric: tabular-nums;
}

.ai-dark .ai-personalize-audio-rate-value {
  color: #d4d4d8;
}

.ai-personalize-audio-row-toggle {
  margin-top: 8px;
  justify-content: flex-start;
}

.ai-personalize-audio-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: #52525b;
  cursor: pointer;
  user-select: none;
}

.ai-personalize-audio-toggle input[type='checkbox'] {
  accent-color: var(--ai-color-primary, #171717);
  cursor: pointer;
}

.ai-dark .ai-personalize-audio-toggle {
  color: #d4d4d8;
}
</style>
