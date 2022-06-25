import { defineUserConfig } from '@vuepress/cli'
import { defaultTheme } from '@vuepress/theme-default'
import { zettelkastenPlugin } from '@vpzk/plugin-zettelkasten'

export default defineUserConfig({
  base: "/",
  locales: {
    "/": {
      lang: "zh-CN",
      title: "VPZK",
      description: "思考链接"
    }
  },

  theme: defaultTheme({
    sidebar: false
  }),

  plugins: [
    zettelkastenPlugin({ dir: "notes" })
  ]
})
