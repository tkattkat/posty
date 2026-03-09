import { describe, expect, it } from 'vitest'
import { evaluateRequestTests, extractRuntimeVariables, getJsonPathValue } from './requestAssertions'
import type { HttpResponse, RequestTest, RequestVariableExtraction } from '../types'

const response: HttpResponse = {
  status: 200,
  statusText: 'OK',
  headers: {
    'content-type': 'application/json',
    'x-trace-id': 'trace-123',
  },
  body: JSON.stringify({
    data: {
      user: {
        id: 'user-1',
        token: 'abc123',
      },
    },
  }),
  time: 120,
  size: 64,
}

describe('requestAssertions', () => {
  it('reads nested json path values', () => {
    expect(getJsonPathValue(response.body, 'data.user.id')).toBe('user-1')
  })

  it('evaluates multiple request test types', () => {
    const tests: RequestTest[] = [
      {
        id: 'status',
        enabled: true,
        type: 'status-code',
        expectedStatus: 200,
      },
      {
        id: 'header',
        enabled: true,
        type: 'header-contains',
        target: 'content-type',
        expectedValue: 'application/json',
      },
      {
        id: 'json',
        enabled: true,
        type: 'json-path-equals',
        target: 'data.user.id',
        expectedValue: 'user-1',
      },
    ]

    const results = evaluateRequestTests(tests, response)
    expect(results).toHaveLength(3)
    expect(results.every((result) => result.passed)).toBe(true)
  })

  it('extracts runtime variables from json paths and headers', () => {
    const extractions: RequestVariableExtraction[] = [
      {
        id: 'token',
        enabled: true,
        source: 'json-path',
        path: 'data.user.token',
        variableName: 'token',
      },
      {
        id: 'trace',
        enabled: true,
        source: 'header',
        path: 'x-trace-id',
        variableName: 'traceId',
      },
    ]

    expect(extractRuntimeVariables(extractions, response)).toEqual({
      token: 'abc123',
      traceId: 'trace-123',
    })
  })

  describe('cookie extraction', () => {
    const responseWithCookies: HttpResponse = {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'application/json',
        'set-cookie': 'session=abc123; Path=/; HttpOnly, user=john; Path=/',
      },
      body: '{}',
      time: 50,
      size: 2,
    }

    it('extracts cookie value from Set-Cookie header', () => {
      const extractions: RequestVariableExtraction[] = [
        {
          id: 'session',
          enabled: true,
          source: 'cookie',
          path: 'session',
          variableName: 'sessionId',
        },
      ]

      expect(extractRuntimeVariables(extractions, responseWithCookies)).toEqual({
        sessionId: 'abc123',
      })
    })

    it('extracts multiple cookies from Set-Cookie header', () => {
      const extractions: RequestVariableExtraction[] = [
        {
          id: 'session',
          enabled: true,
          source: 'cookie',
          path: 'session',
          variableName: 'sessionId',
        },
        {
          id: 'user',
          enabled: true,
          source: 'cookie',
          path: 'user',
          variableName: 'userName',
        },
      ]

      expect(extractRuntimeVariables(extractions, responseWithCookies)).toEqual({
        sessionId: 'abc123',
        userName: 'john',
      })
    })

    it('returns empty when cookie not found', () => {
      const extractions: RequestVariableExtraction[] = [
        {
          id: 'missing',
          enabled: true,
          source: 'cookie',
          path: 'nonexistent',
          variableName: 'missing',
        },
      ]

      expect(extractRuntimeVariables(extractions, responseWithCookies)).toEqual({})
    })

    it('handles case-insensitive cookie name matching', () => {
      const extractions: RequestVariableExtraction[] = [
        {
          id: 'session',
          enabled: true,
          source: 'cookie',
          path: 'SESSION',
          variableName: 'sessionId',
        },
      ]

      expect(extractRuntimeVariables(extractions, responseWithCookies)).toEqual({
        sessionId: 'abc123',
      })
    })

    it('handles cookies with equals sign in value', () => {
      const responseWithComplexCookie: HttpResponse = {
        status: 200,
        statusText: 'OK',
        headers: {
          'set-cookie': 'data=key=value; Path=/',
        },
        body: '{}',
        time: 50,
        size: 2,
      }

      const extractions: RequestVariableExtraction[] = [
        {
          id: 'data',
          enabled: true,
          source: 'cookie',
          path: 'data',
          variableName: 'dataValue',
        },
      ]

      expect(extractRuntimeVariables(extractions, responseWithComplexCookie)).toEqual({
        dataValue: 'key=value',
      })
    })
  })
})
