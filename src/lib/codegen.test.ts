import { describe, it, expect } from 'vitest'
import { generateCode, CodeLanguage } from './codegen'
import type { HttpRequest } from '../types'

const createBasicRequest = (): HttpRequest => ({
  id: 'test-id',
  name: 'Test Request',
  type: 'http',
  method: 'GET',
  url: 'https://api.example.com/users',
  headers: [],
  params: [],
  body: {
    type: 'none',
    content: '',
  },
})

describe('Code Generator', () => {
  describe('cURL', () => {
    it('generates basic GET request', () => {
      const request = createBasicRequest()
      const code = generateCode({ request, language: 'curl' })

      expect(code).toContain('curl')
      expect(code).toContain('https://api.example.com/users')
      expect(code).not.toContain('-X GET') // GET is default
    })

    it('generates POST request with method', () => {
      const request = createBasicRequest()
      request.method = 'POST'
      const code = generateCode({ request, language: 'curl' })

      expect(code).toContain('-X POST')
    })

    it('includes headers', () => {
      const request = createBasicRequest()
      request.headers = [
        { id: '1', key: 'Authorization', value: 'Bearer token123', enabled: true },
        { id: '2', key: 'X-Custom', value: 'value', enabled: true },
      ]
      const code = generateCode({ request, language: 'curl' })

      expect(code).toContain("-H 'Authorization: Bearer token123'")
      expect(code).toContain("-H 'X-Custom: value'")
    })

    it('includes query parameters in URL', () => {
      const request = createBasicRequest()
      request.params = [
        { id: '1', key: 'page', value: '1', enabled: true },
        { id: '2', key: 'limit', value: '10', enabled: true },
      ]
      const code = generateCode({ request, language: 'curl' })

      expect(code).toContain('page=1')
      expect(code).toContain('limit=10')
    })

    it('includes JSON body', () => {
      const request = createBasicRequest()
      request.method = 'POST'
      request.body = {
        type: 'json',
        content: '{"name": "test"}',
      }
      const code = generateCode({ request, language: 'curl' })

      expect(code).toContain("-H 'Content-Type: application/json'")
      expect(code).toContain('{"name": "test"}')
    })

    it('handles bearer auth', () => {
      const request = createBasicRequest()
      request.auth = {
        type: 'bearer',
        token: 'my-token',
      }
      const code = generateCode({ request, language: 'curl' })

      expect(code).toContain('Authorization: Bearer my-token')
    })

    it('handles basic auth', () => {
      const request = createBasicRequest()
      request.auth = {
        type: 'basic',
        username: 'user',
        password: 'pass',
      }
      const code = generateCode({ request, language: 'curl' })

      expect(code).toContain("-u 'user:pass'")
    })
  })

  describe('JavaScript', () => {
    it('generates fetch call', () => {
      const request = createBasicRequest()
      const code = generateCode({ request, language: 'javascript' })

      expect(code).toContain('fetch')
      expect(code).toContain('https://api.example.com/users')
      expect(code).toContain("method: 'GET'")
    })

    it('includes headers object', () => {
      const request = createBasicRequest()
      request.headers = [{ id: '1', key: 'Accept', value: 'application/json', enabled: true }]
      const code = generateCode({ request, language: 'javascript' })

      expect(code).toContain('headers:')
      expect(code).toContain('Accept')
    })

    it('includes JSON body with stringify', () => {
      const request = createBasicRequest()
      request.method = 'POST'
      request.body = { type: 'json', content: '{"test": true}' }
      const code = generateCode({ request, language: 'javascript' })

      expect(code).toContain('JSON.stringify')
    })
  })

  describe('Python', () => {
    it('generates requests call', () => {
      const request = createBasicRequest()
      const code = generateCode({ request, language: 'python' })

      expect(code).toContain('import requests')
      expect(code).toContain('requests.get')
    })

    it('uses correct method', () => {
      const request = createBasicRequest()
      request.method = 'POST'
      const code = generateCode({ request, language: 'python' })

      expect(code).toContain('requests.post')
    })

    it('includes params dict', () => {
      const request = createBasicRequest()
      request.params = [{ id: '1', key: 'search', value: 'test', enabled: true }]
      const code = generateCode({ request, language: 'python' })

      expect(code).toContain('params=params')
      expect(code).toContain('"search"')
    })
  })

  describe('Go', () => {
    it('generates http request', () => {
      const request = createBasicRequest()
      const code = generateCode({ request, language: 'go' })

      expect(code).toContain('package main')
      expect(code).toContain('net/http')
      expect(code).toContain('http.NewRequest')
    })
  })

  describe('Rust', () => {
    it('generates reqwest code', () => {
      const request = createBasicRequest()
      const code = generateCode({ request, language: 'rust' })

      expect(code).toContain('use reqwest')
      expect(code).toContain('reqwest::Client::new()')
      expect(code).toContain('.get(')
    })
  })

  describe('PHP', () => {
    it('generates curl code', () => {
      const request = createBasicRequest()
      const code = generateCode({ request, language: 'php' })

      expect(code).toContain('<?php')
      expect(code).toContain('curl_init')
      expect(code).toContain('curl_exec')
    })
  })

  describe('Disabled items', () => {
    it('excludes disabled headers', () => {
      const request = createBasicRequest()
      request.headers = [
        { id: '1', key: 'Enabled', value: 'yes', enabled: true },
        { id: '2', key: 'Disabled', value: 'no', enabled: false },
      ]
      const code = generateCode({ request, language: 'curl' })

      expect(code).toContain('Enabled')
      expect(code).not.toContain('Disabled')
    })

    it('excludes disabled params', () => {
      const request = createBasicRequest()
      request.params = [
        { id: '1', key: 'active', value: '1', enabled: true },
        { id: '2', key: 'inactive', value: '0', enabled: false },
      ]
      const code = generateCode({ request, language: 'curl' })

      expect(code).toContain('active=1')
      expect(code).not.toContain('inactive')
    })
  })
})
