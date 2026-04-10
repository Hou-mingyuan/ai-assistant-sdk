/** 宿主组件用的 composable：提供 translate/summarize/chat/stream/upload 快捷方法。 */
import { ref, inject, onUnmounted } from 'vue'
import type { AiAssistantOptions } from '../index'
import type { ChatPayload } from '../utils/api'
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
  let abortCtrl: AbortController | null = null

  async function callAction(payload: ChatPayload, fallbackError: string) {
    if (loading.value) return
    loading.value = true
    error.value = ''
    result.value = ''
    try {
      const res = await postChat(options.baseUrl!, payload, options.accessToken)
      if (res.success) result.value = res.result ?? ''
      else error.value = res.error || fallbackError
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  const translate = (text: string, targetLang = 'zh') =>
    callAction({ action: 'translate', text, targetLang }, 'Translation failed')

  const summarize = (text: string) =>
    callAction({ action: 'summarize', text }, 'Summarization failed')

  const chat = (text: string) =>
    callAction({ action: 'chat', text }, 'Chat failed')

  async function stream(text: string, opts: StreamOptions = {}) {
    const { action = 'chat', targetLang = 'zh' } = opts
    if (loading.value) return
    abortCtrl?.abort()
    abortCtrl = new AbortController()
    const signal = abortCtrl.signal
    loading.value = true
    error.value = ''
    result.value = ''
    try {
      for await (const chunk of streamChat(options.baseUrl!, { action, text, targetLang }, options.accessToken, signal)) {
        if (signal.aborted) break
        result.value += chunk
      }
    } catch (e: unknown) {
      if (!signal.aborted) {
        error.value = e instanceof Error ? e.message : String(e)
      }
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
      if (res.success) result.value = res.result ?? ''
      else error.value = res.error || 'File processing failed'
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  onUnmounted(() => {
    abortCtrl?.abort()
  })

  return { loading, result, error, translate, summarize, chat, stream, upload }
}
