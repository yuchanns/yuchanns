import { defineComponent, onMounted, onUpdated, reactive, watch } from "vue";
import DefaultTheme from 'vitepress/theme'
import { BacklinkReferences } from './plugins/zettelkasten/components'
import { useRoute } from "vitepress"
import mediumZoom from "medium-zoom"

export const Layout = defineComponent({
  name: 'Layout',

  setup() {
    const route = useRoute()
    const state = reactive({ key: route.path })
    watch(() => route.path, (path) => state.key = path)
    const Layout = DefaultTheme.Layout
    onMounted(() => {
      mediumZoom(document.querySelectorAll('.VPDoc img'))
    })
    onUpdated(() => {
      mediumZoom(document.querySelectorAll('.VPDoc img'))
    })

    return () =>
      <Layout key={state.key}>{{
        "doc-footer-before": () => <BacklinkReferences key={state.key} />
      }}</Layout>
  }
})
