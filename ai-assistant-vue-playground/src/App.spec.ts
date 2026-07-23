import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.vue";

const ColorThemeSwitcherStub = {
  template: '<div class="theme-stub" />',
  props: ["modelValue"],
  emits: ["update:modelValue"],
};

const AdminDemoPanelStub = {
  template: '<div class="admin-stub">Admin Console stub</div>',
};

const CommandPaletteStub = {
  template: '<div class="cmdk-stub" />',
  props: ["open", "commands"],
  emits: ["update:open"],
};

function mockFetchSequence(
  responses: Array<{ ok?: boolean; status?: number; body: unknown }>,
) {
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const r = responses[i++] ?? responses[responses.length - 1]!;
      return {
        ok: r.ok ?? true,
        status: r.status ?? 200,
        json: async () => r.body,
      };
    }),
  );
}

describe("Playground App", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    delete document.body.dataset.playgroundRoute;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders demo page with SSE stream phase chips", async () => {
    mockFetchSequence([{ body: { success: true, status: "running" } }]);
    const wrapper = mount(App, {
      global: {
        stubs: {
          ColorThemeSwitcher: ColorThemeSwitcherStub,
          AdminDemoPanel: AdminDemoPanelStub,
          CommandPalette: CommandPaletteStub,
        },
      },
    });

    expect(wrapper.text()).toContain("AI Assistant 悬浮球演示");
    expect(wrapper.text()).toContain("SSE 流式体验路径");
    expect(wrapper.text()).not.toContain("本轮 K4");
    expect(wrapper.findAll(".stream-phase-chip")).toHaveLength(5);
    expect(wrapper.findAll(".page-nav-tab svg")).toHaveLength(3);
    expect(wrapper.find(".page-nav-primary").exists()).toBe(true);
    expect(wrapper.find(".page-nav-tools").exists()).toBe(true);
    await flushPromises();
    expect(wrapper.find(".stream-status-row").exists()).toBe(true);
  });

  it("synchronizes assistant theme events with the playground palette", async () => {
    mockFetchSequence([{ body: { success: true, status: "running" } }]);
    const wrapper = mount(App, {
      global: {
        stubs: {
          ColorThemeSwitcher: ColorThemeSwitcherStub,
          AdminDemoPanel: AdminDemoPanelStub,
          CommandPalette: CommandPaletteStub,
        },
      },
    });

    window.dispatchEvent(
      new CustomEvent("ai-assistant-theme-change", {
        detail: { theme: "plum", source: "assistant" },
      }),
    );
    await wrapper.vm.$nextTick();

    expect(localStorage.getItem("playground-theme")).toBe("plum");
    expect(localStorage.getItem("ai-assistant.theme.palette.v1")).toBe("plum");
    expect(document.documentElement.style.getPropertyValue("--demo-primary-from")).toBe(
      "#075985",
    );

    wrapper.unmount();
  });

  it("keeps Ctrl+K scoped to the assistant while retaining the page shortcut", async () => {
    mockFetchSequence([{ body: { success: true, status: "running" } }]);
    const wrapper = mount(App, {
      attachTo: document.body,
      global: {
        stubs: {
          ColorThemeSwitcher: ColorThemeSwitcherStub,
          AdminDemoPanel: AdminDemoPanelStub,
          CommandPalette: CommandPaletteStub,
        },
      },
    });

    const assistantRoot = document.createElement("div");
    assistantRoot.className = "ai-assistant-wrapper";
    const assistantInput = document.createElement("input");
    assistantRoot.appendChild(assistantInput);
    document.body.appendChild(assistantRoot);

    assistantInput.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushPromises();
    expect(wrapper.find(".cmdk-stub").exists()).toBe(false);

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: true,
        cancelable: true,
      }),
    );
    await flushPromises();
    expect(wrapper.find(".cmdk-stub").exists()).toBe(true);

    assistantRoot.remove();
    wrapper.unmount();
  });

  it("requests the assistant on first click and removes the loader when ready", async () => {
    mockFetchSequence([{ body: { success: true, status: "running" } }]);
    const onLoad = vi.fn();
    window.addEventListener("ai-assistant-load", onLoad);
    const wrapper = mount(App, {
      global: {
        stubs: {
          ColorThemeSwitcher: ColorThemeSwitcherStub,
          AdminDemoPanel: AdminDemoPanelStub,
          CommandPalette: CommandPaletteStub,
        },
      },
    });

    const loader = wrapper.find(".assistant-loader-fab");
    expect(loader.attributes("aria-label")).toBe("打开 AI 助手");
    expect(loader.find("svg.lucide-sparkles").exists()).toBe(true);
    await loader.trigger("click");
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect((onLoad.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      open: true,
    });
    expect(wrapper.find(".assistant-loader-fab").attributes("aria-busy")).toBe(
      "true",
    );

    window.dispatchEvent(new CustomEvent("ai-assistant-ready"));
    await flushPromises();
    expect(wrapper.find(".assistant-loader-fab").exists()).toBe(false);
    window.removeEventListener("ai-assistant-load", onLoad);
  });

  it("navigates to Admin Console tab", async () => {
    mockFetchSequence([{ body: { success: true, status: "running" } }]);
    const wrapper = mount(App, {
      global: {
        stubs: {
          ColorThemeSwitcher: ColorThemeSwitcherStub,
          AdminDemoPanel: AdminDemoPanelStub,
          CommandPalette: CommandPaletteStub,
        },
      },
    });

    const adminBtn = wrapper
      .findAll(".page-nav-tab")
      .find((b) => b.text().includes("Admin"));
    await adminBtn!.trigger("click");
    expect(wrapper.find(".admin-stub").exists()).toBe(true);
  });

  it("records ai-assistant-reaction custom events in the reaction log", async () => {
    mockFetchSequence([{ body: { success: true, status: "running" } }]);
    const wrapper = mount(App, {
      global: {
        stubs: {
          ColorThemeSwitcher: ColorThemeSwitcherStub,
          AdminDemoPanel: AdminDemoPanelStub,
          CommandPalette: CommandPaletteStub,
        },
      },
    });

    window.dispatchEvent(
      new CustomEvent("ai-assistant-reaction", {
        detail: { messageIndex: 2, emoji: "👍", toggled: false },
      }),
    );
    await flushPromises();

    expect(wrapper.find(".reaction-log").exists()).toBe(true);
    expect(wrapper.text()).toContain("👍");
    expect(wrapper.text()).toContain("#2");
  });

  it("navigates to Form Auto-Fill tab and shows sample snippets", async () => {
    mockFetchSequence([{ body: { success: true, status: "running" } }]);
    const wrapper = mount(App, {
      global: {
        stubs: {
          ColorThemeSwitcher: ColorThemeSwitcherStub,
          AdminDemoPanel: AdminDemoPanelStub,
          CommandPalette: CommandPaletteStub,
        },
      },
    });

    const formBtn = wrapper
      .findAll(".page-nav-tab")
      .find((b) => b.text().includes("Form"));
    await formBtn!.trigger("click");
    expect(wrapper.get(".formfill-header h1").text()).toBe(
      "表单自动填充 / Form Auto-Fill 演示",
    );
    expect(wrapper.findAll(".formfill-snippet").length).toBeGreaterThanOrEqual(
      3,
    );
    expect(
      wrapper.findAll(".formfill-snippet svg").length,
    ).toBeGreaterThanOrEqual(3);
    expect(wrapper.find("[data-ai-fillable]").exists()).toBe(true);
    expect(wrapper.get(".formfill-control-note strong").text()).toBe("不在");
    expect(wrapper.get(".formfill-table-section-title").text()).toBe(
      "表格批量填入演示",
    );
    expect(wrapper.text()).not.toContain("Phase 2");
    expect(wrapper.text()).not.toContain("**不在**");
  });

  it("clears reaction log when clear button is clicked", async () => {
    mockFetchSequence([{ body: { success: true, status: "running" } }]);
    const wrapper = mount(App, {
      global: {
        stubs: {
          ColorThemeSwitcher: ColorThemeSwitcherStub,
          AdminDemoPanel: AdminDemoPanelStub,
          CommandPalette: CommandPaletteStub,
        },
      },
    });

    window.dispatchEvent(
      new CustomEvent("ai-assistant-reaction", {
        detail: { messageIndex: 0, emoji: "❤️", toggled: false },
      }),
    );
    await flushPromises();
    expect(wrapper.find(".reaction-log").exists()).toBe(true);

    await wrapper.find(".reaction-log-clear").trigger("click");
    expect(wrapper.find(".reaction-log").exists()).toBe(false);
  });

  it("resolves admin route from location hash", async () => {
    window.location.hash = "#/admin";
    mockFetchSequence([{ body: { success: true, status: "running" } }]);
    const wrapper = mount(App, {
      global: {
        stubs: {
          ColorThemeSwitcher: ColorThemeSwitcherStub,
          AdminDemoPanel: AdminDemoPanelStub,
          CommandPalette: CommandPaletteStub,
        },
      },
    });

    await flushPromises();
    expect(wrapper.find(".admin-stub").exists()).toBe(true);
    expect(document.body.dataset.playgroundRoute).toBe("admin");
    expect(wrapper.find(".assistant-loader-fab").exists()).toBe(false);

    const assistantBtn = wrapper
      .findAll(".page-nav-tab")
      .find((button) => button.text().includes("Assistant"));
    await assistantBtn!.trigger("click");
    await flushPromises();
    expect(document.body.dataset.playgroundRoute).toBe("demo");
    expect(wrapper.find(".assistant-loader-fab").exists()).toBe(true);
  });

  it("runs zero-key smoke checks and marks provider chip ready when UP", async () => {
    const healthOk = { success: true, status: "running" };
    const livenessOk = { status: "UP" };
    const statsOk = { calls: 0 };
    const runtimeOk = {
      success: true,
      service: { contextPath: "/ai-assistant" },
      security: { accessTokenConfigured: false },
      features: {},
      limits: {},
    };
    const providerUp = {
      status: "UP",
      provider: "demo",
      mode: "demo",
      mock: true,
    };
    const demoChat = {
      success: true,
      result:
        "[DEMO MODE - deterministic local response, not real AI]\n\nHello",
      meta: { provider: "demo" },
    };

    mockFetchSequence([
      { body: healthOk },
      { body: livenessOk },
      { body: statsOk },
      { body: runtimeOk },
      { body: providerUp },
      { body: demoChat },
    ]);

    const wrapper = mount(App, {
      global: {
        stubs: {
          ColorThemeSwitcher: ColorThemeSwitcherStub,
          AdminDemoPanel: AdminDemoPanelStub,
          CommandPalette: CommandPaletteStub,
        },
      },
    });

    await wrapper.find(".stream-refresh").trigger("click");
    await flushPromises();
    await vi.waitFor(() =>
      expect(wrapper.findAll(".smoke-check")).toHaveLength(6),
    );

    const readyChips = wrapper.findAll(".stream-phase-chip.ready");
    expect(readyChips.length).toBeGreaterThanOrEqual(2);
    expect(wrapper.text()).toContain("零密钥 smoke 全通过");
    expect(wrapper.findAll(".smoke-check.fail")).toHaveLength(0);
  });
});
