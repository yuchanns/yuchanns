import { defineUserConfig } from '@vuepress/cli'
import { zettelkastenPlugin } from '@vpzk/plugin-zettelkasten'
import { localTheme } from './theme'

export default defineUserConfig({
  base: "/",
  locales: {
    "/": {
      lang: "zh-CN",
      title: "VPZK",
      description: "思考链接"
    }
  },

  theme: localTheme({
    sidebar: false
  }),

  plugins: [
    zettelkastenPlugin({ vault: "notes" })
  ]
})
