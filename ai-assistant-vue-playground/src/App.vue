<template>
  <div class="page">
    <nav class="page-nav" aria-label="playground navigation">
      <div class="page-nav-primary">
        <button
          type="button"
          :class="['page-nav-tab', { active: route === 'demo' }]"
          @click="setRoute('demo')"
        >
          <Bot :size="17" :stroke-width="1.8" aria-hidden="true" />
          <span class="page-nav-label page-nav-label-long"
            >AI Assistant Demo</span
          >
          <span class="page-nav-label page-nav-label-short">Assistant</span>
        </button>
        <button
          type="button"
          :class="['page-nav-tab', { active: route === 'admin' }]"
          @click="setRoute('admin')"
        >
          <Settings2 :size="17" :stroke-width="1.8" aria-hidden="true" />
          <span class="page-nav-label page-nav-label-long">Admin Console</span>
          <span class="page-nav-label page-nav-label-short">Admin</span>
        </button>
        <button
          type="button"
          :class="['page-nav-tab', { active: route === 'formfill' }]"
          @click="setRoute('formfill')"
        >
          <ClipboardCheck :size="17" :stroke-width="1.8" aria-hidden="true" />
          <span class="page-nav-label page-nav-label-long">Form Auto-Fill</span>
          <span class="page-nav-label page-nav-label-short">Auto-Fill</span>
        </button>
      </div>
      <div class="page-nav-tools">
        <ColorThemeSwitcher v-model="theme" class="page-nav-theme" />
        <button
          type="button"
          class="page-nav-cmdk"
          title="打开命令面板 (Ctrl+K / Command+K)"
          aria-label="打开命令面板"
          @click="cmd.toggle"
        >
          <Command :size="17" :stroke-width="1.8" aria-hidden="true" />
          <kbd>K</kbd>
        </button>
        <a
          class="page-nav-hint"
          href="https://github.com/Hou-mingyuan/ai-assistant-sdk"
          target="_blank"
          rel="noopener"
        >
          <GitFork :size="17" :stroke-width="1.8" aria-hidden="true" />
          <span>GitHub</span>
          <ExternalLink :size="13" :stroke-width="1.8" aria-hidden="true" />
        </a>
      </div>
    </nav>

    <main class="page-main">
      <article v-if="route === 'demo'" class="demo-assistant-page-context">
        <h1>AI Assistant 悬浮球演示</h1>
        <p>
          启动后端和当前
          Playground：<code>.\scripts\demo-standalone.ps1</code>。本地 dev：
          <code>cd ai-assistant-vue-playground && npm run dev</code>，请求经
          Vite 代理到 <code>/ai-assistant</code>。
        </p>
        <div class="stream-status-row">
          <div
            :class="[
              'stream-status',
              connectionOk
                ? 'is-ok'
                : connectionOk === false
                  ? 'is-warn'
                  : 'is-neutral',
            ]"
          >
            {{ connectionLabel || "点击刷新探测后端" }}
          </div>
          <button
            type="button"
            class="stream-refresh"
            :disabled="probing"
            @click="runSmokeChecks"
          >
            {{ probing ? "探测中…" : "运行零密钥 smoke" }}
          </button>
        </div>
        <ul
          class="smoke-checklist"
          aria-label="零密钥 smoke 检查清单"
          :aria-busy="probing"
        >
          <li v-if="!smokeChecks.length" class="smoke-check pending">
            <span class="smoke-icon" aria-hidden="true">…</span>
            <span class="smoke-name">{{
              probing ? "正在运行零密钥 smoke…" : "等待 smoke 检查"
            }}</span>
            <code class="smoke-endpoint">6 checks</code>
          </li>
          <li
            v-for="c in smokeChecks"
            :key="c.name"
            :class="['smoke-check', c.pass ? 'pass' : 'fail']"
          >
            <span class="smoke-icon">{{ c.pass ? "✓" : "✗" }}</span>
            <span class="smoke-name">{{ c.label }}</span>
            <code class="smoke-endpoint">{{ c.endpoint }}</code>
          </li>
        </ul>
        <div class="stream-phase-hint">
          <div class="stream-phase-title">SSE 流式体验路径</div>
          <div class="stream-phase-steps">
            <span :class="['stream-phase-chip', providerReady ? 'ready' : '']"
              >① 连接</span
            >
            <span :class="['stream-phase-chip', providerReady ? 'ready' : '']"
              >② Provider</span
            >
            <span class="stream-phase-chip">③ 发送</span>
            <span class="stream-phase-chip">④ 首字 TTFT</span>
            <span class="stream-phase-chip">⑤ 流式输出</span>
          </div>
          <p class="stream-phase-note">
            助手面板内消息列表会显示 <strong>首字延迟</strong> 与进度条；默认
            Demo Provider 可零密钥体验完整链路，配置真实 Provider
            后即可连接外部模型。
          </p>
        </div>
        <ol class="stream-steps">
          <li>点击右下角悬浮球，输入问题并发送</li>
          <li>观察消息区 <strong>SSE 流式</strong> 逐字输出与首字延迟</li>
          <li>
            Demo 回复带有明确标识，不会冒充真实 AI；真实 Provider 需在
            <code>.env</code> 中配置 Key
          </li>
        </ol>
        <p class="demo-hint">
          <strong>Admin Console</strong> 提供 7 个标签页，覆盖 15
          个管理端点；顶部命令按钮、主题色切换和助手交互均可直接体验。
        </p>
      </article>

      <AdminDemoPanel v-if="route === 'admin'" />

      <!-- L1: Form auto-fill demo page. Native HTML inputs only (no UI library)
         so we can verify parser/scanner/matcher/filler end-to-end without
         adding test-only deps. -->
      <section v-if="route === 'formfill'" class="formfill-page">
        <header class="formfill-header">
          <h1>表单自动填充 / Form Auto-Fill 演示</h1>
          <p>
            复制下面任一段「键:值」文本，到右下角助手输入框 <kbd>Ctrl</kbd>+<kbd
              >V</kbd
            >
            粘贴，<br />
            应自动弹出预览对话框；或者输入 <code>/fill</code> 走斜杠命令。<br />
            也可以直接 <code>/fill A:1 B:2</code> 这样把数据带在命令后面。
          </p>
          <div class="formfill-snippets">
            <button
              type="button"
              class="formfill-snippet"
              @click="copySample(sampleZh)"
            >
              <span class="formfill-snippet-title">
                <Copy :size="16" :stroke-width="1.8" aria-hidden="true" />
                复制中文示例
              </span>
              <pre>{{ sampleZh }}</pre>
            </button>
            <button
              type="button"
              class="formfill-snippet"
              @click="copySample(sampleEn)"
            >
              <span class="formfill-snippet-title">
                <Copy :size="16" :stroke-width="1.8" aria-hidden="true" />
                复制英文示例
              </span>
              <pre>{{ sampleEn }}</pre>
            </button>
            <button
              type="button"
              class="formfill-snippet"
              @click="copySample(sampleMixed)"
            >
              <span class="formfill-snippet-title">
                <Copy :size="16" :stroke-width="1.8" aria-hidden="true" />
                复制混排示例（Tab + ≥2 空格 + 引号）
              </span>
              <pre>{{ sampleMixed }}</pre>
            </button>
          </div>
          <p v-if="copyHint" class="formfill-copy-hint">{{ copyHint }}</p>
        </header>

        <form
          class="formfill-form"
          data-ai-fillable
          @submit.prevent="onFakeSubmit"
        >
          <div class="formfill-grid">
            <label class="formfill-row">
              <span>客户姓名 / Customer Name</span>
              <input
                v-model="form.customerName"
                name="customer_name"
                type="text"
              />
            </label>
            <label class="formfill-row">
              <span>电话 / Phone</span>
              <input
                v-model="form.phone"
                name="phone"
                type="tel"
                placeholder="13800000000"
              />
            </label>
            <label class="formfill-row">
              <span>邮箱 / Email</span>
              <input
                v-model="form.email"
                name="email"
                type="email"
                placeholder="a@b.com"
              />
            </label>
            <label class="formfill-row">
              <span>年龄 / Age</span>
              <input v-model.number="form.age" name="age" type="number" />
            </label>
            <label class="formfill-row">
              <span>出生日期 / Birthday</span>
              <input v-model="form.birthday" name="birthday" type="date" />
            </label>
            <label class="formfill-row">
              <span>项目名 / Project</span>
              <input v-model="form.project" name="project_name" type="text" />
            </label>
            <label class="formfill-row">
              <span>合同编号 / Contract No.</span>
              <input v-model="form.contractNo" name="contract_no" type="text" />
            </label>
            <label class="formfill-row">
              <span>金额 / Amount</span>
              <input
                v-model.number="form.amount"
                name="amount"
                type="number"
                step="0.01"
              />
            </label>
            <label class="formfill-row formfill-row-wide">
              <span>地址 / Address</span>
              <input v-model="form.address" name="address" type="text" />
            </label>
            <label class="formfill-row">
              <span>城市 / City</span>
              <select v-model="form.city" name="city">
                <option value="">-- 请选择 --</option>
                <option value="bj">北京</option>
                <option value="sh">上海</option>
                <option value="gz">广州</option>
                <option value="sz">深圳</option>
                <option value="cd">成都</option>
              </select>
            </label>
            <fieldset class="formfill-row formfill-fieldset">
              <legend>性别 / Gender</legend>
              <label class="formfill-radio">
                <input
                  v-model="form.gender"
                  type="radio"
                  name="gender"
                  value="m"
                />
                男 / Male
              </label>
              <label class="formfill-radio">
                <input
                  v-model="form.gender"
                  type="radio"
                  name="gender"
                  value="f"
                />
                女 / Female
              </label>
              <label class="formfill-radio">
                <input
                  v-model="form.gender"
                  type="radio"
                  name="gender"
                  value="o"
                />
                其他 / Other
              </label>
            </fieldset>
            <fieldset class="formfill-row formfill-fieldset">
              <legend>兴趣 / Hobbies</legend>
              <label class="formfill-radio">
                <input
                  v-model="form.hobbies"
                  type="checkbox"
                  name="hobbies"
                  value="reading"
                />
                阅读
              </label>
              <label class="formfill-radio">
                <input
                  v-model="form.hobbies"
                  type="checkbox"
                  name="hobbies"
                  value="sports"
                />
                运动
              </label>
              <label class="formfill-radio">
                <input
                  v-model="form.hobbies"
                  type="checkbox"
                  name="hobbies"
                  value="music"
                />
                音乐
              </label>
              <label class="formfill-radio">
                <input
                  v-model="form.hobbies"
                  type="checkbox"
                  name="hobbies"
                  value="travel"
                />
                旅行
              </label>
            </fieldset>
            <label class="formfill-row formfill-row-wide">
              <span>备注 / Remark</span>
              <textarea v-model="form.remark" name="remark" rows="3"></textarea>
            </label>
          </div>

          <div class="formfill-actions">
            <button
              type="button"
              class="formfill-btn-secondary"
              @click="resetForm"
            >
              清空 / Reset
            </button>
            <button type="submit" class="formfill-btn-primary">
              查看当前值 / Inspect
            </button>
          </div>

          <pre v-if="inspectJson" class="formfill-inspect">{{
            inspectJson
          }}</pre>
        </form>

        <aside class="formfill-control">
          <p class="formfill-control-title">不属于 [data-ai-fillable] 的字段</p>
          <p class="formfill-control-note">
            下面这两个输入框<strong>不在</strong>
            <code>&lt;form data-ai-fillable&gt;</code> 里。 应当被 scanner
            忽略，不出现在预览对话框里。
          </p>
          <label>
            全局搜索框（不应被填）
            <input type="text" placeholder="search..." />
          </label>
          <label>
            带 <code>data-ai-fill-ignore</code> 标记（即使在 fillable
            范围内也被排除）：
            <input type="text" data-ai-fill-ignore placeholder="ignored" />
          </label>
        </aside>

        <!-- Phase 2: 表格批量填入演示。表格容器仍用 [data-ai-fillable]，每一行
           额外加 [data-ai-fillable-row]，scanner 据此分组。 -->
        <h2 class="formfill-table-section-title">表格批量填入演示</h2>
        <p class="formfill-table-section-note">
          点下面的「复制 TSV 示例」按钮，到助手输入框
          <kbd>Ctrl</kbd>+<kbd>V</kbd>。<br />
          系统会自动识别为 3 行 × 3 列表格，按行依次填入下面的表格。
        </p>
        <button
          type="button"
          class="formfill-snippet formfill-snippet-table"
          @click="copySample(sampleTable)"
        >
          <span class="formfill-snippet-title">
            <Copy :size="16" :stroke-width="1.8" aria-hidden="true" />
            复制 TSV 示例
          </span>
          <pre>{{ sampleTable }}</pre>
        </button>
        <table class="formfill-rows-table" data-ai-fillable>
          <thead>
            <tr>
              <th>#</th>
              <th>客户姓名</th>
              <th>电话</th>
              <th>邮箱</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, idx) in tableRows"
              :key="idx"
              :data-ai-fillable-row="`customer-row-${idx}`"
            >
              <td>{{ idx + 1 }}</td>
              <td>
                <input v-model="row.name" name="customer_name" type="text" />
              </td>
              <td><input v-model="row.phone" name="phone" type="tel" /></td>
              <td><input v-model="row.email" name="email" type="email" /></td>
            </tr>
          </tbody>
        </table>
        <div class="formfill-actions">
          <button
            type="button"
            class="formfill-btn-secondary"
            @click="resetTable"
          >
            清空表格 / Reset
          </button>
          <button
            type="button"
            class="formfill-btn-secondary"
            @click="addTableRow"
          >
            + 新增行
          </button>
          <button
            type="button"
            class="formfill-btn-primary"
            @click="inspectTable"
          >
            查看表格当前值
          </button>
        </div>
        <pre v-if="tableInspectJson" class="formfill-inspect">{{
          tableInspectJson
        }}</pre>
      </section>
    </main>

    <button
      v-if="!assistantMounted && route !== 'admin'"
      type="button"
      class="assistant-loader-fab"
      :class="{
        'is-loading': assistantLoading,
        'has-error': assistantLoadError,
      }"
      :aria-label="
        assistantLoadError
          ? '加载助手失败，点击重试'
          : assistantLoading
            ? '正在加载 AI 助手'
            : '打开 AI 助手'
      "
      :aria-busy="assistantLoading"
      :disabled="assistantLoading"
      @click="requestAssistantOpen"
    >
      <LoaderCircle
        v-if="assistantLoading"
        :size="22"
        class="assistant-loader-spin"
        aria-hidden="true"
      />
      <TriangleAlert
        v-else-if="assistantLoadError"
        :size="22"
        aria-hidden="true"
      />
      <Sparkles v-else :size="22" aria-hidden="true" />
    </button>

    <CommandPalette
      v-if="cmd.open.value"
      v-model:open="cmd.open.value"
      :commands="cmd.commands.value"
    />

    <!-- K32: K24 onReaction visualisation. Stacks at the bottom-left when
         the user clicks a reaction emoji under an assistant message, so the
         developer can verify the event payload propagation end-to-end. -->
    <div v-if="reactionLog.length > 0" class="reaction-log">
      <div class="reaction-log-head">
        <span>👍 onReaction events</span>
        <button
          type="button"
          class="reaction-log-clear"
          @click="reactionLog = []"
        >
          clear
        </button>
      </div>
      <ul class="reaction-log-list">
        <li
          v-for="(entry, i) in reactionLog"
          :key="i"
          class="reaction-log-item"
        >
          <span class="reaction-log-emoji">{{ entry.emoji }}</span>
          <span class="reaction-log-meta">
            #{{ entry.messageIndex }}
            <span :class="['reaction-log-state', entry.toggled ? 'off' : 'on']">
              {{ entry.toggled ? "cleared" : "set" }}
            </span>
          </span>
          <time class="reaction-log-time">{{ entry.timeStr }}</time>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  defineAsyncComponent,
  ref,
  onMounted,
  onBeforeUnmount,
  watch,
} from "vue";
import {
  Bot,
  ClipboardCheck,
  Command,
  Copy,
  ExternalLink,
  GitFork,
  LoaderCircle,
  Settings2,
  Sparkles,
  TriangleAlert,
} from "@lucide/vue";
import ColorThemeSwitcher from "../../ai-assistant-ui/src/components/ColorThemeSwitcher.vue";
import { useCommandPalette } from "../../ai-assistant-ui/src/composables/useCommandPalette";

