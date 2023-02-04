import { defineComponent, reactive, watch } from "vue";
import DefaultTheme from 'vitepress/theme'
import { BacklinkReferences } from './plugins/zettelkasten/components'
import { useRoute } from "vitepress";

export const Layout = defineComponent({
  name: 'Layout',

  setup() {
    const route = useRoute()
    const state = reactive({ key: route.path })
    watch(() => route.path, (path) => state.key = path)
    const Layout = DefaultTheme.Layout

    return () =>
      <Layout>{{
        "doc-footer-before": () => <BacklinkReferences key={state.key} />
      }}</Layout>
  }
})
