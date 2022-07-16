import { collection } from './collection'
import { App, createPage } from '@vuepress/core'

// TODO: lazy generate backlinks
export const prepareBacklinks = async (app: App, vault: string) => {
  const differences = collection.filter(({ path: infoPath }) => !app.pages.some(({ path: pagePath }) => pagePath == infoPath))
  for (const { path, title } of differences) {
    app.pages.push(await createPage(app, {
      path,
      frontmatter: { title: title },
      content: `## ${title}`
    }))
  }
  app.pages.map(({ path, data }) => {
    const searchPath = path.replace('.html', '').replace(`${vault}/`, '')
    return Object.assign(data, {
      backlinks: app.pages.filter(({ links }) =>
        links.filter(({ raw }) => path == raw).length
      ).map(({ title, path, content, contentRendered, excerpt }) => {
        const contents = content.split('\n\n')
        const idx = contents.findIndex(content => content.includes(searchPath))
        const referredContent = contents.slice(idx, idx + 4).join('\n\n')
        const referredContentRendered = app.markdown.render(referredContent)
        return ({ title, path, content, contentRendered, excerpt, referredContent, referredContentRendered })
      })
    })
  })
}