const AdminDemoPanel = defineAsyncComponent(
  () => import("./AdminDemoPanel.vue"),
);
const CommandPalette = defineAsyncComponent(
  () => import("../../ai-assistant-ui/src/components/CommandPalette.vue"),
);

const assistantMounted = ref(false);
const assistantLoading = ref(false);
const assistantLoadError = ref(false);

function requestAssistantOpen(): void {
  if (assistantLoading.value || assistantMounted.value) return;
  assistantLoading.value = true;
  assistantLoadError.value = false;
  window.dispatchEvent(
    new CustomEvent("ai-assistant-load", { detail: { open: true } }),
  );
}

function onAssistantReady(): void {
  assistantMounted.value = true;
  assistantLoading.value = false;
  assistantLoadError.value = false;
}

function onAssistantLoadError(): void {
  assistantLoading.value = false;
  assistantLoadError.value = true;
}

function onAssistantLoaderShortcut(event: KeyboardEvent): void {
  if (assistantMounted.value || event.repeat) return;
  if ((event.ctrlKey || event.metaKey) && event.key === "/") {
    event.preventDefault();
    requestAssistantOpen();
  }
}

onMounted(() => {
  window.addEventListener("ai-assistant-ready", onAssistantReady);
  window.addEventListener("ai-assistant-load-error", onAssistantLoadError);
  window.addEventListener("keydown", onAssistantLoaderShortcut);
});
onBeforeUnmount(() => {
  window.removeEventListener("ai-assistant-ready", onAssistantReady);
  window.removeEventListener("ai-assistant-load-error", onAssistantLoadError);
  window.removeEventListener("keydown", onAssistantLoaderShortcut);
});

