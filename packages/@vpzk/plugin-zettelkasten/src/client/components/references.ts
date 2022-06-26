import { defineComponent, h } from 'vue'
import type { VNode } from 'vue'
import { usePageData } from '@vuepress/client'
import { RouterLink } from 'vue-router'
import '../styles/references.scss'

export const BacklinkReferences = defineComponent({
  name: "BacklinkReferences",

  setup() {
    const page = usePageData()
    const hs: VNode[] = []
    const backlinks = page.value['backlinks']
    for (const backlink of backlinks) {
      hs.push(h('div', { class: 'backlink' }, [
        h('h2', h(RouterLink, { to: backlink.path }, { default: () => backlink.title })),
        // TODO: page content link should be routerable.
        h('div', { class: 'backlink-body', innerHTML: backlink.contentRendered })
      ]))
    }
    return () => h('div', { class: 'backlinks-group' }, [
      h('h2', { class: 'backlinks-header' }, `${backlinks.length} Linked Reference(s)`),
      backlinks.length ? h('div', { class: 'backlinks' }, [...hs]) : []
    ])
  }
})
