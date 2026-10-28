import type { MindMapDoc } from './mindmap.types'

export interface Folder {
  id: string
  name: string
  parentId: string | null
}

export interface MapMeta {
  id: string
  name: string
  folderId: string | null
  createdAt: number
}

export interface Library {
  folders: Record<string, Folder>
  maps: Record<string, MapMeta>
  lastOpenedId: string | null
}

export interface LibraryTree {
  folders: Folder[]
  maps: (Omit<MapMeta, 'createdAt'> & { doc: MindMapDoc })[]
}
