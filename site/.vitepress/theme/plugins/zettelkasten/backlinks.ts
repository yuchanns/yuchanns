import { collection } from './collection'
import type { PageData } from 'vitepress'

const sdbm = (str: string) => {
  let arr = str.split('');
  return arr.reduce(
    (hashCode: number, currentVal: string) =>
      (hashCode = currentVal.charCodeAt(0) + (hashCode << 6) + (hashCode << 16) - hashCode),
    0
  );
};

// NOTE: collection here is lazy collected during the dev runtime.
// it won't generate the backlink references information until you visit the
// page.
export const getBacklinks = async (pageData: PageData) => {
  const relativePath = `/${pageData.relativePath.replace('.md', '')}`
  if (!collection.has(relativePath)) {
    return []
  }
  return collection.get(relativePath).sort(({ title: a }, { title: b }) => sdbm(b) - sdbm(a))
}
