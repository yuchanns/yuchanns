import type { Plugin, PluginObject } from '@vuepress/core'
import { path } from '@vuepress/utils'
import { markdownItBacklinks } from './markdownItBacklinks'

export interface zettelkastenOptions {
  dir: string
}

const resolveOpts = (opts: zettelkastenOptions) => {
  let dir = opts.dir.replace(/^\/?/, "").replace(/\/?$/, "")
  opts.dir = dir.length ? `/${dir}` : ""
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

  plugin.onPrepared = (_app) => {
    // TODO: create a virtual page with preset content if page is not exists
    console.log("onPrepared from vpzk")
  }

  return plugin
}
