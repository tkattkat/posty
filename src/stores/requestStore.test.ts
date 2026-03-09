import { describe, it, expect, beforeEach } from 'vitest'
import { useRequestStore } from './requestStore'
import type { HttpRequest } from '../types'

describe('Request Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useRequestStore.setState({
      tabs: [],
      activeTabId: null,
      tabResponses: {},
      tabExecutionResults: {},
      isLoading: false,
    })
  })

  describe('addTab', () => {
    it('adds a new tab with default request', () => {
      const { addTab } = useRequestStore.getState()
      addTab()

      const state = useRequestStore.getState()
      expect(state.tabs.length).toBe(1)
      expect(state.tabs[0].request.type).toBe('http')
      expect((state.tabs[0].request as HttpRequest).method).toBe('GET')
      expect(state.activeTabId).toBe(state.tabs[0].id)
    })

    it('sets the new tab as active', () => {
      const { addTab } = useRequestStore.getState()
      addTab()

      const state = useRequestStore.getState()
      expect(state.activeTabId).toBe(state.tabs[0].id)
    })

    it('can add a tab with custom request', () => {
      const { addTab } = useRequestStore.getState()
      addTab({
        id: 'custom-id',
        name: 'Custom Request',
        type: 'http',
        method: 'POST',
        url: 'https://api.example.com',
        headers: [],
        params: [],
        cookies: [],
        body: { type: 'json', content: '{}' },
      })

      const state = useRequestStore.getState()
      expect(state.tabs[0].request.name).toBe('Custom Request')
      expect((state.tabs[0].request as HttpRequest).method).toBe('POST')
    })
  })

  describe('removeTab', () => {
    it('removes the specified tab', () => {
      const { addTab, removeTab } = useRequestStore.getState()
      addTab()
      addTab()

      let state = useRequestStore.getState()
      const tabToRemove = state.tabs[0].id

      removeTab(tabToRemove)

      state = useRequestStore.getState()
      expect(state.tabs.length).toBe(1)
      expect(state.tabs.find((t) => t.id === tabToRemove)).toBeUndefined()
    })

    it('sets next tab as active when removing active tab', () => {
      const { addTab, removeTab, setActiveTab } = useRequestStore.getState()
      addTab()
      addTab()
      addTab()

      let state = useRequestStore.getState()
      const firstTabId = state.tabs[0].id
      const secondTabId = state.tabs[1].id

      setActiveTab(firstTabId)
      removeTab(firstTabId)

      state = useRequestStore.getState()
      expect(state.activeTabId).toBe(secondTabId)
    })

    it('sets activeTabId to null when removing last tab', () => {
      const { addTab, removeTab } = useRequestStore.getState()
      addTab()

      const state = useRequestStore.getState()
      removeTab(state.tabs[0].id)

      const newState = useRequestStore.getState()
      expect(newState.tabs.length).toBe(0)
      expect(newState.activeTabId).toBeNull()
    })
  })

  describe('updateRequest', () => {
    it('updates the request properties', () => {
      const { addTab, updateRequest } = useRequestStore.getState()
      addTab()

      const state = useRequestStore.getState()
      const tabId = state.tabs[0].id

      updateRequest(tabId, { url: 'https://updated.com' })

      const newState = useRequestStore.getState()
      expect(newState.tabs[0].request.url).toBe('https://updated.com')
    })

    it('marks tab as dirty after update', () => {
      const { addTab, updateRequest } = useRequestStore.getState()
      addTab()

      const state = useRequestStore.getState()
      const tabId = state.tabs[0].id

      updateRequest(tabId, { name: 'Updated Name' })

      const newState = useRequestStore.getState()
      expect(newState.tabs[0].isDirty).toBe(true)
    })
  })

  describe('getActiveRequest', () => {
    it('returns the active request', () => {
      const { addTab, getActiveRequest } = useRequestStore.getState()
      addTab()

      const activeRequest = useRequestStore.getState().getActiveRequest()
      expect(activeRequest).not.toBeNull()
      expect(activeRequest?.type).toBe('http')
    })

    it('returns null when no active tab', () => {
      const activeRequest = useRequestStore.getState().getActiveRequest()
      expect(activeRequest).toBeNull()
    })
  })

  describe('setResponse', () => {
    it('stores the response per tab', () => {
      // First add a tab so we have an activeTabId
      const { addTab, setResponse } = useRequestStore.getState()
      addTab()
      const activeTabId = useRequestStore.getState().activeTabId!

      setResponse({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{"success": true}',
        time: 150,
        size: 18,
      })

      const state = useRequestStore.getState()
      expect(state.tabResponses[activeTabId]?.status).toBe(200)
      expect(state.tabResponses[activeTabId]?.body).toBe('{"success": true}')
    })
  })

  describe('setLoading', () => {
    it('updates loading state', () => {
      const { setLoading } = useRequestStore.getState()

      setLoading(true)
      expect(useRequestStore.getState().isLoading).toBe(true)

      setLoading(false)
      expect(useRequestStore.getState().isLoading).toBe(false)
    })
  })
})
