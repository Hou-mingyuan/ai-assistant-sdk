import { ref } from 'vue'
import { postChat, type ChatPayload } from '../utils/api'

export interface WorkflowStep {
  action: 'translate' | 'summarize' | 'chat'
  prompt?: string
  targetLang?: string
  /** If true, uses the output of the previous step as input (default true) */
  chainPrevious?: boolean
}

export interface Workflow {
  id: string
  label: string
  steps: WorkflowStep[]
}

export interface WorkflowRunResult {
  stepResults: { step: WorkflowStep; output: string }[]
  finalOutput: string
}

export function useWorkflow(baseUrl: string, token?: string) {
  const running = ref(false)
  const currentStep = ref(-1)
  const totalSteps = ref(0)

  async function runWorkflow(
    workflow: Workflow,
    initialInput: string,
    onStepComplete?: (stepIdx: number, output: string) => void,
  ): Promise<WorkflowRunResult> {
    running.value = true
    currentStep.value = 0
    totalSteps.value = workflow.steps.length
    const stepResults: WorkflowRunResult['stepResults'] = []

    let prevOutput = initialInput

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        currentStep.value = i
        const step = workflow.steps[i]
        const inputText = step.chainPrevious !== false && i > 0 ? prevOutput : initialInput
        const fullPrompt = step.prompt
          ? step.prompt.replace('{{input}}', inputText)
          : inputText

        const payload: ChatPayload = {
          action: step.action,
          text: fullPrompt,
          targetLang: step.targetLang,
        }

        const res = await postChat(baseUrl, payload, token)
        const output = res.success ? res.result! : `Error: ${res.error}`
        stepResults.push({ step, output })
        prevOutput = output
        onStepComplete?.(i, output)
      }
    } finally {
      running.value = false
      currentStep.value = -1
    }

    return {
      stepResults,
      finalOutput: prevOutput,
    }
  }

  return { running, currentStep, totalSteps, runWorkflow }
}
