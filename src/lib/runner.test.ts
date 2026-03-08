import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { runCollectionRequests } from './runner'
import type { Collection } from '../types'

const mockedInvoke = vi.mocked(invoke)

const collection: Collection = {
  id: 'collection-1',
  name: 'Auth flow',
  requests: [
    {
      id: 'login',
      name: 'Login',
      type: 'http',
      method: 'POST',
      url: 'https://api.example.com/login',
      headers: [],
      params: [],
      body: {
        type: 'json',
        content: '{"email":"demo@example.com"}',
      },
      tests: [
        {
          id: 'login-status',
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
          path: 'token',
          variableName: 'token',
        },
      ],
    },
    {
      id: 'profile',
      name: 'Profile',
      type: 'http',
      method: 'GET',
      url: 'https://api.example.com/me',
      headers: [
        { id: 'auth', key: 'Authorization', value: 'Bearer {{token}}', enabled: true },
      ],
      params: [],
      body: {
        type: 'none',
        content: '',
      },
      tests: [
        {
          id: 'profile-status',
          enabled: true,
          type: 'status-code',
          expectedStatus: 200,
        },
      ],
      extractions: [],
    },
  ],
  folders: [],
}

describe('runner', () => {
  beforeEach(() => {
    mockedInvoke.mockReset()
  })

  it('runs collection requests sequentially and carries runtime variables forward', async () => {
    mockedInvoke
      .mockResolvedValueOnce({
        status: 200,
        status_text: 'OK',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'runner-token' }),
        time: 25,
        size: 16,
      })
      .mockResolvedValueOnce({
        status: 200,
        status_text: 'OK',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true }),
        time: 21,
        size: 12,
      })

    const run = await runCollectionRequests({
      collection,
      stopOnFail: true,
    })

    expect(run.status).toBe('completed')
    expect(run.steps.map((step) => step.status)).toEqual(['passed', 'passed'])
    expect(mockedInvoke).toHaveBeenNthCalledWith(2, 'send_http_request', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer runner-token',
      }),
    }))
  })

  it('stops on the first failed step when stopOnFail is enabled', async () => {
    mockedInvoke
      .mockResolvedValueOnce({
        status: 500,
        status_text: 'Internal Server Error',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'boom' }),
        time: 30,
        size: 12,
      })

    const run = await runCollectionRequests({
      collection,
      stopOnFail: true,
    })

    expect(run.status).toBe('failed')
    expect(run.steps[0].status).toBe('failed')
    expect(run.steps[1].status).toBe('pending')
    expect(mockedInvoke).toHaveBeenCalledTimes(1)
  })

  it('inherits base urls from parent folders and allows nested overrides', async () => {
    mockedInvoke
      .mockResolvedValueOnce({
        status: 200,
        status_text: 'OK',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true }),
        time: 20,
        size: 12,
      })
      .mockResolvedValueOnce({
        status: 200,
        status_text: 'OK',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true }),
        time: 18,
        size: 12,
      })

    await runCollectionRequests({
      collection: {
        id: 'root',
        name: 'Root',
        baseUrl: 'https://api.example.com/v1',
        requests: [],
        folders: [
          {
            id: 'child-a',
            name: 'Child A',
            parentId: 'root',
            requests: [
              {
                id: 'child-a-request',
                name: 'Child A Request',
                type: 'http',
                method: 'GET',
                url: '/users',
                headers: [],
                params: [],
                body: { type: 'none', content: '' },
                tests: [],
                extractions: [],
              },
            ],
            folders: [],
          },
          {
            id: 'child-b',
            name: 'Child B',
            parentId: 'root',
            baseUrl: 'https://staging.example.com/api',
            requests: [
              {
                id: 'child-b-request',
                name: 'Child B Request',
                type: 'http',
                method: 'GET',
                url: '/users',
                headers: [],
                params: [],
                body: { type: 'none', content: '' },
                tests: [],
                extractions: [],
              },
            ],
            folders: [],
          },
        ],
      },
      stopOnFail: true,
    })

    expect(mockedInvoke).toHaveBeenNthCalledWith(1, 'send_http_request', expect.objectContaining({
      url: 'https://api.example.com/v1/users',
    }))
    expect(mockedInvoke).toHaveBeenNthCalledWith(2, 'send_http_request', expect.objectContaining({
      url: 'https://staging.example.com/api/users',
    }))
  })
})
