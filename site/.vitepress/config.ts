import { defineConfig } from 'vitepress'
import { markdownItBetterList } from './theme/plugins/better-list'
import { markdownItBacklinks, getBacklinks } from './theme/plugins/zettelkasten'
import { createWriteStream } from 'node:fs'
import { resolve } from 'node:path'
import { SitemapStream } from 'sitemap'
import { getFrontmatterWithTwitter } from './theme/plugins/twitter-card/card'

interface SiteMapLink {
  url: String
  lastmod: number | undefined
}

const links: SiteMapLink[] = []

export default defineConfig({
  lang: 'en-US',
  title: 'VPZK',
  description: 'Link Thinking.',

  lastUpdated: true,
  cleanUrls: true,

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
    let frontmatter = getFrontmatterWithTwitter(pageData, { site: 'https://yuchanns.xyz/', creator: "yuchanns", defaultImage: 'https://yuchanns.xyz/favicon.ico' })
    return {
      backlinks,
      frontmatter,
    }
  },

  transformHtml: (_, id, { pageData }) => {
    if (!/[\\/]404\.html$/.test(id))
      links.push({
        url: pageData.relativePath.replace(/((^|\/)index)?\.md$/, '$2'),
        lastmod: pageData.lastUpdated
      })
  },
  buildEnd: async ({ outDir }) => {
    const sitemap = new SitemapStream({
      hostname: 'https://yuchanns.xyz/'
    })
    const writeStream = createWriteStream(resolve(outDir, 'sitemap.xml'))
    sitemap.pipe(writeStream)
    links.forEach((link) => sitemap.write(link))
    sitemap.end()
    await new Promise((r) => writeStream.on('finish', r))
  }
})

