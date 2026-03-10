import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Collection, Request, Environment, HistoryEntry, OpenApiSource } from '../types'

interface CollectionStore {
  collections: Collection[]
  environments: Environment[]
  history: HistoryEntry[]

  // Collection actions
  addCollection: (name: string, parentId?: string) => void
  importCollection: (collection: Collection, source?: OpenApiSource, baseUrl?: string) => void
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
  addEnvironment: (collectionId: string, name: string, baseUrl: string) => void
  updateEnvironment: (id: string, updates: Partial<Environment>) => void
  deleteEnvironment: (id: string) => void
  setActiveEnvironment: (collectionId: string, environmentId: string | null) => void
  getEnvironmentsForCollection: (collectionId: string) => Environment[]
  getActiveEnvironmentForCollection: (collectionId: string) => Environment | null

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
  findRootCollectionForRequest: (requestId: string) => Collection | null
  getActiveEnvironmentForRequest: (requestId: string) => Environment | null
  getAllRequests: () => Request[]
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

function findRootCollection(collectionPath: Collection[] | null): Collection | null {
  if (!collectionPath || collectionPath.length === 0) {
    return null
  }
  return collectionPath[0]
}

export const useCollectionStore = create<CollectionStore>()(
  persist(
    (set, get) => ({
  collections: [],
  environments: [],
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

  importCollection: (collection, source, baseUrl) => {
    const collectionWithSource = source
      ? { ...collection, openApiSource: { ...source, lastUpdated: Date.now() } }
      : collection

    // Auto-create Production environment if baseUrl provided
    const productionEnv: Environment | null = baseUrl ? {
      id: crypto.randomUUID(),
      name: 'Production',
      collectionId: collection.id,
      baseUrl,
      variables: [],
    } : null

    const collectionWithActiveEnv = productionEnv
      ? { ...collectionWithSource, activeEnvironmentId: productionEnv.id }
      : collectionWithSource

    set((state) => ({
      collections: [...state.collections, collectionWithActiveEnv],
      environments: productionEnv ? [...state.environments, productionEnv] : state.environments,
    }))
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
  addEnvironment: (collectionId, name, baseUrl) => {
    const newEnv: Environment = {
      id: crypto.randomUUID(),
      name,
      collectionId,
      baseUrl,
      variables: [],
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
    set((state) => {
      const envToDelete = state.environments.find((env) => env.id === id)
      if (!envToDelete) return state

      // Clear activeEnvironmentId on collection if this was the active one
      const updateCollections = (cols: Collection[]): Collection[] =>
        cols.map((col) => {
          const updated = col.activeEnvironmentId === id
            ? { ...col, activeEnvironmentId: undefined }
            : col
          return { ...updated, folders: updateCollections(col.folders) }
        })

      return {
        environments: state.environments.filter((env) => env.id !== id),
        collections: updateCollections(state.collections),
      }
    })
  },

  setActiveEnvironment: (collectionId, environmentId) => {
    set((state) => {
      const updateCollections = (cols: Collection[]): Collection[] =>
        cols.map((col) =>
          col.id === collectionId
            ? { ...col, activeEnvironmentId: environmentId ?? undefined }
            : { ...col, folders: updateCollections(col.folders) }
        )
      return { collections: updateCollections(state.collections) }
    })
  },

  getEnvironmentsForCollection: (collectionId) => {
    const { environments } = get()
    return environments.filter((env) => env.collectionId === collectionId)
  },

  getActiveEnvironmentForCollection: (collectionId) => {
    const { findCollectionById, environments } = get()
    const collection = findCollectionById(collectionId)
    if (!collection?.activeEnvironmentId) return null
    return environments.find((env) => env.id === collection.activeEnvironmentId) || null
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

  findRootCollectionForRequest: (requestId) => {
    const { collections } = get()
    return findRootCollection(findCollectionPathForRequest(collections, requestId))
  },

  getActiveEnvironmentForRequest: (requestId) => {
    const { findRootCollectionForRequest, environments } = get()
    const rootCollection = findRootCollectionForRequest(requestId)
    if (!rootCollection?.activeEnvironmentId) return null
    return environments.find((env) => env.id === rootCollection.activeEnvironmentId) || null
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
        history: state.history,
      }),
    }
  )
)
