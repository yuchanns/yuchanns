const r = new RegExp('^(?:[a-z]+:)?//', 'i')

export const isRelativeURL = (url: string): boolean => {
  return !r.test(url)
}
