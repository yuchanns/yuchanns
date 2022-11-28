import type { PluginWithParams } from 'markdown-it'
import { collection } from './collection'

export const regexp = /\[{2}\s*(.+?)\s*\]{2}/ig

export const linkMatcher = (cap: RegExpExecArray, vault: string) => {
  const backlink = cap[1].split("|")
  const title = backlink[0]
  const path = `/${vault}/${backlink[backlink.length - 1]}`

  return { title, path }
}

export const markdownItBacklinks: PluginWithParams = (md, { vault }): void => {
  md.core.ruler.before('normalize', 'backlinks', state => {
    let relativePath = state.env.relativePath?.replace('.md', '')
    let selfTitle = state.env.frontmatter?.title
    state.src = (src => {
      let cap: RegExpExecArray | null
      while ((cap = regexp.exec(src))) {
        const { title, path } = linkMatcher(cap, vault)

        src =
          src.slice(0, cap.index) +
          `<span class="backlink-bracket">&#91;&#91;</span>[${title}](${path})<span class="backlink-bracket">&#93;&#93;</span>` +
          src.slice(cap.index + cap[0].length, src.length)

        if (selfTitle != undefined && relativePath != undefined) {
          let backlinks = collection.get(path) ?? []
          // TODO: use set to exclude duplicate backlinks
          let found = false
          for (const backlink of backlinks) {
            if (backlink.path == relativePath) {
              found = true
              break
            }
          }
          if (!found) {
            backlinks.push({ title: selfTitle, path: relativePath, content: md.render(src.slice(cap.index, src.length)) })
            collection.set(path, backlinks)
          }
        }
      }

      return src
    })(state.src)
  })
}
