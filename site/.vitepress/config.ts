import { defineConfig } from 'vitepress'
import { markdownItBetterList } from './theme/plugins/better-list'
import { markdownItBacklinks, getBacklinks } from './theme/plugins/zettelkasten'

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
    },
    config: (md) => {
      md.use(markdownItBetterList)
      md.use(markdownItBacklinks, { vault: 'notes' })
    }
  },

  themeConfig: {
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2016-present Hanchin Hsieh'
    }
  },

  transformPageData: async (pageData) => {
    let backlinks = await getBacklinks(pageData)
    return {
      backlinks
    }
  }
})

