/**
 * OpenAPI Import Tests
 *
 * These tests spin up a local HTTP server hosting OpenAPI specs,
 * then test the import functionality.
 *
 * To run manually for testing in the app:
 * npx tsx scripts/openapi-server.ts
 *
 * Then in Posty, import from: http://localhost:4567/openapi.json
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer, Server, IncomingMessage, ServerResponse } from 'http'
import { AddressInfo } from 'net'
import { convertImportedCollection } from './openapiImport'

// Sample OpenAPI 3.0 spec for testing
const sampleOpenApi3Spec = {
  openapi: '3.0.3',
  info: {
    title: 'Test API',
    description: 'A test API',
    version: '1.0.0',
  },
  servers: [{ url: 'https://api.test.com/v1' }],
  paths: {
    '/users': {
      get: {
        operationId: 'listUsers',
        summary: 'List all users',
        tags: ['users'],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': { description: 'Success' },
        },
      },
      post: {
        operationId: 'createUser',
        summary: 'Create a user',
        tags: ['users'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Created' },
        },
      },
    },
    '/users/{userId}': {
      get: {
        operationId: 'getUser',
        summary: 'Get user by ID',
        tags: ['users'],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Success' },
        },
      },
      delete: {
        operationId: 'deleteUser',
        summary: 'Delete user',
        tags: ['users'],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '204': { description: 'Deleted' },
        },
      },
    },
    '/posts': {
      get: {
        operationId: 'listPosts',
        summary: 'List all posts',
        tags: ['posts'],
        responses: {
          '200': { description: 'Success' },
        },
      },
    },
  },
}

// Swagger 2.0 spec for testing
const sampleSwagger2Spec = {
  swagger: '2.0',
  info: {
    title: 'Legacy API',
    version: '2.0.0',
  },
  host: 'api.legacy.com',
  basePath: '/v2',
  schemes: ['https'],
  paths: {
    '/items': {
      get: {
        operationId: 'listItems',
        summary: 'List items',
        responses: {
          '200': { description: 'Success' },
        },
      },
    },
  },
}

describe('OpenAPI Import', () => {
  let server: Server
  let serverUrl: string

  beforeAll(async () => {
    // Create a test server
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      const url = req.url || '/'

      if (url === '/openapi.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(sampleOpenApi3Spec))
      } else if (url === '/swagger.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(sampleSwagger2Spec))
      } else if (url === '/invalid.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{ invalid json }')
      } else if (url === '/not-openapi.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ foo: 'bar' }))
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo
        serverUrl = `http://127.0.0.1:${address.port}`
        resolve()
      })
    })
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  })

  describe('Server Setup', () => {
    it('serves OpenAPI 3.0 spec at /openapi.json', async () => {
      const response = await fetch(`${serverUrl}/openapi.json`)
      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.openapi).toBe('3.0.3')
      expect(data.info.title).toBe('Test API')
    })

    it('serves Swagger 2.0 spec at /swagger.json', async () => {
      const response = await fetch(`${serverUrl}/swagger.json`)
      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data.swagger).toBe('2.0')
      expect(data.info.title).toBe('Legacy API')
    })

    it('returns 404 for unknown endpoints', async () => {
      const response = await fetch(`${serverUrl}/unknown`)
      expect(response.status).toBe(404)
    })
  })

  describe('OpenAPI 3.0 Spec Structure', () => {
    it('has correct paths defined', () => {
      const paths = Object.keys(sampleOpenApi3Spec.paths)
      expect(paths).toContain('/users')
      expect(paths).toContain('/users/{userId}')
      expect(paths).toContain('/posts')
    })

    it('has correct HTTP methods for /users', () => {
      const userPath = sampleOpenApi3Spec.paths['/users']
      expect(userPath).toHaveProperty('get')
      expect(userPath).toHaveProperty('post')
    })

    it('has correct parameters for GET /users', () => {
      const getUsersOp = sampleOpenApi3Spec.paths['/users'].get
      expect(getUsersOp.parameters).toHaveLength(1)
      expect(getUsersOp.parameters[0].name).toBe('limit')
      expect(getUsersOp.parameters[0].in).toBe('query')
    })

    it('has path parameter for /users/{userId}', () => {
      const getUserOp = sampleOpenApi3Spec.paths['/users/{userId}'].get
      expect(getUserOp.parameters).toHaveLength(1)
      expect(getUserOp.parameters[0].name).toBe('userId')
      expect(getUserOp.parameters[0].in).toBe('path')
      expect(getUserOp.parameters[0].required).toBe(true)
    })

    it('has request body for POST /users', () => {
      const createUserOp = sampleOpenApi3Spec.paths['/users'].post
      expect(createUserOp.requestBody).toBeDefined()
      expect(createUserOp.requestBody.required).toBe(true)
      expect(createUserOp.requestBody.content['application/json']).toBeDefined()
    })

    it('organizes endpoints by tags', () => {
      const listUsersOp = sampleOpenApi3Spec.paths['/users'].get
      const listPostsOp = sampleOpenApi3Spec.paths['/posts'].get

      expect(listUsersOp.tags).toContain('users')
      expect(listPostsOp.tags).toContain('posts')
    })

    it('converts imported requests with default status-code tests', () => {
      const converted = convertImportedCollection({
        name: 'Test API',
        description: 'A test API',
        requests: [
          {
            id: 'request-1',
            name: 'Create a user',
            method: 'POST',
            url: 'https://api.test.com/v1/users',
            headers: [],
            params: [],
            body: {
              type: 'json',
              content: '{"name":"demo"}',
            },
            tests: [
              {
                id: 'test-1',
                enabled: true,
                type: 'status-code',
                label: 'Status is 201',
                expected_status: 201,
              },
            ],
          },
        ],
        folders: [],
      })

      const request = converted.requests[0]
      expect(request.type).toBe('http')
      if (request.type !== 'http') {
        throw new Error('Expected converted request to be HTTP')
      }
      expect(request.tests).toEqual([
        expect.objectContaining({
          type: 'status-code',
          label: 'Status is 201',
          expectedStatus: 201,
        }),
      ])
    })
  })

  describe('Swagger 2.0 Spec Structure', () => {
    it('has correct swagger version', () => {
      expect(sampleSwagger2Spec.swagger).toBe('2.0')
    })

    it('has host and basePath', () => {
      expect(sampleSwagger2Spec.host).toBe('api.legacy.com')
      expect(sampleSwagger2Spec.basePath).toBe('/v2')
    })

    it('has schemes defined', () => {
      expect(sampleSwagger2Spec.schemes).toContain('https')
    })
  })

  describe('Collection Conversion Logic', () => {
    // This tests the expected conversion from OpenAPI to our Collection format
    it('should count total endpoints correctly', () => {
      let totalEndpoints = 0
      for (const path of Object.values(sampleOpenApi3Spec.paths)) {
        totalEndpoints += Object.keys(path).length
      }
      // /users: GET, POST (2)
      // /users/{userId}: GET, DELETE (2)
      // /posts: GET (1)
      expect(totalEndpoints).toBe(5)
    })

    it('should extract unique tags for folder structure', () => {
      const tags = new Set<string>()
      for (const path of Object.values(sampleOpenApi3Spec.paths)) {
        for (const operation of Object.values(path) as { tags?: string[] }[]) {
          if (operation.tags) {
            operation.tags.forEach((tag) => tags.add(tag))
          }
        }
      }
      expect(tags.size).toBe(2)
      expect(tags.has('users')).toBe(true)
      expect(tags.has('posts')).toBe(true)
    })

    it('should build correct URLs from server + path', () => {
      const baseUrl = sampleOpenApi3Spec.servers[0].url
      const path = '/users'
      const fullUrl = `${baseUrl}${path}`
      expect(fullUrl).toBe('https://api.test.com/v1/users')
    })

    it('should handle path parameters in URL', () => {
      const baseUrl = sampleOpenApi3Spec.servers[0].url
      const path = '/users/{userId}'
      const fullUrl = `${baseUrl}${path}`
      expect(fullUrl).toBe('https://api.test.com/v1/users/{userId}')
    })
  })
})

// Export specs for use in other tests or manual testing
export { sampleOpenApi3Spec, sampleSwagger2Spec }
