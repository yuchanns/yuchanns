import { defineUserConfig } from '@vuepress/cli'
import type { ThemeYuchannsOptions as ThemeOptions } from '../theme/lib/node'
import { path } from '@vuepress/utils'
import type { ViteBundlerOptions } from '@vuepress/bundler-vite'
import vueJsx from '@vitejs/plugin-vue-jsx'

export default defineUserConfig<ThemeOptions, ViteBundlerOptions>({
    lang: 'zh-CN',
    title: '代码炼金工坊',
    description: 'Enjoy Go/Rust. Vim User. Loving Anime Girls. Fan of LiSA(織部 里沙).',

    theme: path.resolve(__dirname, '../theme/lib/node'),
    themeConfig: {
      name: "科学捜査官",
      avatar: "/yuchanns.jpg",
      social: {
        github: "yuchanns",
        twitter: "realyuchanns",
      },
      description: "没有困难的事情，只有迟疑的开始",
      copyright: "<a href=\"https://beian.miit.gov.cn/\">闽ICP备2020021086号-1</a>",
      startDate: 2016,
      nav: [
        { name: "YuC", link: "https://yuc.wiki" },
        { name: "Awesome", link: "/awesome"}
      ]
    },

    bundler: '@vuepress/bundler-vite',
    bundlerConfig: {
      viteOptions: {
        plugins: [
          vueJsx({})
        ]
      }
    }
})