import type { Plugin, PluginObject } from '@vuepress/core'
import * as lazyLoading from 'markdown-it-image-lazy-loading'

export interface lazyImageOptions {
  decoding?: boolean
  image_size?: boolean
  base_path?: string
}

export const lazyImagePlugin = (opts: lazyImageOptions): Plugin => {
  const plugin: PluginObject = {
    name: '@vpzk/plugin-lazy-image'
  }

  plugin.extendsMarkdown = (md) => {
    md.use(lazyLoading, opts)
  }

  return plugin
}
