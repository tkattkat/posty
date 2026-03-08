import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Request, HttpRequest, Tab, HttpResponse, RequestExecutionResult } from '../types'

interface TabSourceContext {
  collectionId?: string
  requestId?: string
}

const createNewHttpRequest = (): HttpRequest => ({
  id: crypto.randomUUID(),
  name: 'New Request',
  type: 'http',
  method: 'GET',
  url: '',
  headers: [],
  params: [],
  body: {
    type: 'none',
    content: '',
  },
  tests: [],
  extractions: [],
})

interface RequestStore {
  tabs: Tab[]
  activeTabId: string | null
  response: HttpResponse | null
  executionResult: RequestExecutionResult | null
  isLoading: boolean

  // Actions
  addTab: (request?: Request, source?: TabSourceContext) => void
  removeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateRequest: (tabId: string, updates: Partial<Request>) => void
  setResponse: (response: HttpResponse | null) => void
  setExecutionResult: (result: RequestExecutionResult | null) => void
  setLoading: (loading: boolean) => void
  getActiveRequest: () => Request | null
  updateActiveRequest: (updates: Partial<Request>) => void
}

export const useRequestStore = create<RequestStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      response: null,
      executionResult: null,
      isLoading: false,

      addTab: (request, source) => {
        // Clone the request and give it a new ID to avoid conflicts
        const baseRequest = request || createNewHttpRequest()
        const sourceRequestId = source?.requestId ?? request?.id
        const newRequest = {
          ...baseRequest,
          id: crypto.randomUUID(), // Always generate a new ID for the tab's request copy
        }
        // Tab ID is separate from request ID - each tab is unique
        const tabId = crypto.randomUUID()
        const newTab: Tab = {
          id: tabId,
          request: newRequest,
          isDirty: false,
          sourceRequestId,
          sourceCollectionId: source?.collectionId,
        }
        set((state) => ({
          tabs: [...state.tabs, newTab],
          activeTabId: tabId,
        }))
      },

      removeTab: (tabId) => {
        set((state) => {
          const tabIndex = state.tabs.findIndex((tab) => tab.id === tabId)
          if (tabIndex === -1) return state

          const newTabs = state.tabs.filter((tab) => tab.id !== tabId)
          let newActiveTabId = state.activeTabId

          if (state.activeTabId === tabId) {
            if (newTabs.length > 0) {
              // Select the tab to the left, or the first one if we were at index 0
              newActiveTabId = newTabs[Math.max(0, tabIndex - 1)].id
            } else {
              newActiveTabId = null
            }
          }

          return { tabs: newTabs, activeTabId: newActiveTabId }
        })
      },

      setActiveTab: (tabId) => {
        set({ activeTabId: tabId, response: null, executionResult: null })
      },

      updateRequest: (tabId, updates) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId
              ? { ...tab, request: { ...tab.request, ...updates } as Request, isDirty: true }
              : tab
          ),
        }))
      },

      setResponse: (response) => {
        set({ response })
      },

      setExecutionResult: (executionResult) => {
        set({ executionResult })
      },

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      getActiveRequest: () => {
        const { tabs, activeTabId } = get()
        const activeTab = tabs.find((tab) => tab.id === activeTabId)
        return activeTab?.request || null
      },

      updateActiveRequest: (updates) => {
        const { activeTabId, updateRequest } = get()
        if (activeTabId) {
          updateRequest(activeTabId, updates)
        }
      },
    }),
    {
      name: 'posty-requests',
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
      }),
    }
  )
)
