import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { executeHttpRequest, resolveHttpRequest } from './requestExecution'
import type { HttpRequest, SecretVariable } from '../types'

const mockedInvoke = vi.mocked(invoke)

const request: HttpRequest = {
  id: 'req-1',
  name: 'Profile request',
  type: 'http',
  method: 'GET',
  url: 'https://api.example.com/users/{{userId}}',
  headers: [
    { id: 'header-1', key: 'X-Project', value: '{{projectId}}', enabled: true },
  ],
  params: [
    { id: 'param-1', key: 'include', value: 'teams', enabled: true },
  ],
  body: {
    type: 'none',
    content: '',
  },
  auth: {
    type: 'bearer',
    token: '{{apiToken}}',
  },
  tests: [
    {
      id: 'status',
      enabled: true,
      type: 'status-code',
      expectedStatus: 200,
    },
  ],
  extractions: [
    {
      id: 'token',
      enabled: true,
      source: 'json-path',
      path: 'data.token',
      variableName: 'nextToken',
    },
  ],
}

const secrets: SecretVariable[] = [
  { id: 'secret-1', name: 'apiToken', value: 'secret-token' },
]

describe('requestExecution', () => {
  beforeEach(() => {
    mockedInvoke.mockReset()
  })

  it('resolves params, auth, secrets, and runtime variables before execution', () => {
    const resolved = resolveHttpRequest(request, {
      secrets,
      runtimeVariables: {
        userId: 'user-42',
        projectId: 'proj-9',
      },
    })

    expect(resolved.url).toBe('https://api.example.com/users/user-42?include=teams')
    expect(resolved.headers.some((header) => header.key === 'Authorization' && header.value === 'Bearer secret-token')).toBe(true)
    expect(resolved.headers.some((header) => header.key === 'X-Project' && header.value === 'proj-9')).toBe(true)
  })

  it('executes a request and returns assertions plus extracted variables', async () => {
    mockedInvoke.mockResolvedValue({
      status: 200,
      status_text: 'OK',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: { token: 'next-token' } }),
      time: 84,
      size: 48,
    })

    const result = await executeHttpRequest(request, {
      secrets,
      runtimeVariables: {
        userId: 'user-42',
        projectId: 'proj-9',
      },
    })

    expect(mockedInvoke).toHaveBeenCalledWith('send_http_request', expect.objectContaining({
      method: 'GET',
      url: 'https://api.example.com/users/user-42?include=teams',
    }))
    expect(result.passed).toBe(true)
    expect(result.assertions).toHaveLength(1)
    expect(result.extractedVariables).toEqual({ nextToken: 'next-token' })
  })

  it('treats http errors as failed when no explicit tests exist', async () => {
    mockedInvoke.mockResolvedValue({
      status: 401,
      status_text: 'Unauthorized',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' }),
      time: 42,
      size: 28,
    })

    const result = await executeHttpRequest({
      ...request,
      tests: [],
      extractions: [],
    }, {
      secrets,
      runtimeVariables: {
        userId: 'user-42',
        projectId: 'proj-9',
      },
    })

    expect(result.assertions).toHaveLength(0)
    expect(result.passed).toBe(false)
  })
})
