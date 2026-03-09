import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Collection, Request, Environment, HistoryEntry, OpenApiSource } from '../types'

interface CollectionStore {
  collections: Collection[]
  environments: Environment[]
  activeEnvironmentId: string | null
  history: HistoryEntry[]

  // Collection actions
  addCollection: (name: string, parentId?: string) => void
  importCollection: (collection: Collection, source?: OpenApiSource) => void
  updateCollection: (id: string, updates: Partial<Collection>) => void
  updateRequestInCollection: (requestId: string, updates: Partial<Request>) => void
  deleteCollection: (id: string) => void
  moveCollection: (draggedId: string, targetId: string) => void
  addRequestToCollection: (collectionId: string, request: Request) => void
  removeRequestFromCollection: (collectionId: string, requestId: string) => void
  refreshCollectionFromSource: (
    id: string,
    newRequests: Request[],
    newFolders: Collection[],
    sourceUpdates?: Partial<OpenApiSource>
  ) => void

  // Environment actions
  addEnvironment: (name: string) => void
  updateEnvironment: (id: string, updates: Partial<Environment>) => void
  deleteEnvironment: (id: string) => void
  setActiveEnvironment: (id: string | null) => void
  getActiveEnvironment: () => Environment | null

  // History actions
  addToHistory: (entry: Omit<HistoryEntry, 'id'>) => void
  clearHistory: () => void
  searchHistory: (query: string) => HistoryEntry[]

  // Request actions
  moveRequest: (requestId: string, fromCollectionId: string, toCollectionId: string) => void
  duplicateRequest: (collectionId: string, requestId: string) => void

  // Duplicate
  duplicateCollection: (collectionId: string) => void

  // Helpers
  findCollectionById: (id: string) => Collection | null
  findCollectionByRequestId: (requestId: string) => Collection | null
  getEffectiveBaseUrlForCollection: (collectionId: string) => string | undefined
  getEffectiveBaseUrlForRequest: (requestId: string) => string | undefined
  getAllRequests: () => Request[]
}

function findCollectionPathById(collections: Collection[], targetId: string, ancestors: Collection[] = []): Collection[] | null {
  for (const collection of collections) {
    const nextAncestors = [...ancestors, collection]
    if (collection.id === targetId) {
      return nextAncestors
    }

    const nestedPath = findCollectionPathById(collection.folders, targetId, nextAncestors)
    if (nestedPath) {
      return nestedPath
    }
  }

  return null
}

function findCollectionPathForRequest(collections: Collection[], requestId: string, ancestors: Collection[] = []): Collection[] | null {
  for (const collection of collections) {
    const nextAncestors = [...ancestors, collection]
    if (collection.requests.some((request) => request.id === requestId)) {
      return nextAncestors
    }

    const nestedPath = findCollectionPathForRequest(collection.folders, requestId, nextAncestors)
    if (nestedPath) {
      return nestedPath
    }
  }

  return null
}

function resolveEffectiveBaseUrl(collectionPath: Collection[] | null): string | undefined {
  if (!collectionPath) {
    return undefined
  }

  for (let index = collectionPath.length - 1; index >= 0; index -= 1) {
    const baseUrl = collectionPath[index].baseUrl?.trim()
    if (baseUrl) {
      return baseUrl
    }
  }

  return undefined
}

