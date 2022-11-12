import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'en-US',
  title: 'VPZK',
  description: 'Link Thinking.',

  lastUpdated: true,
  cleanUrls: 'without-subfolders',

  head: [['meta', { name: 'theme-color', content: '#d23669' }]],

  markdown: {
    headers: {
      level: [0, 0]
    }
  },

  themeConfig: {
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2016-present Hanchin Hsieh'
    }
  }
})

