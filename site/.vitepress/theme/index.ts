import { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { Layout } from './layout'
import Tweet from 'vue-tweet'

import './styles/vars.scss'
import './plugins/better-list/index.scss'
import './plugins/zettelkasten/index.scss'

const theme: Theme = {
  ...DefaultTheme,
  enhanceApp: (ctx) => {
    DefaultTheme.enhanceApp(ctx)
    ctx.app.component('Tweet', Tweet)
  },
  Layout: Layout
}

export default theme
