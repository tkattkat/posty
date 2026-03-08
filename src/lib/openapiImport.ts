import type { Collection, HttpRequest, KeyValue } from '../types'

export interface ImportedRequest {
  id: string
  name: string
  method: string
  url: string
  headers: Array<{ id: string; key: string; value: string; enabled: boolean; description?: string }>
  params: Array<{ id: string; key: string; value: string; enabled: boolean; description?: string }>
  body: { type: string; content: string } | null
}

export interface ImportedCollection {
  name: string
  description: string | null
  requests: ImportedRequest[]
  folders: ImportedCollection[]
}

export interface PickedOpenApiFile {
  path: string
}

export function convertImportedCollection(imported: ImportedCollection): Collection {
  return {
    id: crypto.randomUUID(),
    name: imported.name,
    requests: imported.requests.map((req): HttpRequest => ({
      id: req.id,
      type: 'http',
      name: req.name,
      method: req.method as HttpRequest['method'],
      url: req.url,
      headers: req.headers as KeyValue[],
      params: req.params as KeyValue[],
      body: req.body
        ? { type: req.body.type as 'json' | 'text' | 'form' | 'none', content: req.body.content }
        : { type: 'none', content: '' },
    })),
    folders: imported.folders.map(convertImportedCollection),
  }
}

export function convertImportedCollectionContents(imported: ImportedCollection): {
  requests: HttpRequest[]
  folders: Collection[]
} {
  const converted = convertImportedCollection(imported)
  return {
    requests: converted.requests,
    folders: converted.folders,
  }
}

export function countImportedRequests(collection: ImportedCollection): number {
  return collection.requests.length + collection.folders.reduce((sum, folder) => sum + countImportedRequests(folder), 0)
}
