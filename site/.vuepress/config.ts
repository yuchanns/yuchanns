import { defineUserConfig } from '@vuepress/cli'
import { zettelkastenPlugin } from '@vpzk/plugin-zettelkasten'
import { localTheme } from './theme'
import { katexPlugin } from '@renovamen/vuepress-plugin-katex'
import { tasksPlugin } from '@vpzk/plugin-tasks'

const isProd = process.env.NODE_ENV === 'production'

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
    zettelkastenPlugin({ vault: "notes" }),
    katexPlugin(),
    isProd ? shikiPlugin({ theme: 'github-dark' }) : [],
    tasksPlugin({ enabled: true })
  ]
})
