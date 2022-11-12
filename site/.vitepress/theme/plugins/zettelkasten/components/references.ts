import { defineComponent, h } from 'vue'
import type { VNode } from 'vue'
import { useData, useRouter } from 'vitepress'
import { RouterLink } from 'vue-router'

export const BacklinkReferences = defineComponent({
  name: "BacklinkReferences",

  setup() {
    // TODO: investigation: do not load data on routing
    const { page } = useData()
    const hs: VNode[] = []
    const backlinks = page.value['backlinks']
    // let r = useRouter()
    for (const backlink of backlinks) {
      hs.push(h('div', { class: 'backlink' }, [
        // h('h2', h(RouterLink, { to: `/${backlink.path}` }, { default: () => backlink.title })),
        h('h2', { innerHTML: backlink.title }),
        // TODO: page content link should be routerable.
        h('div', { class: 'backlink-body', innerHTML: backlink.content })
      ]))
    }
    return () => h('div', { class: 'backlinks-group' }, [
      h('h2', { class: 'backlinks-header' }, `${backlinks.length} Linked Reference(s)`),
      backlinks.length ? h('div', { class: 'backlinks' }, [...hs]) : []
    ])
  }
})
