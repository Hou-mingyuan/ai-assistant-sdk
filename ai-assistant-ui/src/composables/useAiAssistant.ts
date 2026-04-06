import { ref, inject } from 'vue'
import type { AiAssistantOptions } from '../index'
import { postChat, streamChat, uploadFile as uploadFileApi } from '../utils/api'

export interface StreamOptions {
  action?: 'translate' | 'summarize' | 'chat'
  targetLang?: string
}

export function useAiAssistant() {
  const options = inject<AiAssistantOptions>('ai-assistant-options', { baseUrl: '/ai-assistant' })
  const loading = ref(false)
  const result = ref('')
  const error = ref('')

  async function translate(text: string, targetLang = 'zh') {
    if (loading.value) return
    loading.value = true
    error.value = ''
    result.value = ''
    try {
      const res = await postChat(options.baseUrl!, { action: 'translate', text, targetLang }, options.accessToken)
      if (res.success) result.value = res.result!
      else error.value = res.error || 'Translation failed'
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function summarize(text: string) {
    if (loading.value) return
    loading.value = true
    error.value = ''
    result.value = ''
    try {
      const res = await postChat(options.baseUrl!, { action: 'summarize', text }, options.accessToken)
      if (res.success) result.value = res.result!
      else error.value = res.error || 'Summarization failed'
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function chat(text: string) {
    if (loading.value) return
    loading.value = true
    error.value = ''
    result.value = ''
    try {
      const res = await postChat(options.baseUrl!, { action: 'chat', text }, options.accessToken)
      if (res.success) result.value = res.result!
      else error.value = res.error || 'Chat failed'
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function stream(text: string, opts: StreamOptions = {}) {
    const { action = 'chat', targetLang = 'zh' } = opts
    if (loading.value) return
    loading.value = true
    error.value = ''
    result.value = ''
    try {
      for await (const chunk of streamChat(options.baseUrl!, { action, text, targetLang }, options.accessToken)) {
        result.value += chunk
      }
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function upload(file: File, action: 'summarize' | 'translate' = 'summarize', targetLang = 'zh') {
    if (loading.value) return
    loading.value = true
    error.value = ''
    result.value = ''
    try {
      const res = await uploadFileApi(options.baseUrl!, file, action, targetLang, options.accessToken)
      if (res.success) result.value = res.result!
      else error.value = res.error || 'File processing failed'
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return { loading, result, error, translate, summarize, chat, stream, upload }
}
