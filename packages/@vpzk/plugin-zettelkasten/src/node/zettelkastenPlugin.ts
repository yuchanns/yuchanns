import type { Plugin, PluginObject } from '@vuepress/core'
import { path } from '@vuepress/utils'
import { markdownItBacklinks } from './markdownItBacklinks'
import { prepareBacklinks } from './backlinks'

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

  plugin.onInitialized = async (app) => await prepareBacklinks(app, opts.vault)

  plugin.onWatched = async (app) => await prepareBacklinks(app, opts.vault)

  return plugin
}
