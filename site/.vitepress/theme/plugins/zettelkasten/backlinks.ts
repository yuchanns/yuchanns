import { collection } from './collection'
import type { PageData } from 'vitepress'

// NOTE: collection here is lazy collected during the dev runtime.
// it won't generate the backlink references information until you visit the
// page.
export const getBacklinks = async (pageData: PageData) => {
  const relativePath = `/${pageData.relativePath.replace('.md', '')}`
  if (!collection.has(relativePath)) {
    return []
  }
  return collection.get(relativePath)
}
