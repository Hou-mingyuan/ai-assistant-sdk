import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminDemoPanel from "./AdminDemoPanel.vue";

vi.mock("../../ai-assistant-ui/src/entries/admin", () => ({
  adminOverview: vi
    .fn()
    .mockResolvedValue({ success: true, status: 200, data: { ok: true } }),
  adminListTokens: vi.fn(),
  adminSetTokenQuota: vi.fn(),
  adminListPrompts: vi.fn(),
  adminCreatePrompt: vi.fn(),
  adminListTools: vi.fn(),
  adminIngestRag: vi.fn(),
  adminRagStats: vi.fn(),
  adminConfigureAbTest: vi.fn(),
  adminListAbTests: vi.fn(),
  adminSetFallbackChain: vi.fn(),
  adminGetFallbackChain: vi.fn(),
  adminListPlugins: vi.fn(),
  adminUnloadPlugin: vi.fn(),
  adminSystemInfo: vi.fn(),
}));

describe("AdminDemoPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders seven admin tabs covering all endpoint groups", () => {
    const wrapper = mount(AdminDemoPanel);
    const tabs = wrapper.findAll(".admin-app-tab");
    expect(tabs).toHaveLength(7);
    expect(wrapper.get('[role="tablist"]').attributes("aria-label")).toBe(
      "Admin sections",
    );
    expect(wrapper.findAll(".admin-app-tab-icon")).toHaveLength(7);
    expect(wrapper.find(".admin-app-icon").element.tagName.toLowerCase()).toBe(
      "svg",
    );
    expect(tabs.map((t) => t.text())).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Overview"),
        expect.stringContaining("Tokens"),
        expect.stringContaining("Prompts"),
        expect.stringContaining("RAG"),
        expect.stringContaining("A/B"),
        expect.stringContaining("Fallback"),
        expect.stringContaining("Plugins"),
      ]),
    );
  });

  it("switches tab panel when RAG tab is clicked", async () => {
    const wrapper = mount(AdminDemoPanel);
    const ragTab = wrapper
      .findAll(".admin-app-tab")
      .find((t) => t.text().includes("RAG"));
    expect(ragTab).toBeTruthy();
    await ragTab!.trigger("click");
    expect(wrapper.text()).toContain("POST ingest");
    expect(wrapper.text()).toContain("GET stats");
  });

  it("blocks admin API call without token and surfaces error payload", async () => {
    const wrapper = mount(AdminDemoPanel);
    await wrapper.find(".admin-btn").trigger("click");
    expect(wrapper.text()).toContain("请先在顶部填写 Admin Token");
    expect(wrapper.find(".admin-app-json").text()).toContain("Admin Token");
    expect(wrapper.find(".admin-app-badge").text()).toContain("最近");
    expect(wrapper.find(".admin-app-status").text()).toContain("失败");
  });

  it("collapses and expands the console body", async () => {
    const wrapper = mount(AdminDemoPanel);
    expect(wrapper.find(".admin-app-body").exists()).toBe(true);
    await wrapper.find(".admin-app-toggle").trigger("click");
    expect(wrapper.find(".admin-app-body").exists()).toBe(false);
    await wrapper.find(".admin-app-toggle").trigger("click");
    expect(wrapper.find(".admin-app-body").exists()).toBe(true);
  });
});
