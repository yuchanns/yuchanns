import type { PluginWithParams, Options } from 'markdown-it'
import type * as Token from 'markdown-it/lib/token'
import type * as Renderer from 'markdown-it/lib/renderer'

const proxy = (tokens: Token[], idx: number, options: Options, _env: any, self: Renderer) => self.renderToken(tokens, idx, options)

export const markdownItBetterList: PluginWithParams = (md): void => {
  md.renderer.rules.orderder_list_open = () => '<div class="better-list"><div class="better-list-border"></div><div>'
  md.renderer.rules.orderder_list_close = () => '</div></div>'
  md.renderer.rules.bullet_list_open = () => '<div class="better-list"><div class="better-list-border"></div><div>'
  md.renderer.rules.bullet_list_close = () => '</div></div>'
  md.renderer.rules.list_item_open = () => '<div class="better-list-block">'
  md.renderer.rules.list_item_close = () => '</div>'

  const defaultParagraphOpen = md.renderer.rules.paragraph_open || proxy
  const defaultParagraphClose = md.renderer.rules.paragraph_close || proxy

  md.renderer.rules.paragraph_open = (tokens, idx, options, env, self) => {
    if (idx > 0) {
      const lastToken = tokens[idx - 1]
      if (lastToken.type == 'list_item_open') {
        return `<div class="better-list-title">
          <div class="better-list-bullet">
            <span class="better-list-bullet-control"></span>
            <span class="better-list-bullet-container">
              <span class="better-list-bullet-entity"></span>
            </span>
          </div>
          <div class="better-list-title-content">${defaultParagraphOpen(tokens, idx, options, env, self)}`
      }
    }
    return defaultParagraphOpen(tokens, idx, options, env, self)
  }
  md.renderer.rules.paragraph_close = (tokens, idx, options, env, self) => {
    // look for the paired open tag to see if stay next to a list_item_open
    let { tag } = tokens[idx], extraCount = 0, openIdx = 0
    for (let i = idx - 1; i >= 0; i--) {
      const { tag: lastTag, type: lastType } = tokens[i]
      if (lastTag != tag) continue
      if (lastType.endsWith('_close')) {
        extraCount++
        continue
      }
      if (lastType.endsWith('_open')) {
        if (extraCount > 0) {
          extraCount--
          continue
        }
        openIdx = i
        break
      }
    }
    if (openIdx > 0 && tokens[openIdx - 1].type == 'list_item_open') {
      return `${defaultParagraphClose(tokens, idx, options, env, self)}</div></div>`
    }
    return defaultParagraphClose(tokens, idx, options, env, self)
  }
}
