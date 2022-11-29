import { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { Layout } from './layout'

import './styles/vars.scss'
import './plugins/better-list/index.scss'
import './plugins/zettelkasten/index.scss'
import { defineAsyncComponent } from 'vue'


const theme: Theme = {
  ...DefaultTheme,
  enhanceApp: (ctx) => {
    DefaultTheme.enhanceApp(ctx)
    ctx.app.component('Tweet', defineAsyncComponent(() => import('vue-tweet')))
  },
  Layout: Layout
}

export default theme
