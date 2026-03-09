import { describe, it, expect } from 'vitest'
import { parseCurl, curlToHttpRequest, isCurlCommand } from './curlParser'

describe('Curl Parser', () => {
  describe('isCurlCommand', () => {
    it('detects curl commands', () => {
      expect(isCurlCommand('curl https://api.example.com')).toBe(true)
      expect(isCurlCommand('CURL https://api.example.com')).toBe(true)
      expect(isCurlCommand('  curl https://api.example.com')).toBe(true)
    })

    it('rejects non-curl commands', () => {
      expect(isCurlCommand('https://api.example.com')).toBe(false)
      expect(isCurlCommand('wget https://api.example.com')).toBe(false)
      expect(isCurlCommand('not a curl command')).toBe(false)
    })
  })

  describe('parseCurl', () => {
    it('parses basic GET request', () => {
      const result = parseCurl('curl https://api.example.com/users')
      expect(result).not.toBeNull()
      expect(result?.method).toBe('GET')
      expect(result?.url).toBe('https://api.example.com/users')
    })

    it('parses explicit method', () => {
      const result = parseCurl('curl -X POST https://api.example.com/users')
      expect(result?.method).toBe('POST')
    })

    it('parses --request flag', () => {
      const result = parseCurl('curl --request DELETE https://api.example.com/users/1')
      expect(result?.method).toBe('DELETE')
    })

    it('parses headers with -H flag', () => {
      const result = parseCurl(`curl -H 'Content-Type: application/json' -H 'Accept: application/json' https://api.example.com`)
      expect(result?.headers).toHaveLength(2)
      expect(result?.headers[0].key).toBe('Content-Type')
      expect(result?.headers[0].value).toBe('application/json')
    })

    it('parses authorization bearer header', () => {
      const result = parseCurl(`curl -H 'Authorization: Bearer my-secret-token' https://api.example.com`)
      expect(result?.auth?.type).toBe('bearer')
      expect(result?.auth?.token).toBe('my-secret-token')
    })

    it('parses basic auth with -u flag', () => {
      const result = parseCurl(`curl -u username:password https://api.example.com`)
      expect(result?.auth?.type).toBe('basic')
      expect(result?.auth?.username).toBe('username')
      expect(result?.auth?.password).toBe('password')
    })

    it('parses JSON body with -d flag', () => {
      const result = parseCurl(`curl -d '{"name": "test"}' https://api.example.com`)
      expect(result?.method).toBe('POST') // Auto-set to POST
      expect(result?.body?.type).toBe('json')
      expect(result?.body?.content).toBe('{"name": "test"}')
    })

    it('parses multiline curl with backslashes', () => {
      const result = parseCurl(`curl \\
        -X POST \\
        -H 'Content-Type: application/json' \\
        -d '{"key": "value"}' \\
        https://api.example.com/data`)

      expect(result?.method).toBe('POST')
      expect(result?.headers[0].key).toBe('Content-Type')
      expect(result?.body?.content).toBe('{"key": "value"}')
    })

    it('parses double-quoted strings', () => {
      const result = parseCurl(`curl -H "Authorization: Bearer token123" "https://api.example.com"`)
      expect(result?.auth?.token).toBe('token123')
      expect(result?.url).toBe('https://api.example.com')
    })

    it('returns null for non-curl input', () => {
      expect(parseCurl('not a curl command')).toBeNull()
      expect(parseCurl('https://example.com')).toBeNull()
    })

    it('returns null for curl without URL', () => {
      expect(parseCurl('curl -H "Test: value"')).toBeNull()
    })

    it('parses cookies with -b flag', () => {
      const result = parseCurl(`curl -b 'session=abc123; user=john' https://api.example.com`)
      expect(result?.cookies).toHaveLength(2)
      expect(result?.cookies[0].key).toBe('session')
      expect(result?.cookies[0].value).toBe('abc123')
      expect(result?.cookies[1].key).toBe('user')
      expect(result?.cookies[1].value).toBe('john')
    })

    it('parses cookies with --cookie flag', () => {
      const result = parseCurl(`curl --cookie 'token=xyz789' https://api.example.com`)
      expect(result?.cookies).toHaveLength(1)
      expect(result?.cookies[0].key).toBe('token')
      expect(result?.cookies[0].value).toBe('xyz789')
    })

    it('parses Cookie header into cookies array', () => {
      const result = parseCurl(`curl -H 'Cookie: auth=secret; theme=dark' https://api.example.com`)
      expect(result?.cookies).toHaveLength(2)
      expect(result?.cookies[0].key).toBe('auth')
      expect(result?.cookies[0].value).toBe('secret')
      expect(result?.cookies[1].key).toBe('theme')
      expect(result?.cookies[1].value).toBe('dark')
      // Cookie header should not be in headers array
      expect(result?.headers).toHaveLength(0)
    })

    it('handles cookies with values containing equals sign', () => {
      const result = parseCurl(`curl -b 'data=key=value' https://api.example.com`)
      expect(result?.cookies).toHaveLength(1)
      expect(result?.cookies[0].key).toBe('data')
      expect(result?.cookies[0].value).toBe('key=value')
    })
  })

  describe('curlToHttpRequest', () => {
    it('converts curl to HttpRequest', () => {
      const result = curlToHttpRequest(`curl -X POST -H 'Content-Type: application/json' -d '{"test": true}' https://api.example.com/create`)

      expect(result).not.toBeNull()
      expect(result?.type).toBe('http')
      expect(result?.method).toBe('POST')
      expect(result?.url).toBe('https://api.example.com/create')
      expect(result?.headers).toHaveLength(1)
      expect(result?.body.type).toBe('json')
    })

    it('extracts name from URL path', () => {
      const result = curlToHttpRequest('curl https://api.example.com/users/profile')
      expect(result?.name).toBe('profile')
    })

    it('extracts query params from URL', () => {
      const result = curlToHttpRequest('curl "https://api.example.com/search?q=test&limit=10"')
      expect(result?.params).toHaveLength(2)
      expect(result?.params[0].key).toBe('q')
      expect(result?.params[0].value).toBe('test')
    })

    it('returns null for invalid curl', () => {
      expect(curlToHttpRequest('not curl')).toBeNull()
    })

    it('includes cookies in HttpRequest', () => {
      const result = curlToHttpRequest(`curl -b 'session=abc123' https://api.example.com/dashboard`)
      expect(result?.cookies).toHaveLength(1)
      expect(result?.cookies[0].key).toBe('session')
      expect(result?.cookies[0].value).toBe('abc123')
      expect(result?.cookies[0].enabled).toBe(true)
    })
  })
})
