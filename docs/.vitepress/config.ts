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
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
            { text: 'Configuration', link: '/guide/configuration' },
          ],
        },
        {
          text: 'Features',
          items: [
            { text: 'Chat & Streaming', link: '/guide/chat' },
            { text: 'Function Calling', link: '/guide/function-calling' },
            { text: 'MCP Server', link: '/guide/mcp-server' },
            { text: 'Plugin System', link: '/guide/plugins' },
          ],
        },
        {
          text: 'Deployment',
          items: [
            { text: 'Standalone Service', link: '/guide/standalone-service' },
            { text: 'Kubernetes', link: '/guide/kubernetes' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'REST API',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Chat', link: '/api/chat' },
            { text: 'Capabilities', link: '/api/capabilities' },
            { text: 'Admin', link: '/api/admin' },
          ],
        },
      ],
    },
  },
});
