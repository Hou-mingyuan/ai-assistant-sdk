import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'AI Assistant SDK',
  description: 'Embeddable AI assistant for Java + Vue projects',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'API', link: '/api/' },
      { text: 'Changelog', link: '/changelog' },
    ],
    sidebar: {
      '/guide/': [
        { text: 'Quick Start', link: '/guide/' },
        { text: 'Backend Setup', link: '/guide/backend' },
        { text: 'Frontend Setup', link: '/guide/frontend' },
        { text: 'Configuration', link: '/guide/config' },
        { text: 'Function Calling', link: '/guide/tools' },
        { text: 'Plugins', link: '/guide/plugins' },
        { text: 'Workflows', link: '/guide/workflows' },
      ],
      '/api/': [
        { text: 'Frontend API', link: '/api/' },
        { text: 'Backend API', link: '/api/backend' },
        { text: 'REST Endpoints', link: '/api/rest' },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/' },
    ],
  },
})
