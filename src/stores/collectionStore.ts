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
  deleteCollection: (id: string) => void
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

  // Helpers
  findCollectionById: (id: string) => Collection | null
  findCollectionByRequestId: (requestId: string) => Collection | null
  getAllRequests: () => Request[]
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

  deleteCollection: (id) => {
    set((state) => {
      const filterCollections = (cols: Collection[]): Collection[] =>
        cols
          .filter((col) => col.id !== id)
          .map((col) => ({ ...col, folders: filterCollections(col.folders) }))
      return { collections: filterCollections(state.collections) }
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
