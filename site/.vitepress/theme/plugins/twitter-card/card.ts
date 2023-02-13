import { PageData } from "vitepress";

export interface TwitterCardOptions {
  site: string
  creator: string
  defaultImage?: string
}

export const getFrontmatterWithTwitter = (pageData: PageData, opts: TwitterCardOptions) => {
  let frontmatter = pageData.frontmatter
  frontmatter['head'] = [
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:site', content: opts.site }],
    ['meta', { name: 'twitter:creator', content: opts.creator }],
    ['meta', { property: 'og:url', content: opts.site + pageData.relativePath.replace(/((^|\/)index)?\.md$/, '$2') }],
    ['meta', { property: 'og:title', content: pageData.title }],
    ['meta', { property: 'og:description', content: pageData.description }],
    ['meta', { property: 'og:image', content: frontmatter.image ?? (opts.defaultImage ?? '') }],
  ]

  return frontmatter
}
