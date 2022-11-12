export interface BacklinkPageInfo {
  title: string,
  path: string,
  content: string
}

export const collection: Map<string, BacklinkPageInfo[]> = new Map()
