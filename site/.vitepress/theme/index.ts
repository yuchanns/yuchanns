import DefaultTheme from 'vitepress/theme'
import { BacklinkReferences } from './plugins/zettelkasten/components'
import Layout from './Layout.vue'
import './styles/vars.scss'
import './plugins/better-list/index.scss'
import './plugins/zettelkasten/index.scss'

export default {
  ...DefaultTheme,
  enhanceApp: (ctx) => {
    DefaultTheme.enhanceApp(ctx)
    ctx.app.component('BacklinkReferences', BacklinkReferences)
  },
  Layout: Layout
}
