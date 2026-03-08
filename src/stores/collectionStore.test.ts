import { describe, it, expect, beforeEach } from 'vitest'
import { useCollectionStore } from './collectionStore'

describe('Collection Store', () => {
  beforeEach(() => {
    useCollectionStore.setState({
      collections: [],
      environments: [],
      activeEnvironmentId: null,
      history: [],
    })
  })

  describe('Collections', () => {
    describe('addCollection', () => {
      it('adds a new collection', () => {
        const { addCollection } = useCollectionStore.getState()
        addCollection('My Collection')

        const state = useCollectionStore.getState()
        expect(state.collections.length).toBe(1)
        expect(state.collections[0].name).toBe('My Collection')
      })

      it('creates collection with empty requests and folders', () => {
        const { addCollection } = useCollectionStore.getState()
        addCollection('New Collection')

        const state = useCollectionStore.getState()
        expect(state.collections[0].requests).toEqual([])
        expect(state.collections[0].folders).toEqual([])
      })

      it('can add subfolder to existing collection', () => {
        const { addCollection } = useCollectionStore.getState()
        addCollection('Parent')

        const state = useCollectionStore.getState()
        const parentId = state.collections[0].id

        addCollection('Child', parentId)

        const newState = useCollectionStore.getState()
        expect(newState.collections[0].folders.length).toBe(1)
        expect(newState.collections[0].folders[0].name).toBe('Child')
      })
    })

    describe('updateCollection', () => {
      it('updates collection properties', () => {
        const { addCollection, updateCollection } = useCollectionStore.getState()
        addCollection('Original')

        const state = useCollectionStore.getState()
        const collectionId = state.collections[0].id

        updateCollection(collectionId, { name: 'Updated', description: 'A description' })

        const newState = useCollectionStore.getState()
        expect(newState.collections[0].name).toBe('Updated')
        expect(newState.collections[0].description).toBe('A description')
      })
    })

    describe('effective base url resolution', () => {
      it('inherits a base url from ancestor folders', () => {
        useCollectionStore.setState({
          collections: [
            {
              id: 'root',
              name: 'Root',
              baseUrl: 'https://api.example.com',
              requests: [],
              folders: [
                {
                  id: 'child',
                  name: 'Child',
                  requests: [
                    {
                      id: 'req-1',
                      name: 'Nested request',
                      type: 'http',
                      method: 'GET',
                      url: '/users',
                      headers: [],
                      params: [],
                      body: { type: 'none', content: '' },
                    },
                  ],
                  folders: [],
                  parentId: 'root',
                },
              ],
            },
          ],
          environments: [],
          activeEnvironmentId: null,
          history: [],
        })

        const state = useCollectionStore.getState()
        expect(state.getEffectiveBaseUrlForCollection('child')).toBe('https://api.example.com')
        expect(state.getEffectiveBaseUrlForRequest('req-1')).toBe('https://api.example.com')
      })

      it('prefers the nearest folder base url override', () => {
        useCollectionStore.setState({
          collections: [
            {
              id: 'root',
              name: 'Root',
              baseUrl: 'https://api.example.com',
              requests: [],
              folders: [
                {
                  id: 'child',
                  name: 'Child',
                  baseUrl: 'https://staging.example.com',
                  requests: [
                    {
                      id: 'req-2',
                      name: 'Nested request',
                      type: 'http',
                      method: 'GET',
                      url: '/users',
                      headers: [],
                      params: [],
                      body: { type: 'none', content: '' },
                    },
                  ],
                  folders: [],
                  parentId: 'root',
                },
              ],
            },
          ],
          environments: [],
          activeEnvironmentId: null,
          history: [],
        })

        const state = useCollectionStore.getState()
        expect(state.getEffectiveBaseUrlForCollection('child')).toBe('https://staging.example.com')
        expect(state.getEffectiveBaseUrlForRequest('req-2')).toBe('https://staging.example.com')
      })
    })

    describe('deleteCollection', () => {
      it('removes the collection', () => {
        const { addCollection, deleteCollection } = useCollectionStore.getState()
        addCollection('To Delete')

        const state = useCollectionStore.getState()
        const collectionId = state.collections[0].id

        deleteCollection(collectionId)

        const newState = useCollectionStore.getState()
        expect(newState.collections.length).toBe(0)
      })
    })

    describe('addRequestToCollection', () => {
      it('adds request to collection', () => {
        const { addCollection, addRequestToCollection } = useCollectionStore.getState()
        addCollection('My Collection')

        const state = useCollectionStore.getState()
        const collectionId = state.collections[0].id

        addRequestToCollection(collectionId, {
          id: 'req-1',
          name: 'Get Users',
          type: 'http',
          method: 'GET',
          url: 'https://api.example.com/users',
          headers: [],
          params: [],
          body: { type: 'none', content: '' },
        })

        const newState = useCollectionStore.getState()
        expect(newState.collections[0].requests.length).toBe(1)
        expect(newState.collections[0].requests[0].name).toBe('Get Users')
      })
    })
  })

  describe('Environments', () => {
    describe('addEnvironment', () => {
      it('adds a new environment', () => {
        const { addEnvironment } = useCollectionStore.getState()
        addEnvironment('Development')

        const state = useCollectionStore.getState()
        expect(state.environments.length).toBe(1)
        expect(state.environments[0].name).toBe('Development')
      })

      it('creates environment with empty variables', () => {
        const { addEnvironment } = useCollectionStore.getState()
        addEnvironment('Production')

        const state = useCollectionStore.getState()
        expect(state.environments[0].variables).toEqual([])
      })
    })

    describe('setActiveEnvironment', () => {
      it('sets the active environment', () => {
        const { addEnvironment, setActiveEnvironment } = useCollectionStore.getState()
        addEnvironment('Dev')
        addEnvironment('Prod')

        const state = useCollectionStore.getState()
        const devId = state.environments[0].id

        setActiveEnvironment(devId)

        const newState = useCollectionStore.getState()
        expect(newState.activeEnvironmentId).toBe(devId)
        expect(newState.environments[0].isActive).toBe(true)
        expect(newState.environments[1].isActive).toBe(false)
      })
    })

    describe('getActiveEnvironment', () => {
      it('returns the active environment', () => {
        const { addEnvironment, setActiveEnvironment, getActiveEnvironment } = useCollectionStore.getState()
        addEnvironment('Active Env')

        const state = useCollectionStore.getState()
        setActiveEnvironment(state.environments[0].id)

        const activeEnv = useCollectionStore.getState().getActiveEnvironment()
        expect(activeEnv?.name).toBe('Active Env')
      })

      it('returns null when no active environment', () => {
        const activeEnv = useCollectionStore.getState().getActiveEnvironment()
        expect(activeEnv).toBeNull()
      })
    })
  })

  describe('History', () => {
    describe('addToHistory', () => {
      it('adds entry to history', () => {
        const { addToHistory } = useCollectionStore.getState()
        addToHistory({
          request: {
            id: 'req-1',
            name: 'Test Request',
            type: 'http',
            method: 'GET',
            url: 'https://api.example.com',
            headers: [],
            params: [],
            body: { type: 'none', content: '' },
          },
          timestamp: Date.now(),
        })

        const state = useCollectionStore.getState()
        expect(state.history.length).toBe(1)
      })

      it('prepends new entries (most recent first)', () => {
        const { addToHistory } = useCollectionStore.getState()

        addToHistory({
          request: {
            id: 'req-1',
            name: 'First',
            type: 'http',
            method: 'GET',
            url: 'https://first.com',
            headers: [],
            params: [],
            body: { type: 'none', content: '' },
          },
          timestamp: 1000,
        })

        addToHistory({
          request: {
            id: 'req-2',
            name: 'Second',
            type: 'http',
            method: 'GET',
            url: 'https://second.com',
            headers: [],
            params: [],
            body: { type: 'none', content: '' },
          },
          timestamp: 2000,
        })

        const state = useCollectionStore.getState()
        expect(state.history[0].request.name).toBe('Second')
        expect(state.history[1].request.name).toBe('First')
      })

      it('limits history to 100 entries', () => {
        const { addToHistory } = useCollectionStore.getState()

        for (let i = 0; i < 110; i++) {
          addToHistory({
            request: {
              id: `req-${i}`,
              name: `Request ${i}`,
              type: 'http',
              method: 'GET',
              url: `https://example${i}.com`,
              headers: [],
              params: [],
              body: { type: 'none', content: '' },
            },
            timestamp: i,
          })
        }

        const state = useCollectionStore.getState()
        expect(state.history.length).toBe(100)
      })
    })

    describe('clearHistory', () => {
      it('clears all history entries', () => {
        const { addToHistory, clearHistory } = useCollectionStore.getState()

        addToHistory({
          request: {
            id: 'req-1',
            name: 'Test',
            type: 'http',
            method: 'GET',
            url: 'https://test.com',
            headers: [],
            params: [],
            body: { type: 'none', content: '' },
          },
          timestamp: Date.now(),
        })

        clearHistory()

        const state = useCollectionStore.getState()
        expect(state.history.length).toBe(0)
      })
    })

    describe('searchHistory', () => {
      it('searches by request name', () => {
        const { addToHistory, searchHistory } = useCollectionStore.getState()

        addToHistory({
          request: {
            id: 'req-1',
            name: 'Get Users',
            type: 'http',
            method: 'GET',
            url: 'https://api.example.com/users',
            headers: [],
            params: [],
            body: { type: 'none', content: '' },
          },
          timestamp: Date.now(),
        })

        addToHistory({
          request: {
            id: 'req-2',
            name: 'Create Post',
            type: 'http',
            method: 'POST',
            url: 'https://api.example.com/posts',
            headers: [],
            params: [],
            body: { type: 'none', content: '' },
          },
          timestamp: Date.now(),
        })

        const results = useCollectionStore.getState().searchHistory('users')
        expect(results.length).toBe(1)
        expect(results[0].request.name).toBe('Get Users')
      })

      it('searches by URL', () => {
        const { addToHistory, searchHistory } = useCollectionStore.getState()

        addToHistory({
          request: {
            id: 'req-1',
            name: 'API Request',
            type: 'http',
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/todos',
            headers: [],
            params: [],
            body: { type: 'none', content: '' },
          },
          timestamp: Date.now(),
        })

        const results = useCollectionStore.getState().searchHistory('jsonplaceholder')
        expect(results.length).toBe(1)
      })
    })
  })

  describe('getAllRequests', () => {
    it('returns all requests from all collections', () => {
      const { addCollection, addRequestToCollection, getAllRequests } = useCollectionStore.getState()

      addCollection('Collection 1')
      addCollection('Collection 2')

      const state = useCollectionStore.getState()

      addRequestToCollection(state.collections[0].id, {
        id: 'req-1',
        name: 'Request 1',
        type: 'http',
        method: 'GET',
        url: 'https://api.example.com/1',
        headers: [],
        params: [],
        body: { type: 'none', content: '' },
      })

      addRequestToCollection(state.collections[1].id, {
        id: 'req-2',
        name: 'Request 2',
        type: 'http',
        method: 'POST',
        url: 'https://api.example.com/2',
        headers: [],
        params: [],
        body: { type: 'none', content: '' },
      })

      const allRequests = useCollectionStore.getState().getAllRequests()
      expect(allRequests.length).toBe(2)
    })
  })
})
