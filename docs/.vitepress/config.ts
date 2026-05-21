import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'AI Assistant SDK',
  description: 'Embeddable AI assistant for Java + Vue projects',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'API', link: '/api/' },
      { text: 'GitHub', link: 'https://github.com/Hou-mingyuan/ai-assistant-sdk' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Frontend Standalone', link: '/guide/frontend-standalone' },
            { text: 'Frontend Recipes', link: '/guide/frontend-recipes' },
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
            { text: 'Production Checklist', link: '/guide/production-checklist' },
            { text: 'Security: CSP', link: '/guide/security-csp' },
            { text: 'Configuration', link: '/guide/configuration' },
          ],
        },
        {
          text: 'Features',
          items: [
            { text: 'UI Features (settings / sessions / shortcuts)', link: '/guide/ui-features' },
            { text: 'Chat & Streaming', link: '/guide/chat' },
            { text: 'Function Calling', link: '/guide/function-calling' },
            { text: 'MCP Server', link: '/guide/mcp-server' },
            { text: 'Plugin System', link: '/guide/plugins' },
            { text: 'Backend Architecture', link: '/guide/backend-architecture' },
            { text: 'Dependency Footprint', link: '/guide/dependency-footprint' },
            { text: 'Virtual Scroll Strategy', link: '/guide/virtual-scroll-strategy' },
          ],
        },
        {
          text: 'Hardening',
          items: [
            { text: 'SSRF Allowlist', link: '/guide/ssrf-allowlist' },
            { text: 'Multi-Replica Config Lint', link: '/guide/multi-replica-lint' },
          ],
        },
        {
          text: 'Deployment',
          items: [
            { text: 'Standalone Service', link: '/guide/standalone-service' },
            { text: 'Deployment Checklists', link: '/guide/deployment-checklists' },
            { text: 'Kubernetes', link: '/guide/kubernetes' },
          ],
        },
        {
          text: 'Contributing',
          items: [
            { text: 'Git Hooks (pre-commit)', link: '/guide/git-hooks' },
            { text: 'Styling Tokens', link: '/guide/styling-tokens' },
            {
              text: 'OpenAPI → TypeScript codegen',
              link: '/guide/openapi-typescript-codegen',
            },
          ],
        },
      ],
      '/api/': [
        {
          text: 'REST API',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'REST Reference', link: '/api/reference' },
            { text: 'Chat', link: '/api/chat' },
            { text: 'Capabilities', link: '/api/capabilities' },
            { text: 'Admin', link: '/api/admin' },
          ],
        },
      ],
    },
  },
});