/* K16 demo wiring: Color theme switcher controls the playground primary color
 * via CSS variable update; useCommandPalette registers two demo commands. */
const theme = ref<string>(localStorage.getItem("playground-theme") ?? "sky");
const themePalettes: Record<string, [string, string, string]> = {
  sky: ["#0ea5e9", "#06b6d4", "#3b82f6"],
  sunset: ["#f59e0b", "#f43f5e", "#a855f7"],
  forest: ["#10b981", "#14b8a6", "#06b6d4"],
  plum: ["#a855f7", "#ec4899", "#f43f5e"],
  graphite: ["#64748b", "#475569", "#334155"],
};

watch(
  theme,
  (v) => {
    localStorage.setItem("playground-theme", v);
    const [from, , to] = themePalettes[v] ?? themePalettes.sky!;
    document.documentElement.style.setProperty("--demo-primary-from", from);
    document.documentElement.style.setProperty("--demo-primary-to", to);
  },
  { immediate: true },
);

function eventOriginatesInAssistant(event: KeyboardEvent): boolean {
  return event
    .composedPath()
    .some(
      (target) =>
        target instanceof Element &&
        target.classList.contains("ai-assistant-wrapper"),
    );
}

const cmd = useCommandPalette({
  shortcut: "Ctrl+K",
  shouldHandleShortcut: (event) => !eventOriginatesInAssistant(event),
  commands: [
    {
      id: "nav-demo",
      label: "切换到 AI 助手 Demo",
      group: "导航",
      icon: "A",
      shortcut: "g d",
      action: () => setRoute("demo"),
    },
    {
      id: "nav-admin",
      label: "切换到 Admin Console",
      group: "导航",
      icon: "S",
      shortcut: "g a",
      action: () => setRoute("admin"),
    },
    {
      id: "nav-formfill",
      label: "切换到 Form Auto-Fill",
      group: "导航",
      icon: "F",
      shortcut: "g f",
      action: () => setRoute("formfill"),
    },
    {
      id: "theme-sky",
      label: "主题: Sky",
      group: "主题",
      icon: "○",
      action: () => {
        theme.value = "sky";
      },
    },
    {
      id: "theme-sunset",
      label: "主题: Sunset",
      group: "主题",
      icon: "○",
      action: () => {
        theme.value = "sunset";
      },
    },
    {
      id: "theme-forest",
      label: "主题: Forest",
      group: "主题",
      icon: "○",
      action: () => {
        theme.value = "forest";
      },
    },
    {
      id: "theme-plum",
      label: "主题: Plum",
      group: "主题",
      icon: "○",
      action: () => {
        theme.value = "plum";
      },
    },
    {
      id: "open-github",
      label: "打开 GitHub 仓库",
      group: "外链",
      icon: "↗",
      keywords: ["github", "repo"],
      action: () => {
        window.open(
          "https://github.com/Hou-mingyuan/ai-assistant-sdk",
          "_blank",
        );
      },
    },
    {
      id: "open-docs",
      label: "打开本地文档站",
      group: "外链",
      icon: "D",
      keywords: ["docs", "guide"],
      action: () => {
        window.open(
          "https://github.com/Hou-mingyuan/ai-assistant-sdk/blob/main/docs/guide/quick-start.md",
          "_blank",
          "noopener,noreferrer",
        );
      },
    },
  ],
});

