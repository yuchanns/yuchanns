import type { Plugin, PluginObject } from '@vuepress/core'
import { markdownItBetterList } from './markdownItBetterList'
import { path } from '@vuepress/utils'

export const betterListPlugin = (): Plugin => {
  const plugin: PluginObject = {
    name: '@vpzk/plugin-better-list'
  }

  plugin.clientConfigFile = path.resolve(__dirname, '../client/config.js')

  plugin.extendsMarkdown = (md) => {
    markdownItBetterList(md)
  }

  return plugin
}
