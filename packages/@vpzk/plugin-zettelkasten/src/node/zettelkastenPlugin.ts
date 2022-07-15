import type { Plugin, PluginObject } from '@vuepress/core'
import { createPage } from '@vuepress/core'
import { path } from '@vuepress/utils'
import { markdownItBacklinks } from './markdownItBacklinks'
import { collection } from './collection'

export interface zettelkastenOptions {
  vault: string
}

const resolveOpts = (opts: zettelkastenOptions) => {
  let dir = opts.vault.replace(/^\/?/, "").replace(/\/?$/, "")
  opts.vault = dir.length ? `/${dir}` : ""
}

export const zettelkastenPlugin = (opts: zettelkastenOptions): Plugin => {
  const plugin: PluginObject = {
    name: '@vpzk/plugin-zettelkasten',
    multiple: true,
  }

  resolveOpts(opts)

  plugin.clientConfigFile = path.resolve(__dirname, '../client/config.js')

  plugin.extendsMarkdown = (md) => {
    md.use(markdownItBacklinks, opts)
  }

  plugin.onInitialized = async (app) => {
    const differences = collection.filter(({ path: infoPath }) => !app.pages.some(({ path: pagePath }) => pagePath == infoPath))
    for (const { path, title } of differences) {
      app.pages.push(await createPage(app, {
        path,
        frontmatter: { title: title },
        content: `## ${title}`
      }))
    }
    app.pages.map(({ path, data }) =>
      Object.assign(data, {
        backlinks: app.pages.filter(({ links }) =>
          links.filter(({ raw }) => path == raw).length
        ).map(({ title, path: pagePath, content, contentRendered, excerpt }) => {
          const contents = content.split('\n\n')
          const idx = contents.findIndex(content => {
            return content.includes(path.replace('.html', '').replace(`${opts.vault}/`, ''))
          })
          const referredContent = contents.slice(idx, idx + 4).join('\n\n')
          const referredContentRendered = app.markdown.render(referredContent)
          return ({ title, path: pagePath, content, contentRendered, excerpt, referredContent, referredContentRendered })
        })
      }))
  }

  // TODO: update backlinks on change
  plugin.onWatched = async (_app) => { }

  return plugin
}