export const useCollectionStore = create<CollectionStore>()(
  persist(
    (set, get) => ({
  collections: [],
  environments: [],
  activeEnvironmentId: null,
  history: [],

  // Collection actions
  addCollection: (name, parentId) => {
    const newCollection: Collection = {
      id: crypto.randomUUID(),
      name,
      secrets: [],
      requests: [],
      folders: [],
      parentId,
    }

    set((state) => {
      if (parentId) {
        // Add as subfolder
        const updateCollections = (cols: Collection[]): Collection[] =>
          cols.map((col) =>
            col.id === parentId
              ? { ...col, folders: [...col.folders, newCollection] }
              : { ...col, folders: updateCollections(col.folders) }
          )
        return { collections: updateCollections(state.collections) }
      }
      return { collections: [...state.collections, newCollection] }
    })
  },

  importCollection: (collection, source) => {
    const collectionWithSource = source
      ? { ...collection, openApiSource: { ...source, lastUpdated: Date.now() } }
      : collection
    set((state) => ({ collections: [...state.collections, collectionWithSource] }))
  },

  updateCollection: (id, updates) => {
    set((state) => {
      const updateCollections = (cols: Collection[]): Collection[] =>
        cols.map((col) =>
          col.id === id
            ? { ...col, ...updates }
            : { ...col, folders: updateCollections(col.folders) }
        )
      return { collections: updateCollections(state.collections) }
    })
  },

  updateRequestInCollection: (requestId, updates) => {
    set((state) => {
      const updateCollections = (cols: Collection[]): Collection[] =>
        cols.map((col) => {
          const updatedRequests = col.requests.map((request) =>
            request.id === requestId
              ? { ...request, ...updates } as Request
              : request
          )

          const updatedFolders = updateCollections(col.folders)
          const requestsChanged = updatedRequests.some((request, index) => request !== col.requests[index])
          const foldersChanged = updatedFolders !== col.folders

          return requestsChanged || foldersChanged
            ? { ...col, requests: updatedRequests, folders: updatedFolders }
            : col
        })

      return { collections: updateCollections(state.collections) }
    })
  },

  deleteCollection: (id) => {
    set((state) => {
      const filterCollections = (cols: Collection[]): Collection[] =>
        cols
          .filter((col) => col.id !== id)
          .map((col) => ({ ...col, folders: filterCollections(col.folders) }))
      return { collections: filterCollections(state.collections) }
    })
  },

  moveCollection: (draggedId, targetId) => {
    if (draggedId === targetId) return

    set((state) => {
      let moved = false

      const moveInCollections = (cols: Collection[]): Collection[] => {
        if (moved) return cols

        const draggedIndex = cols.findIndex((col) => col.id === draggedId)
        const targetIndex = cols.findIndex((col) => col.id === targetId)

        if (draggedIndex !== -1 && targetIndex !== -1) {
          const next = [...cols]
          const [dragged] = next.splice(draggedIndex, 1)
          const insertIndex = draggedIndex < targetIndex ? targetIndex : targetIndex
          next.splice(insertIndex, 0, dragged)
          moved = true
          return next
        }

        return cols.map((col) => {
          const nextFolders = moveInCollections(col.folders)
          return nextFolders === col.folders ? col : { ...col, folders: nextFolders }
        })
      }

      return { collections: moveInCollections(state.collections) }
    })
  },

  addRequestToCollection: (collectionId, request) => {
    set((state) => {
      const updateCollections = (cols: Collection[]): Collection[] =>
        cols.map((col) =>
          col.id === collectionId
            ? { ...col, requests: [...col.requests, request] }
            : { ...col, folders: updateCollections(col.folders) }
        )
      return { collections: updateCollections(state.collections) }
    })
  },

  removeRequestFromCollection: (collectionId, requestId) => {
    set((state) => {
      const updateCollections = (cols: Collection[]): Collection[] =>
        cols.map((col) =>
          col.id === collectionId
            ? { ...col, requests: col.requests.filter((r) => r.id !== requestId) }
            : { ...col, folders: updateCollections(col.folders) }
        )
      return { collections: updateCollections(state.collections) }
    })
  },

  refreshCollectionFromSource: (id, newRequests, newFolders, sourceUpdates) => {
    set((state) => {
      const updateCollections = (cols: Collection[]): Collection[] =>
        cols.map((col) =>
          col.id === id
            ? {
                ...col,
                requests: newRequests,
                folders: newFolders,
                openApiSource: col.openApiSource
                  ? { ...col.openApiSource, ...sourceUpdates, lastUpdated: Date.now() }
                  : undefined,
              }
            : { ...col, folders: updateCollections(col.folders) }
        )
      return { collections: updateCollections(state.collections) }
    })
  },

  // Request actions
  moveRequest: (requestId, fromCollectionId, toCollectionId) => {
    if (fromCollectionId === toCollectionId) return

    set((state) => {
      let movedRequest: Request | null = null

      // First pass: find and remove the request
      const removeRequest = (cols: Collection[]): Collection[] =>
        cols.map((col) => {
          if (col.id === fromCollectionId) {
            const request = col.requests.find((r) => r.id === requestId)
            if (request) {
              movedRequest = request
              return { ...col, requests: col.requests.filter((r) => r.id !== requestId) }
            }
          }
          return { ...col, folders: removeRequest(col.folders) }
        })

      const collectionsAfterRemove = removeRequest(state.collections)

      if (!movedRequest) return state

      // Second pass: add to target collection
      const addRequest = (cols: Collection[]): Collection[] =>
        cols.map((col) =>
          col.id === toCollectionId
            ? { ...col, requests: [...col.requests, movedRequest!] }
            : { ...col, folders: addRequest(col.folders) }
        )

      return { collections: addRequest(collectionsAfterRemove) }
    })
  },

  duplicateRequest: (collectionId, requestId) => {
    set((state) => {
      const updateCollections = (cols: Collection[]): Collection[] =>
        cols.map((col) => {
          if (col.id === collectionId) {
            const request = col.requests.find((r) => r.id === requestId)
            if (request) {
              const duplicated = {
                ...request,
                id: crypto.randomUUID(),
                name: `${request.name} (copy)`,
              }
              return { ...col, requests: [...col.requests, duplicated] }
            }
          }
          return { ...col, folders: updateCollections(col.folders) }
        })
      return { collections: updateCollections(state.collections) }
    })
  },

  duplicateCollection: (collectionId) => {
    const { findCollectionById } = get()
    const original = findCollectionById(collectionId)
    if (!original) return

    // Deep clone with new IDs
    const cloneCollection = (col: Collection): Collection => ({
      ...col,
      id: crypto.randomUUID(),
      name: `${col.name} (copy)`,
      requests: col.requests.map((req) => ({ ...req, id: crypto.randomUUID() })),
      folders: col.folders.map(cloneCollection),
      openApiSource: undefined, // Don't copy OpenAPI source
    })

    const duplicated = cloneCollection(original)

    set((state) => {
      // Find parent and add duplicate as sibling
      const addDuplicate = (cols: Collection[]): Collection[] => {
        const index = cols.findIndex((c) => c.id === collectionId)
        if (index !== -1) {
          const next = [...cols]
          next.splice(index + 1, 0, duplicated)
          return next
        }
        return cols.map((col) => ({ ...col, folders: addDuplicate(col.folders) }))
      }
      return { collections: addDuplicate(state.collections) }
    })
  },

  // Environment actions
  addEnvironment: (name) => {
    const newEnv: Environment = {
      id: crypto.randomUUID(),
      name,
      variables: [],
      isActive: false,
    }
    set((state) => ({ environments: [...state.environments, newEnv] }))
  },

  updateEnvironment: (id, updates) => {
    set((state) => ({
      environments: state.environments.map((env) =>
        env.id === id ? { ...env, ...updates } : env
      ),
    }))
  },

  deleteEnvironment: (id) => {
    set((state) => ({
      environments: state.environments.filter((env) => env.id !== id),
      activeEnvironmentId: state.activeEnvironmentId === id ? null : state.activeEnvironmentId,
    }))
  },

  setActiveEnvironment: (id) => {
    set((state) => ({
      activeEnvironmentId: id,
      environments: state.environments.map((env) => ({
        ...env,
        isActive: env.id === id,
      })),
    }))
  },

  getActiveEnvironment: () => {
    const { environments, activeEnvironmentId } = get()
    return environments.find((env) => env.id === activeEnvironmentId) || null
  },

  // History actions
  addToHistory: (entry) => {
    const newEntry: HistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
    }
    set((state) => ({
      history: [newEntry, ...state.history].slice(0, 100), // Keep last 100
    }))
  },

  clearHistory: () => {
    set({ history: [] })
  },

  searchHistory: (query) => {
    const { history } = get()
    const lowerQuery = query.toLowerCase()
    return history.filter(
      (entry) =>
        entry.request.name.toLowerCase().includes(lowerQuery) ||
        ('url' in entry.request && entry.request.url.toLowerCase().includes(lowerQuery))
    )
  },

  // Helpers
  findCollectionById: (id) => {
    const { collections } = get()
    const findInCollections = (cols: Collection[]): Collection | null => {
      for (const col of cols) {
        if (col.id === id) return col
        const found = findInCollections(col.folders)
        if (found) return found
      }
      return null
    }
    return findInCollections(collections)
  },

  findCollectionByRequestId: (requestId) => {
    const { collections } = get()
    const findInCollections = (cols: Collection[]): Collection | null => {
      for (const col of cols) {
        if (col.requests.some((request) => request.id === requestId)) {
          return col
        }

        const found = findInCollections(col.folders)
        if (found) return found
      }
      return null
    }

    return findInCollections(collections)
  },

  getEffectiveBaseUrlForCollection: (collectionId) => {
    const { collections } = get()
    return resolveEffectiveBaseUrl(findCollectionPathById(collections, collectionId))
  },

  getEffectiveBaseUrlForRequest: (requestId) => {
    const { collections } = get()
    return resolveEffectiveBaseUrl(findCollectionPathForRequest(collections, requestId))
  },

  getAllRequests: () => {
    const { collections } = get()
    const requests: Request[] = []
    const collectRequests = (cols: Collection[]) => {
      for (const col of cols) {
        requests.push(...col.requests)
        collectRequests(col.folders)
      }
    }
    collectRequests(collections)
    return requests
  },
    }),
    {
      name: 'posty-collections',
      partialize: (state) => ({
        collections: state.collections,
        environments: state.environments,
        activeEnvironmentId: state.activeEnvironmentId,
        history: state.history,
      }),
    }
  )
)