type Route = "demo" | "admin" | "formfill";

const route = ref<Route>(resolveRoute());

watch(
  route,
  (next) => {
    if (typeof document !== "undefined") {
      document.body.dataset.playgroundRoute = next;
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (
    typeof document !== "undefined" &&
    document.body.dataset.playgroundRoute === route.value
  ) {
    delete document.body.dataset.playgroundRoute;
  }
});

function resolveRoute(): Route {
  if (typeof window === "undefined") return "demo";
  if (window.location.hash === "#/admin") return "admin";
  if (window.location.hash === "#/formfill") return "formfill";
  return "demo";
}

function setRoute(next: Route) {
  route.value = next;
  if (typeof window === "undefined") return;
  const targetHash =
    next === "admin" ? "#/admin" : next === "formfill" ? "#/formfill" : "";
  if (window.location.hash !== targetHash) {
    window.history.pushState(
      {},
      "",
      `${window.location.pathname}${targetHash}`,
    );
  }
}

/* L1: Form auto-fill demo state + sample snippets. */
interface DemoFormState {
  customerName: string;
  phone: string;
  email: string;
  age: number | string;
  birthday: string;
  project: string;
  contractNo: string;
  amount: number | string;
  address: string;
  city: string;
  gender: string;
  hobbies: string[];
  remark: string;
}

function freshForm(): DemoFormState {
  return {
    customerName: "",
    phone: "",
    email: "",
    age: "",
    birthday: "",
    project: "",
    contractNo: "",
    amount: "",
    address: "",
    city: "",
    gender: "",
    hobbies: [],
    remark: "",
  };
}

const form = ref<DemoFormState>(freshForm());
const inspectJson = ref("");
const copyHint = ref("");

const sampleZh = `客户姓名: 张三
电话: 13800000000
邮箱: zhangsan@example.com
年龄: 30
出生日期: 1994-05-16
项目: LNG 储罐二期
合同编号: HT-2024-0517
金额: 1234567.89
地址: 北京市朝阳区建国路 1 号
城市: 上海
性别: 男
兴趣: 阅读, 旅行
备注: 高优客户，按 24h SLA 跟进`;

const sampleEn = `Customer Name: Alice Smith
Phone: +1-555-0100
Email: alice@example.com
Age: 28
Birthday: 1996-08-12
Project: Houston Terminal
Contract No: HT-2024-9911
Amount: 99999.50
Address: 123 Main St
City: Shenzhen
Gender: Female
Hobbies: music, sports
Remark: VIP — direct dial`;

const sampleMixed = `名字\t李四
手机   13900000000
"备注": "购买 3 件, 含运费"
city = guangzhou
gender = male
hobbies = reading;music`;

function copySample(text: string) {
  void navigator.clipboard
    .writeText(text)
    .then(() => {
      copyHint.value = `✓ 已复制 ${text.split("\n").length} 行 — 切到右下角助手输入框 Ctrl+V 粘贴`;
      setTimeout(() => (copyHint.value = ""), 4000);
    })
    .catch(() => {
      copyHint.value = "⚠️ 浏览器拒绝了 clipboard 写入，请手动选中下面文本复制";
      setTimeout(() => (copyHint.value = ""), 5000);
    });
}

function resetForm() {
  form.value = freshForm();
  inspectJson.value = "";
}

function onFakeSubmit() {
  inspectJson.value = JSON.stringify(form.value, null, 2);
}

/* Phase 2: 表格批量填入 demo 状态。tableRows 是响应式数组，每个 row 由
 * Vue 渲染成一个 `<tr data-ai-fillable-row>`，scanner 自动识别为一行。 */
interface TableRow {
  name: string;
  phone: string;
  email: string;
}

const tableRows = ref<TableRow[]>([
  { name: "", phone: "", email: "" },
  { name: "", phone: "", email: "" },
  { name: "", phone: "", email: "" },
]);
const tableInspectJson = ref("");

const sampleTable = `客户姓名\t电话\t邮箱
张三\t13800000000\tzhangsan@example.com
李四\t13900000000\tlisi@example.com
王五\t13700000000\twangwu@example.com`;

function resetTable() {
  tableRows.value = tableRows.value.map(() => ({
    name: "",
    phone: "",
    email: "",
  }));
  tableInspectJson.value = "";
}

function addTableRow() {
  tableRows.value = [...tableRows.value, { name: "", phone: "", email: "" }];
}

function inspectTable() {
  tableInspectJson.value = JSON.stringify(tableRows.value, null, 2);
}

function onPopState() {
  route.value = resolveRoute();
}

onMounted(() => window.addEventListener("popstate", onPopState));
onBeforeUnmount(() => window.removeEventListener("popstate", onPopState));

/* K32: K24 onReaction visualisation
 * ----------------------------------
 * The AiAssistant widget is mounted into document.body by main.ts after the
 * user activates the lightweight loader button. Reaction events are forwarded
 * through `ai-assistant-reaction`, so this page remains independent of the
 * lazily mounted component instance.
 *
 * The log displays the latest 8 events with timestamp + state so the
 * developer can verify the K24 event-propagation contract end-to-end.
 */
interface ReactionEntry {
  messageIndex: number;
  emoji: string;
  toggled: boolean;
  timeStr: string;
}
const reactionLog = ref<ReactionEntry[]>([]);

const connectionOk = ref<boolean | null>(null);
const connectionLabel = ref("");
const probing = ref(false);
const providerReady = ref(false);

interface SmokeCheckRow {
  name: string;
  label: string;
  endpoint: string;
  pass: boolean;
}

const smokeChecks = ref<SmokeCheckRow[]>([]);

async function runSmokeChecks() {
  if (probing.value) return;
  probing.value = true;
  smokeChecks.value = [];
  const base = (
    import.meta.env.VITE_AI_ASSISTANT_BASE_URL || "/ai-assistant"
  ).replace(/\/+$/, "");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const serviceOrigin = base.startsWith("http") ? new URL(base).origin : origin;

  const checks: Array<{
    name: string;
    label: string;
    endpoint: string;
    run: () => Promise<boolean>;
  }> = [
    {
      name: "assistant health",
      label: "Assistant health",
      endpoint: "GET /health",
      run: async () => {
        const r = await fetch(`${base}/health`);
        if (!r.ok) return false;
        const body = await r.json();
        return body?.success === true && body?.status === "running";
      },
    },
    {
      name: "actuator liveness",
      label: "Actuator liveness",
      endpoint: "GET /actuator/health/liveness",
      run: async () => {
        const r = await fetch(`${serviceOrigin}/actuator/health/liveness`);
        if (!r.ok) return false;
        const body = await r.json();
        return body?.status === "UP";
      },
    },
    {
      name: "stats",
      label: "Stats (no auth)",
      endpoint: "GET /stats",
      run: async () => {
        const r = await fetch(`${base}/stats`);
        if (!r.ok) return false;
        const body = await r.json();
        return body && typeof body === "object";
      },
    },
    {
      name: "runtime config",
      label: "Runtime config",
      endpoint: "GET /runtime/config",
      run: async () => {
        const r = await fetch(`${base}/runtime/config`);
        if (!r.ok) return false;
        const body = await r.json();
        return (
          body?.success === true &&
          body.service &&
          body.security &&
          body.features &&
          body.limits &&
          typeof body.service.contextPath === "string" &&
          typeof body.security.accessTokenConfigured === "boolean"
        );
      },
    },
    {
      name: "provider health",
      label: "Demo provider",
      endpoint: "GET /health/provider",
      run: async () => {
        const r = await fetch(`${base}/health/provider`);
        if (!r.ok) return false;
        const body = await r.json();
        providerReady.value = body?.status === "UP";
        return (
          body?.status === "UP" &&
          body?.provider === "demo" &&
          body?.mode === "demo" &&
          body?.mock === true
        );
      },
    },
    {
      name: "chat routing",
      label: "Demo chat pipeline",
      endpoint: "POST /chat",
      run: async () => {
        const r = await fetch(`${base}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "ping", action: "chat" }),
        });
        if (!r.ok) return false;
        const body = await r.json();
        return (
          body?.success === true &&
          typeof body?.result === "string" &&
          body.result.includes(
            "[DEMO MODE - deterministic local response, not real AI]",
          ) &&
          body?.meta?.provider === "demo"
        );
      },
    },
  ];

  try {
    const rows: SmokeCheckRow[] = [];
    let allPass = true;
    for (const check of checks) {
      let pass = false;
      try {
        pass = await check.run();
      } catch {
        pass = false;
      }
      if (!pass) allPass = false;
      rows.push({
        name: check.name,
        label: check.label,
        endpoint: check.endpoint,
        pass,
      });
    }
    smokeChecks.value = rows;
    connectionOk.value = allPass;
    connectionLabel.value = allPass
      ? "✓ 零密钥 smoke 全通过 · Demo Provider UP · 可体验完整 SSE 流式对话"
      : `⚠ smoke ${rows.filter((r) => r.pass).length}/${rows.length} 通过 — 见下方清单`;
  } catch {
    connectionOk.value = false;
    providerReady.value = false;
    connectionLabel.value =
      "⚠ 无法连接 /ai-assistant — 请先运行 .\\scripts\\demo-standalone.ps1";
  } finally {
    probing.value = false;
  }
}

function onAssistantReactionEvent(ev: Event) {
  const detail = (
    ev as CustomEvent<{ messageIndex: number; emoji: string; toggled: boolean }>
  ).detail;
  if (!detail || typeof detail.messageIndex !== "number") return;
  const time = new Date();
  const timeStr = `${String(time.getHours()).padStart(2, "0")}:${String(
    time.getMinutes(),
  ).padStart(2, "0")}:${String(time.getSeconds()).padStart(2, "0")}`;
  reactionLog.value = [{ ...detail, timeStr }, ...reactionLog.value].slice(
    0,
    8,
  );
}

onMounted(() =>
  window.addEventListener("ai-assistant-reaction", onAssistantReactionEvent),
);
onBeforeUnmount(() =>
  window.removeEventListener("ai-assistant-reaction", onAssistantReactionEvent),
);
</script>

<style scoped>
:global(html),
:global(body),
:global(#app) {
  width: 100%;
  min-width: 0;
  margin: 0;
}

:global(body) {
  overflow-x: hidden;
  background: #f8fafc;
}

.page {
  box-sizing: border-box;
  width: 100%;
  padding: 1.5rem 2rem;
  max-width: 880px;
  margin: 0 auto;
  font-family: system-ui, sans-serif;
  line-height: 1.6;
  color: #1e293b;
}

.page-main {
  min-width: 0;
}

.assistant-loader-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2147483000;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: 56px;
  height: 56px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  box-shadow:
    0 12px 28px rgba(79, 70, 229, 0.32),
    0 2px 8px rgba(15, 23, 42, 0.18);
  font:
    700 1.35rem/1 system-ui,
    sans-serif;
  cursor: pointer;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease;
}

.assistant-loader-fab:hover {
  transform: translateY(-2px);
  box-shadow:
    0 16px 34px rgba(79, 70, 229, 0.38),
    0 3px 10px rgba(15, 23, 42, 0.2);
}

.assistant-loader-fab:focus-visible {
  outline: 3px solid rgba(14, 165, 233, 0.5);
  outline-offset: 3px;
}

.assistant-loader-fab:disabled {
  cursor: wait;
  opacity: 0.82;
}

.assistant-loader-fab.has-error {
  background: linear-gradient(135deg, #dc2626, #f97316);
}

@media (prefers-reduced-motion: reduce) {
  .assistant-loader-fab {
    transition: none;
  }
}

.page-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 1.5rem;
  padding: 8px;
  border-radius: 12px;
  background: linear-gradient(
    135deg,
    rgba(14, 165, 233, 0.08),
    rgba(6, 182, 212, 0.04)
  );
  border: 1px solid #e2e8f0;
}

.page-nav-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 0.88rem;
  font-weight: 500;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: #475569;
  cursor: pointer;
  transition: all 0.18s ease;
}

.page-nav-tab:hover {
  background: rgba(255, 255, 255, 0.6);
  color: #0ea5e9;
}

.page-nav-tab.active {
  background: linear-gradient(135deg, #0ea5e9, #06b6d4);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 2px 8px -2px rgba(14, 165, 233, 0.5);
}

.page-nav-emoji {
  font-size: 1.1rem;
}

.page-nav-spacer {
  flex: 1;
}

.page-nav-theme {
  margin-right: 8px;
}

.page-nav-cmdk {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 0.78rem;
  font-weight: 500;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.06);
  border: 1px solid rgba(15, 23, 42, 0.12);
  color: #334155;
  cursor: pointer;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  transition: all 0.15s ease;
}

.page-nav-cmdk:hover {
  background: rgba(14, 165, 233, 0.1);
  border-color: rgba(14, 165, 233, 0.32);
  color: #0ea5e9;
}

.page-nav-hint {
  font-size: 0.8rem;
  color: #64748b;
  text-decoration: none;
  padding: 4px 10px;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.page-nav-hint:hover {
  background: rgba(14, 165, 233, 0.08);
  color: #0ea5e9;
}

.demo-assistant-page-context {
  padding: 1.25rem 1.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
}

.demo-assistant-page-context h1 {
  margin: 0 0 0.5rem;
  font-size: 1.4rem;
  background: linear-gradient(
    135deg,
    var(--demo-primary-from, #0ea5e9),
    var(--demo-primary-to, #06b6d4)
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.demo-hint kbd {
  display: inline-block;
  padding: 1px 6px;
  margin: 0 2px;
  background: rgba(15, 23, 42, 0.06);
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 4px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.75em;
  font-weight: 500;
}

.demo-hint {
  margin: 0.75rem 0 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(14, 165, 233, 0.08);
  font-size: 0.86rem;
  color: #0c4a6e;
}

.stream-status-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  margin: 0.75rem 0;
}

.stream-status {
  flex: 1 1 240px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.86rem;
  font-weight: 500;
}

.stream-refresh {
  padding: 6px 12px;
  font-size: 0.82rem;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
  cursor: pointer;
}

.stream-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.stream-status.is-ok {
  background: rgba(22, 163, 74, 0.1);
  color: #166534;
  border: 1px solid rgba(22, 163, 74, 0.25);
}

.stream-status.is-warn {
  background: rgba(245, 158, 11, 0.12);
  color: #92400e;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.stream-status.is-neutral {
  background: rgba(148, 163, 184, 0.12);
  color: #475569;
  border: 1px solid rgba(148, 163, 184, 0.25);
}

.smoke-checklist {
  list-style: none;
  margin: 0 0 0.75rem;
  padding: 0;
  display: grid;
  gap: 6px;
}

.smoke-check {
  display: grid;
  grid-template-columns: 24px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 0.82rem;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}

.smoke-check.pass {
  border-color: rgba(22, 163, 74, 0.25);
  background: rgba(22, 163, 74, 0.06);
}

.smoke-check.fail {
  border-color: rgba(239, 68, 68, 0.25);
  background: rgba(239, 68, 68, 0.06);
}

.smoke-check.pending {
  align-self: start;
  color: #475569;
}

.smoke-icon {
  font-weight: 700;
  text-align: center;
}

.smoke-check.pass .smoke-icon {
  color: #16a34a;
}
.smoke-check.fail .smoke-icon {
  color: #dc2626;
}

.smoke-endpoint {
  font-size: 0.72rem;
  color: #475569;
  overflow-wrap: anywhere;
}

.stream-phase-hint {
  margin: 0.75rem 0 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: linear-gradient(
    135deg,
    rgba(14, 165, 233, 0.06),
    rgba(6, 182, 212, 0.04)
  );
  border: 1px solid rgba(14, 165, 233, 0.15);
}

.stream-phase-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: #0c4a6e;
  margin-bottom: 8px;
}

.stream-phase-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.stream-phase-chip {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: #fff;
  border: 1px solid #cbd5e1;
  color: #64748b;
}

.stream-phase-chip.ready {
  background: rgba(22, 163, 74, 0.12);
  border-color: rgba(22, 163, 74, 0.3);
  color: #166534;
}

.stream-phase-note {
  margin: 0;
  font-size: 0.8rem;
  color: #475569;
}

.stream-steps {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
  font-size: 0.88rem;
  color: #334155;
}

.stream-steps li {
  margin-bottom: 0.35rem;
}

code {
  background: #f1f5f9;
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: ui-monospace, Menlo, Consolas, monospace;
}

/* K32: K24 onReaction event visualiser — stacks at the bottom-left so it
 * never overlaps with the AI assistant fab at bottom-right. */
.reaction-log {
  position: fixed;
  bottom: 16px;
  left: 16px;
  width: 260px;
  z-index: 9999;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(14, 165, 233, 0.18);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(15, 23, 42, 0.14);
  font-size: 12px;
  overflow: hidden;
  animation: reactionLogIn 200ms cubic-bezier(0.2, 0.9, 0.3, 1);
}

@keyframes reactionLogIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.reaction-log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: linear-gradient(
    135deg,
    rgba(14, 165, 233, 0.08),
    rgba(59, 130, 246, 0.05)
  );
  font-weight: 600;
  color: #0369a1;
}

.reaction-log-clear {
  border: none;
  background: transparent;
  font-size: 11px;
  color: #64748b;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.15s;
}

.reaction-log-clear:hover {
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
}

.reaction-log-list {
  list-style: none;
  margin: 0;
  padding: 6px 8px 8px;
  max-height: 220px;
  overflow-y: auto;
}

.reaction-log-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
  transition: background 0.15s;
}

.reaction-log-item:hover {
  background: rgba(15, 23, 42, 0.04);
}

.reaction-log-emoji {
  font-size: 16px;
  line-height: 1;
}

.reaction-log-meta {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #475569;
}

.reaction-log-state.on {
  color: #16a34a;
  font-weight: 500;
}

.reaction-log-state.off {
  color: #dc2626;
  font-weight: 500;
}

.reaction-log-time {
  color: #94a3b8;
  font-size: 10px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
}

/* L1: Form auto-fill demo */
.formfill-page {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
.formfill-header {
  padding: 18px 20px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
}
.formfill-header h1 {
  margin: 0 0 8px;
  font-size: 1.35rem;
  text-wrap: balance;
  background: linear-gradient(
    135deg,
    var(--demo-primary-from, #0ea5e9),
    var(--demo-primary-to, #06b6d4)
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.formfill-header p {
  margin: 0 0 12px;
  font-size: 0.9rem;
  color: #475569;
}
.formfill-header kbd {
  display: inline-block;
  padding: 1px 6px;
  margin: 0 2px;
  background: rgba(15, 23, 42, 0.06);
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 4px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.75em;
  font-weight: 500;
}
.formfill-snippets {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
  margin-top: 8px;
}
.formfill-snippet {
  text-align: left;
  background: rgba(14, 165, 233, 0.04);
  border: 1px dashed rgba(14, 165, 233, 0.32);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
  color: #0c4a6e;
  cursor: pointer;
  font-family: inherit;
}
.formfill-snippet:hover {
  background: rgba(14, 165, 233, 0.08);
  border-color: #0ea5e9;
}
.formfill-snippet pre {
  margin: 6px 0 0;
  padding: 0;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.4;
  white-space: pre-wrap;
  color: #1e293b;
  background: transparent;
  border: 0;
}
.formfill-copy-hint {
  margin: 10px 0 0 !important;
  font-size: 12px !important;
  color: #15803d !important;
}
.formfill-form {
  padding: 20px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
}
.formfill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px 18px;
}
.formfill-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #475569;
}
.formfill-row-wide {
  grid-column: 1 / -1;
}
.formfill-row > input,
.formfill-row > select,
.formfill-row > textarea {
  padding: 7px 9px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  color: #0f172a;
  background: #fff;
}
.formfill-row > input:focus,
.formfill-row > select:focus,
.formfill-row > textarea:focus {
  outline: 2px solid rgba(14, 165, 233, 0.35);
  outline-offset: 1px;
  border-color: #0ea5e9;
}
.formfill-fieldset {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
}
.formfill-fieldset legend {
  font-size: 11px;
  color: #64748b;
  padding: 0 4px;
}
.formfill-radio {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #1e293b;
}
.formfill-actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.formfill-btn-secondary,
.formfill-btn-primary {
  padding: 7px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  border: 1px solid transparent;
}
.formfill-btn-secondary {
  background: transparent;
  border-color: #cbd5e1;
  color: #334155;
}
.formfill-btn-secondary:hover {
  background: rgba(15, 23, 42, 0.04);
}
.formfill-btn-primary {
  background: linear-gradient(135deg, #0ea5e9, #06b6d4);
  color: #fff;
}
.formfill-btn-primary:hover {
  box-shadow: 0 6px 14px -4px rgba(14, 165, 233, 0.4);
}
.formfill-inspect {
  margin: 16px 0 0;
  padding: 12px 14px;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 8px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12px;
  overflow: auto;
  max-height: 280px;
}
.formfill-control {
  padding: 14px 18px;
  border: 1px dashed #fcd34d;
  background: rgba(252, 211, 77, 0.08);
  border-radius: 10px;
}
.formfill-control-title {
  margin: 0 0 4px;
  font-weight: 600;
  color: #b45309;
}
.formfill-control-note {
  margin: 0 0 10px;
  font-size: 12px;
  color: #92400e;
}
.formfill-control label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #92400e;
  margin-bottom: 8px;
}
.formfill-control input {
  padding: 6px 8px;
  border: 1px solid #fde68a;
  border-radius: 6px;
  font-size: 13px;
}

/* Phase 2 table demo */
.formfill-table-section-title {
  margin-top: 32px;
  font-size: 1.1rem;
  color: #4338ca;
}
.formfill-table-section-note {
  margin: 4px 0 12px;
  font-size: 13px;
  color: #475569;
}
.formfill-snippet-table {
  display: block;
  margin-bottom: 16px;
}
.formfill-rows-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  font-size: 13px;
}
.formfill-rows-table th {
  background: rgba(99, 102, 241, 0.06);
  text-align: left;
  padding: 8px 10px;
  font-weight: 500;
  color: #4338ca;
  border-bottom: 1px solid #e2e8f0;
}
.formfill-rows-table td {
  padding: 6px 10px;
  border-bottom: 1px solid #f1f5f9;
}
.formfill-rows-table td input {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
}
.formfill-rows-table td input:focus {
  outline: 2px solid rgba(99, 102, 241, 0.35);
  outline-offset: 1px;
  border-color: #6366f1;
}

@media (max-width: 700px) {
  .page {
    padding: 12px;
  }

  .page-nav {
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }

  .page-nav-tab {
    flex: 1 1 calc(33.333% - 4px);
    min-width: 0;
    min-height: 44px;
    justify-content: center;
    padding: 7px 6px;
    line-height: 1.25;
    text-align: center;
  }

  .page-nav-spacer {
    display: none;
  }

  .page-nav-theme {
    margin: 0;
  }

  .page-nav-theme :deep(.ai-theme-switcher) {
    gap: 4px;
  }

  .page-nav-theme :deep(.ai-theme-swatch) {
    width: 32px;
    height: 32px;
  }

  .page-nav-hint,
  .page-nav-cmdk {
    min-height: 40px;
  }

  .page-nav-hint {
    display: inline-flex;
    align-items: center;
    margin-left: auto;
  }

  .demo-assistant-page-context,
  .formfill-header,
  .formfill-form {
    padding: 16px;
  }

  .demo-assistant-page-context h1,
  .formfill-header h1 {
    font-size: 1.2rem;
  }

  .smoke-check {
    grid-template-columns: 24px minmax(0, 1fr);
    min-height: 44px;
  }

  .stream-status-row {
    min-height: 110px;
  }

  .smoke-endpoint {
    grid-column: 2;
    justify-self: start;
  }

  .stream-refresh {
    min-height: 40px;
  }

  .formfill-snippets,
  .formfill-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .formfill-actions {
    flex-wrap: wrap;
  }

  .formfill-btn-secondary,
  .formfill-btn-primary {
    min-height: 44px;
  }

  .formfill-rows-table {
    display: block;
    overflow-x: auto;
  }
}

/* v1 release workbench: neutral, dense and optimized for repeated developer use. */
:global(body) {
  color: #202938;
  background: #f4f6f8;
  font-family: "Aptos", "Segoe UI Variable", "Microsoft YaHei UI", sans-serif;
}

.page {
  max-width: 1280px;
  padding: 0 32px 120px;
  color: #202938;
  font-family: "Aptos", "Segoe UI Variable", "Microsoft YaHei UI", sans-serif;
  line-height: 1.55;
}

.page-nav {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin: 0 -8px 32px;
  padding: 12px 8px;
  border: 0;
  border-bottom: 1px solid #d9dee7;
  border-radius: 0;
  background: rgba(244, 246, 248, 0.96);
  box-shadow: none;
  backdrop-filter: blur(12px);
}

.page-nav-primary,
.page-nav-tools {
  display: flex;
  align-items: center;
  min-width: 0;
}

.page-nav-primary {
  flex: 1 1 520px;
  gap: 4px;
}

.page-nav-tools {
  flex: 0 1 auto;
  justify-content: flex-end;
  gap: 8px;
}

.page-nav-tab {
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: #4b5565;
  font-size: 0.84rem;
  font-weight: 600;
  letter-spacing: 0;
  white-space: nowrap;
  transition:
    color 140ms ease,
    background 140ms ease,
    border-color 140ms ease;
}

.page-nav-tab:hover {
  color: #111827;
  border-color: #d5dae3;
  background: #ffffff;
}

.page-nav-tab.active {
  color: #ffffff;
  border-color: #1f2937;
  background: #1f2937;
  box-shadow: none;
}

.page-nav-tab svg,
.page-nav-hint svg,
.page-nav-cmdk svg,
.formfill-snippet-title svg {
  flex: 0 0 auto;
}

.page-nav-label-short {
  display: none;
}

.page-nav-theme {
  margin: 0;
}

.page-nav-theme :deep(.ai-theme-switcher) {
  gap: 6px;
}

.page-nav-theme :deep(.ai-theme-swatch) {
  box-sizing: border-box;
  width: 44px;
  height: 44px;
  border-radius: 6px;
}

.page-nav-cmdk,
.page-nav-hint {
  box-sizing: border-box;
  min-height: 44px;
  border: 1px solid #d1d7e0;
  border-radius: 6px;
  color: #374151;
  background: #ffffff;
  transition:
    color 140ms ease,
    border-color 140ms ease,
    background 140ms ease;
}

.page-nav-cmdk {
  justify-content: center;
  min-width: 52px;
  padding: 0 10px;
  font-family: "Cascadia Code", Consolas, monospace;
}

.page-nav-cmdk kbd {
  border: 0;
  color: inherit;
  background: transparent;
  font: inherit;
}

.page-nav-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

.page-nav-cmdk:hover,
.page-nav-hint:hover {
  color: #1d4ed8;
  border-color: #93a4bd;
  background: #f8fafc;
}

.demo-assistant-page-context {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.65fr);
  gap: 18px 36px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.demo-assistant-page-context h1,
.formfill-header h1 {
  color: #111827;
  background: none;
  font-size: 1.7rem;
  font-weight: 700;
  letter-spacing: 0;
}

.demo-assistant-page-context h1,
.demo-assistant-page-context > p:first-of-type {
  grid-column: 1 / -1;
}

.demo-assistant-page-context > p:first-of-type {
  max-width: 900px;
  margin: -10px 0 8px;
  color: #5b6472;
}

.stream-status-row,
.smoke-checklist,
.stream-steps {
  grid-column: 1;
}

.stream-status-row {
  min-height: 44px;
  margin: 0;
}

.stream-status {
  min-height: 44px;
  box-sizing: border-box;
  border-radius: 6px;
}

.stream-refresh {
  min-height: 44px;
  padding: 0 14px;
  border-color: #b9c2cf;
  border-radius: 6px;
  color: #253044;
  font-weight: 600;
}

.stream-refresh:hover:not(:disabled) {
  border-color: #778397;
  background: #f8fafc;
}

.smoke-checklist {
  gap: 8px;
  margin: 0;
}

.smoke-check {
  min-height: 44px;
  padding: 8px 12px;
  border-color: #dce1e8;
  border-radius: 6px;
  background: #ffffff;
}

.stream-phase-hint {
  grid-column: 2;
  grid-row: 3 / span 2;
  align-self: stretch;
  margin: 0;
  padding: 18px 0 18px 22px;
  border: 0;
  border-left: 3px solid #2563eb;
  border-radius: 0;
  background: transparent;
}

.stream-phase-title {
  color: #1f2937;
}

.stream-phase-chip {
  border-radius: 4px;
}

.stream-steps {
  margin: 0;
}

.demo-hint {
  grid-column: 2;
  margin: 0;
  padding: 14px 0 0;
  border-top: 1px solid #d9dee7;
  border-radius: 0;
  color: #3f4a5a;
  background: transparent;
}

.assistant-loader-fab {
  border: 2px solid #ffffff;
  color: #ffffff;
  background: #1f2937;
  box-shadow:
    0 12px 28px rgba(31, 41, 55, 0.24),
    0 2px 8px rgba(31, 41, 55, 0.14);
}

.assistant-loader-fab:hover {
  box-shadow:
    0 16px 32px rgba(31, 41, 55, 0.27),
    0 3px 10px rgba(31, 41, 55, 0.16);
}

.assistant-loader-fab.has-error {
  background: #b42318;
}

.assistant-loader-spin {
  animation: assistantLoaderSpin 800ms linear infinite;
}

@keyframes assistantLoaderSpin {
  to {
    transform: rotate(360deg);
  }
}

.reaction-log,
.reaction-log-head {
  border-radius: 6px;
}

.reaction-log {
  border-color: #d9dee7;
}

.reaction-log-head {
  color: #253044;
  background: #eef1f5;
}

.formfill-page {
  gap: 24px;
}

.formfill-header {
  padding: 0 0 22px;
  border: 0;
  border-bottom: 1px solid #d9dee7;
  border-radius: 0;
  background: transparent;
}

.formfill-header p {
  max-width: 920px;
  color: #5b6472;
}

.formfill-snippets {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.formfill-snippet {
  box-sizing: border-box;
  min-width: 0;
  padding: 14px;
  border: 1px solid #d4dae3;
  border-radius: 6px;
  color: #253044;
  background: #ffffff;
}

.formfill-snippet:hover {
  border-color: #8793a5;
  color: #111827;
  background: #f9fafb;
}

.formfill-snippet-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  font-weight: 700;
}

.formfill-form {
  padding: 24px;
  border-color: #d9dee7;
  border-radius: 6px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(31, 41, 55, 0.05);
}

.formfill-row > input,
.formfill-row > select,
.formfill-row > textarea,
.formfill-control input,
.formfill-rows-table td input {
  box-sizing: border-box;
  min-height: 44px;
  border-color: #b9c2cf;
  border-radius: 5px;
}

.formfill-row > textarea {
  min-height: 92px;
}

.formfill-fieldset {
  border-radius: 5px;
}

.formfill-radio {
  min-height: 44px;
  gap: 7px;
}

.formfill-radio input {
  width: 18px;
  height: 18px;
}

.formfill-btn-secondary,
.formfill-btn-primary {
  min-height: 44px;
  padding: 0 16px;
  border-radius: 5px;
  font-weight: 600;
}

.formfill-btn-primary {
  border-color: #1d4ed8;
  background: #1d4ed8;
}

.formfill-btn-primary:hover {
  background: #1e40af;
  box-shadow: none;
}

.formfill-control {
  padding: 18px 20px;
  border: 0;
  border-left: 3px solid #d97706;
  border-radius: 0;
  background: #fffbeb;
}

.formfill-table-section-title {
  margin: 12px 0 0;
  color: #111827;
}

.formfill-rows-table {
  border-color: #d9dee7;
  border-radius: 6px;
  background: #ffffff;
}

.formfill-rows-table th {
  color: #374151;
  background: #eef1f5;
}

@media (max-width: 1024px) {
  .page {
    padding-right: 24px;
    padding-left: 24px;
  }

  .page-nav {
    flex-wrap: wrap;
    gap: 8px 16px;
  }

  .page-nav-primary,
  .page-nav-tools {
    flex-basis: 100%;
  }

  .page-nav-primary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .page-nav-tools {
    justify-content: flex-end;
  }

  .demo-assistant-page-context {
    grid-template-columns: minmax(0, 1fr);
  }

  .stream-status-row,
  .smoke-checklist,
  .stream-phase-hint,
  .stream-steps,
  .demo-hint {
    grid-column: 1;
    grid-row: auto;
  }

  .stream-phase-hint {
    padding: 16px 0 16px 20px;
  }
}

@media (max-width: 700px) {
  .page {
    padding: 0 16px 132px;
  }

  .page-nav {
    position: relative;
    margin: 0 0 24px;
    padding: 12px 0 16px;
    background: transparent;
    backdrop-filter: none;
  }

  .page-nav-primary {
    gap: 4px;
  }

  .page-nav-tab {
    min-height: 44px;
    padding: 0 8px;
  }

  .page-nav-tools {
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .page-nav-theme {
    flex: 1 0 100%;
  }

  .page-nav-theme :deep(.ai-theme-switcher) {
    width: 100%;
    justify-content: space-between;
  }

  .page-nav-theme :deep(.ai-theme-swatch) {
    width: 44px;
    height: 44px;
  }

  .page-nav-cmdk,
  .page-nav-hint,
  .stream-refresh {
    min-height: 44px;
  }

  .page-nav-hint {
    margin-left: auto;
  }

  .demo-assistant-page-context h1,
  .formfill-header h1 {
    font-size: 1.42rem;
  }

  .demo-assistant-page-context,
  .formfill-page {
    gap: 18px;
  }

  .demo-assistant-page-context,
  .formfill-header,
  .formfill-form {
    padding-right: 0;
    padding-left: 0;
  }

  .formfill-form {
    padding: 18px 16px;
  }

  .formfill-snippets,
  .formfill-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .formfill-snippet {
    padding: 14px;
  }

  .formfill-actions {
    justify-content: stretch;
  }

  .formfill-btn-secondary,
  .formfill-btn-primary {
    flex: 1 1 148px;
  }

  .reaction-log {
    right: 16px;
    bottom: 84px;
    left: 16px;
    width: auto;
  }

  :global(
    body[data-playground-route="admin"] [data-ai-assistant-auto-mount] .ai-fab
  ) {
    display: none !important;
  }
}

@media (max-width: 520px) {
  .page-nav-label-long {
    display: none;
  }

  .page-nav-label-short {
    display: inline;
  }

  .page-nav-tab {
    gap: 5px;
    font-size: 0.76rem;
  }

  .formfill-actions {
    flex-direction: column;
  }

  .formfill-btn-secondary,
  .formfill-btn-primary {
    flex-basis: 44px;
    width: 100%;
  }
}
</style>
