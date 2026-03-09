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
  cookies: [],
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
  // Per-tab response and execution results
  tabResponses: Record<string, HttpResponse | null>
  tabExecutionResults: Record<string, RequestExecutionResult | null>
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
  getResponse: () => HttpResponse | null
  getExecutionResult: () => RequestExecutionResult | null
  duplicateActiveTab: () => void
}

export const useRequestStore = create<RequestStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      tabResponses: {},
      tabExecutionResults: {},
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

          // Clean up response data for removed tab
          const { [tabId]: _removedResponse, ...remainingResponses } = state.tabResponses
          const { [tabId]: _removedResult, ...remainingResults } = state.tabExecutionResults

          return {
            tabs: newTabs,
            activeTabId: newActiveTabId,
            tabResponses: remainingResponses,
            tabExecutionResults: remainingResults,
          }
        })
      },

      setActiveTab: (tabId) => {
        set({ activeTabId: tabId })
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
        const { activeTabId } = get()
        if (!activeTabId) return
        set((state) => ({
          tabResponses: { ...state.tabResponses, [activeTabId]: response },
        }))
      },

      setExecutionResult: (executionResult) => {
        const { activeTabId } = get()
        if (!activeTabId) return
        set((state) => ({
          tabExecutionResults: { ...state.tabExecutionResults, [activeTabId]: executionResult },
        }))
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

      getResponse: () => {
        const { activeTabId, tabResponses } = get()
        return activeTabId ? tabResponses[activeTabId] ?? null : null
      },

      getExecutionResult: () => {
        const { activeTabId, tabExecutionResults } = get()
        return activeTabId ? tabExecutionResults[activeTabId] ?? null : null
      },

      duplicateActiveTab: () => {
        const { tabs, activeTabId, addTab } = get()
        const activeTab = tabs.find((tab) => tab.id === activeTabId)
        if (activeTab) {
          const duplicatedRequest = {
            ...activeTab.request,
            id: crypto.randomUUID(),
            name: `${activeTab.request.name} (copy)`,
          }
          addTab(duplicatedRequest, {
            collectionId: activeTab.sourceCollectionId,
            requestId: activeTab.sourceRequestId,
          })
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
