import { createApp, nextTick } from "vue";
import type { AiAssistantOptions } from "../../ai-assistant-ui/src/index";
import App from "./App.vue";

const app = createApp(App);
const assistantOptions: AiAssistantOptions = {
  baseUrl: import.meta.env.VITE_AI_ASSISTANT_BASE_URL || "/ai-assistant",
  accessToken: import.meta.env.VITE_AI_ASSISTANT_ACCESS_TOKEN || undefined,
  adminToken: import.meta.env.VITE_AI_ASSISTANT_ADMIN_TOKEN || undefined,
  primaryColor: "#181818",
  position: "bottom-right",
  locale: "zh",
  theme: "light",
  autoMountToBody: true,
  /** 只采集说明正文，不含同级的悬浮球 DOM；与 collectPageContextText 内去助手克隆逻辑叠加 */
  pageContextBlocks: [
    { selector: ".demo-assistant-page-context", label: "当前演示页" },
  ],
  smartPageContext: true,
  pageContextMinUserChars: 6,
  /* L1: form auto-fill — 粘贴键值对到助手输入框，自动填入页面表单 */
  formAutoFill: {
    autoDetectPaste: true,
    autoDetectMinPairs: 2,
    // 演示页里有「客户/客户姓名」之类，加几条业务别名让匹配更容易命中
    synonyms: {
      proj: ["项目", "项目名", "project"],
      contract: ["合同", "合同号", "合同编号"],
    },
    // Phase 2: 启用表格批量填入。页面用 `data-ai-fillable-row` 标记每行
    tableMode: true,
  },
  /* K32: re-dispatch K24 onReaction events as a global window event so the
   * App.vue reactionLog visualiser can pick them up without needing a
   * direct ref to the auto-mounted AiAssistant instance. */
  onReaction: (payload: {
    messageIndex: number;
    emoji: string;
    toggled: boolean;
  }) => {
    window.dispatchEvent(
      new CustomEvent("ai-assistant-reaction", { detail: payload }),
    );
  },
};

app.mount("#app");

let assistantShell: HTMLDivElement | undefined;
let assistantMountPromise: Promise<void> | undefined;
let openAssistantPanel: (() => void) | undefined;
let openAfterMount = false;

/** Keep the large widget bundle off the initial page path until the user opens it. */
async function mountAssistant(): Promise<void> {
  const { default: AiAssistant } =
    await import("../../ai-assistant-ui/src/components/AiAssistant.vue");
  const shell = document.createElement("div");
  shell.setAttribute("data-ai-assistant-auto-mount", "");
  document.body.appendChild(shell);

  const assistantApp = createApp(AiAssistant);
  assistantApp.provide("ai-assistant-options", assistantOptions);
  assistantApp.config.errorHandler = (error, _instance, info) => {
    console.error("[AI Assistant] Uncaught error:", error, info);
    assistantOptions.onAssistantError?.({
      source: "vue-error-boundary",
      message: String(error),
    });
  };
  const assistantInstance = assistantApp.mount(shell) as unknown as {
    isOpen: boolean;
  };
  assistantShell = shell;
  openAssistantPanel = () => {
    assistantInstance.isOpen = true;
  };
  window.dispatchEvent(new CustomEvent("ai-assistant-ready"));

  if (openAfterMount) {
    openAfterMount = false;
    await nextTick();
    openAssistantPanel();
  }

  window.addEventListener(
    "pagehide",
    () => {
      assistantApp.unmount();
      shell.remove();
    },
    { once: true },
  );
}

function onAssistantLoadRequest(event: Event): void {
  const detail = (event as CustomEvent<{ open?: boolean }>).detail;
  openAfterMount ||= detail?.open === true;

  if (assistantShell) {
    if (openAfterMount) {
      openAfterMount = false;
      openAssistantPanel?.();
    }
    return;
  }

  assistantMountPromise ??= mountAssistant().catch((error: unknown) => {
    assistantMountPromise = undefined;
    window.dispatchEvent(
      new CustomEvent("ai-assistant-load-error", {
        detail: { message: String(error) },
      }),
    );
    console.error("[AI Assistant] Failed to load widget:", error);
  });
}

window.addEventListener("ai-assistant-load", onAssistantLoadRequest);
