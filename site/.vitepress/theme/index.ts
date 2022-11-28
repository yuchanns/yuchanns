import { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { Layout } from './layout'

import './styles/vars.scss'
import './plugins/better-list/index.scss'
import './plugins/zettelkasten/index.scss'

const theme: Theme = {
  ...DefaultTheme,
  Layout: Layout
}

export default theme
