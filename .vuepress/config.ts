import { defineUserConfig } from '@vuepress/cli'
import type { ThemeYuchannsOptions as ThemeOptions } from '../theme/lib/node'
import { path } from '@vuepress/utils'
import type { ViteBundlerOptions } from '@vuepress/bundler-vite'
import vueJsx from '@vitejs/plugin-vue-jsx'

export default defineUserConfig<ThemeOptions, ViteBundlerOptions>({
    lang: 'zh-CN',
    title: '代码炼金工坊',
    description: 'Gopher / Rustacean. Fan of LiSA(織部 里沙).',

    theme: path.resolve(__dirname, '../theme/lib/node'),
    themeConfig: {
      name: "科学捜査官",
      avatar: "/yuchanns.jpg",
      social: {
        github: "yuchanns",
        twitter: "realyuchanns",
      },
      description: "追寻计算机炼金术的贤者之石",
      copyright: "<a href=\"https://beian.miit.gov.cn/\">闽ICP备2020021086号-1</a>",
      startDate: 2016,
      nav: [
        { name: "YuC", link: "https://yuc.wiki" }
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
