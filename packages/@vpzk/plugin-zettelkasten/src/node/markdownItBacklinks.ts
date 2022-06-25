import type { PluginWithParams } from 'markdown-it'

// TODO: improve process internal link
const regexp = /\[{2}\s*(.+?)\s*\]{2}/i

export const markdownItBacklinks: PluginWithParams = (md, { dir }): void => {
  md.core.ruler.before('normalize', 'backlinks', state => {
    state.src = (src => {
      let cap: RegExpExecArray|null

      while ((cap = regexp.exec(src))) {
        const backlink = cap[1].split("|")
        const title = backlink[0]
        const path = backlink[backlink.length - 1]

        src =
          src.slice(0, cap.index) +
          `<span class="backlink-bracket">&#91;&#91;</span>[${title}](${dir}/${path}.html)<span class="backlink-bracket">&#93;&#93;</span>` +
          src.slice(cap.index + cap[0].length, src.length)
      }

      return src
    })(state.src)
  })
}
