import type { HttpRequest, HttpMethod, KeyValue } from '../types'

interface ParsedCurl {
  method: HttpMethod
  url: string
  headers: KeyValue[]
  body?: { type: 'json' | 'text' | 'form'; content: string }
  auth?: { type: 'bearer' | 'basic'; token?: string; username?: string; password?: string }
}

export function parseCurl(curlCommand: string): ParsedCurl | null {
  // Clean up the command
  let cmd = curlCommand
    .replace(/\\\n/g, ' ') // Handle line continuations
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .trim()

  // Check if it's a curl command
  if (!cmd.toLowerCase().startsWith('curl ')) {
    return null
  }

  // Remove 'curl ' prefix
  cmd = cmd.slice(5).trim()

  const result: ParsedCurl = {
    method: 'GET',
    url: '',
    headers: [],
  }

  // Tokenize while respecting quotes
  const tokens: string[] = []
  let current = ''
  let inQuote: string | null = null

  for (let i = 0; i < cmd.length; i++) {
    const char = cmd[i]

    if (inQuote) {
      if (char === inQuote && cmd[i - 1] !== '\\') {
        inQuote = null
      } else {
        current += char
      }
    } else if (char === '"' || char === "'") {
      inQuote = char
    } else if (char === ' ') {
      if (current) {
        tokens.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }
  if (current) tokens.push(current)

  // Parse tokens
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const nextToken = tokens[i + 1]

    if (token === '-X' || token === '--request') {
      if (nextToken) {
        result.method = nextToken.toUpperCase() as HttpMethod
        i++
      }
    } else if (token === '-H' || token === '--header') {
      if (nextToken) {
        const colonIndex = nextToken.indexOf(':')
        if (colonIndex > 0) {
          const key = nextToken.slice(0, colonIndex).trim()
          const value = nextToken.slice(colonIndex + 1).trim()

          // Check for Authorization header
          if (key.toLowerCase() === 'authorization') {
            if (value.toLowerCase().startsWith('bearer ')) {
              result.auth = {
                type: 'bearer',
                token: value.slice(7).trim(),
              }
            } else if (value.toLowerCase().startsWith('basic ')) {
              const decoded = atob(value.slice(6).trim())
              const [username, password] = decoded.split(':')
              result.auth = {
                type: 'basic',
                username,
                password,
              }
            }
          } else {
            result.headers.push({
              id: crypto.randomUUID(),
              key,
              value,
              enabled: true,
            })
          }
        }
        i++
      }
    } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      if (nextToken) {
        const content = nextToken

        // Try to detect JSON
        try {
          JSON.parse(content)
          result.body = { type: 'json', content }
        } catch {
          result.body = { type: 'text', content }
        }

        // Set method to POST if not explicitly set
        if (result.method === 'GET') {
          result.method = 'POST'
        }
        i++
      }
    } else if (token === '--data-urlencode') {
      if (nextToken) {
        result.body = { type: 'form', content: nextToken }
        if (result.method === 'GET') {
          result.method = 'POST'
        }
        i++
      }
    } else if (token === '-u' || token === '--user') {
      if (nextToken) {
        const [username, password] = nextToken.split(':')
        result.auth = {
          type: 'basic',
          username,
          password: password || '',
        }
        i++
      }
    } else if (token === '-A' || token === '--user-agent') {
      if (nextToken) {
        result.headers.push({
          id: crypto.randomUUID(),
          key: 'User-Agent',
          value: nextToken,
          enabled: true,
        })
        i++
      }
    } else if (token === '-e' || token === '--referer') {
      if (nextToken) {
        result.headers.push({
          id: crypto.randomUUID(),
          key: 'Referer',
          value: nextToken,
          enabled: true,
        })
        i++
      }
    } else if (!token.startsWith('-') && !result.url) {
      // This should be the URL
      result.url = token
    }
  }

  // Validate we got a URL
  if (!result.url) {
    return null
  }

  return result
}

export function curlToHttpRequest(curlCommand: string): HttpRequest | null {
  const parsed = parseCurl(curlCommand)

  if (!parsed) {
    return null
  }

  return {
    id: crypto.randomUUID(),
    name: extractNameFromUrl(parsed.url),
    type: 'http',
    method: parsed.method,
    url: parsed.url,
    headers: parsed.headers,
    params: extractQueryParams(parsed.url),
    body: parsed.body || { type: 'none', content: '' },
    auth: parsed.auth ? { ...parsed.auth, type: parsed.auth.type } : undefined,
  }
}

function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const path = urlObj.pathname
    if (path && path !== '/') {
      // Get last path segment
      const segments = path.split('/').filter(Boolean)
      if (segments.length > 0) {
        return segments[segments.length - 1]
      }
    }
    return urlObj.hostname
  } catch {
    return 'Imported Request'
  }
}

function extractQueryParams(url: string): KeyValue[] {
  try {
    const urlObj = new URL(url)
    const params: KeyValue[] = []
    urlObj.searchParams.forEach((value, key) => {
      params.push({
        id: crypto.randomUUID(),
        key,
        value,
        enabled: true,
      })
    })
    return params
  } catch {
    return []
  }
}

export function isCurlCommand(text: string): boolean {
  const trimmed = text.trim().toLowerCase()
  return trimmed.startsWith('curl ') || trimmed.startsWith('curl\n')
}
