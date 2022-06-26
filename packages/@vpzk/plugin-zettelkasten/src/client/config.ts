import { defineClientConfig } from '@vuepress/client'
import { BacklinkReferences } from './components'
import './styles/index.scss'

export default defineClientConfig({
  enhance: ({ app }) => {
    app.component('BacklinkReferences', BacklinkReferences)
  }
})
