import type { Theme, ThemeConfig } from '@vuepress/core'
import { path } from '@vuepress/utils'
import type { ThemeYuchannsLocaleOptions } from '../shared'

export interface ThemeYuchannsOptions extends ThemeConfig, ThemeYuchannsLocaleOptions {

}

const theme: Theme<ThemeYuchannsOptions> = (opts, app) => {
  return {
    name: 'vuepress-theme-yuchanns',
    layouts: {
      Layout: path.resolve(__dirname, '../client/layouts/layout'),
      404: path.resolve(__dirname, '../client/layouts/notfound')
    },

    plugins: [
      ['@vuepress/theme-data', { themeData: opts }],
      ['@vuepress/plugin-nprogress']
    ]
  }
}

export default theme
