import type { PluginWithParams } from 'markdown-it'
import { collection } from './collection'

export const regexp = /\[{2}\s*(.+?)\s*\]{2}/ig

export const linkMatcher = (cap: RegExpExecArray, vault: string) => {
  const backlink = cap[1].split("|")
  const title = backlink[0]
  const path = `${vault}/${backlink[backlink.length - 1]}.html`

  return { title, path }
}

export const markdownItBacklinks: PluginWithParams = (md, { vault }): void => {
  md.core.ruler.before('normalize', 'backlinks', state => {
    state.src = (src => {
      let cap: RegExpExecArray | null

      while ((cap = regexp.exec(src))) {
        const { title, path } = linkMatcher(cap, vault)

        if (!collection.some(info => info.path == path)) {
          collection.push({ title, path })
        }

        src =
          src.slice(0, cap.index) +
          `<span class="backlink-bracket">&#91;&#91;</span>[${title}](${path})<span class="backlink-bracket">&#93;&#93;</span>` +
          src.slice(cap.index + cap[0].length, src.length)
      }

      return src
    })(state.src)
  })
}
