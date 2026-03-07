/**
 * Local OpenAPI Spec Server
 *
 * Run with: npx tsx scripts/openapi-server.ts
 *
 * Hosts sample OpenAPI specs on localhost for testing the import feature.
 *
 * Endpoints:
 * - http://localhost:4567/openapi.json  - OpenAPI 3.0 spec (JSON)
 * - http://localhost:4567/openapi.yaml  - OpenAPI 3.0 spec (YAML)
 * - http://localhost:4567/swagger.json  - Swagger 2.0 spec (JSON)
 */

import { createServer, IncomingMessage, ServerResponse } from 'http'

const PORT = 4567

// Sample OpenAPI 3.0 spec with rich parameter/body examples
const openapi3Spec = {
  openapi: '3.0.3',
  info: {
    title: 'Pet Store API',
    description: 'A sample API for testing Posty import with parameters, headers, and request bodies',
    version: '1.0.0',
  },
  servers: [
    { url: 'https://api.petstore.example.com/v1' }
  ],
  paths: {
    '/pets': {
      get: {
        operationId: 'listPets',
        summary: 'List all pets',
        tags: ['pets'],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of pets to return',
            required: false,
            schema: { type: 'integer', format: 'int32' }
          },
          {
            name: 'offset',
            in: 'query',
            description: 'Number of pets to skip',
            required: false,
            schema: { type: 'integer' }
          },
          {
            name: 'status',
            in: 'query',
            description: 'Filter by pet status',
            required: false,
            schema: { type: 'string', enum: ['available', 'pending', 'sold'] }
          },
          {
            name: 'X-Request-ID',
            in: 'header',
            description: 'Unique request identifier for tracing',
            required: false,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          '200': {
            description: 'A list of pets',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Pet' }
                }
              }
            }
          }
        }
      },
      post: {
        operationId: 'createPet',
        summary: 'Create a pet',
        tags: ['pets'],
        parameters: [
          {
            name: 'Authorization',
            in: 'header',
            description: 'Bearer token for authentication',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreatePet' }
            }
          }
        },
        responses: {
          '201': { description: 'Pet created successfully' }
        }
      }
    },
    '/pets/{petId}': {
      parameters: [
        {
          name: 'petId',
          in: 'path',
          required: true,
          description: 'The ID of the pet',
          schema: { type: 'string' }
        }
      ],
      get: {
        operationId: 'getPet',
        summary: 'Get a pet by ID',
        tags: ['pets'],
        parameters: [
          {
            name: 'include',
            in: 'query',
            description: 'Additional data to include',
            required: false,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'A pet',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Pet' }
              }
            }
          },
          '404': { description: 'Pet not found' }
        }
      },
      put: {
        operationId: 'updatePet',
        summary: 'Update a pet',
        tags: ['pets'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdatePet' }
            }
          }
        },
        responses: {
          '200': { description: 'Pet updated' }
        }
      },
      delete: {
        operationId: 'deletePet',
        summary: 'Delete a pet',
        tags: ['pets'],
        responses: {
          '204': { description: 'Pet deleted' }
        }
      }
    },
    '/users': {
      get: {
        operationId: 'listUsers',
        summary: 'List all users',
        tags: ['users'],
        parameters: [
          {
            name: 'page',
            in: 'query',
            description: 'Page number',
            schema: { type: 'integer' }
          },
          {
            name: 'per_page',
            in: 'query',
            description: 'Items per page',
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': { description: 'A list of users' }
        }
      },
      post: {
        operationId: 'createUser',
        summary: 'Create a user',
        tags: ['users'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateUser' }
            }
          }
        },
        responses: {
          '201': { description: 'User created' }
        }
      }
    },
    '/users/{userId}': {
      get: {
        operationId: 'getUser',
        summary: 'Get a user by ID',
        tags: ['users'],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            description: 'The user ID',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': { description: 'A user' }
        }
      }
    }
  },
  components: {
    schemas: {
      Pet: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'integer', format: 'int64' },
          name: { type: 'string' },
          tag: { type: 'string' },
          status: { type: 'string', enum: ['available', 'pending', 'sold'] }
        }
      },
      CreatePet: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          tag: { type: 'string' },
          status: { type: 'string', enum: ['available', 'pending', 'sold'] }
        }
      },
      UpdatePet: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          tag: { type: 'string' },
          status: { type: 'string' }
        }
      },
      User: {
        type: 'object',
        required: ['id', 'email'],
        properties: {
          id: { type: 'integer' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      CreateUser: {
        type: 'object',
        required: ['email', 'name'],
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          password: { type: 'string' }
        }
      }
    }
  }
}

// Swagger 2.0 spec
const swagger2Spec = {
  swagger: '2.0',
  info: {
    title: 'Legacy API',
    description: 'A Swagger 2.0 API for testing',
    version: '2.0.0'
  },
  host: 'api.legacy.example.com',
  basePath: '/v2',
  schemes: ['https'],
  paths: {
    '/items': {
      get: {
        operationId: 'listItems',
        summary: 'List items',
        produces: ['application/json'],
        responses: {
          '200': { description: 'Success' }
        }
      },
      post: {
        operationId: 'createItem',
        summary: 'Create an item',
        consumes: ['application/json'],
        parameters: [
          {
            name: 'body',
            in: 'body',
            schema: { $ref: '#/definitions/Item' }
          }
        ],
        responses: {
          '201': { description: 'Created' }
        }
      }
    },
    '/items/{id}': {
      get: {
        operationId: 'getItem',
        summary: 'Get item by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            type: 'string'
          }
        ],
        responses: {
          '200': { description: 'Success' }
        }
      }
    }
  },
  definitions: {
    Item: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' }
      }
    }
  }
}

// Convert to YAML (simple conversion for demo)
function toYaml(obj: object, indent = 0): string {
  const spaces = '  '.repeat(indent)
  let yaml = ''

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      yaml += `${spaces}${key}: null\n`
    } else if (Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`
      for (const item of value) {
        if (typeof item === 'object') {
          yaml += `${spaces}  -\n${toYaml(item, indent + 2).replace(/^/gm, '  ')}`
        } else {
          yaml += `${spaces}  - ${item}\n`
        }
      }
    } else if (typeof value === 'object') {
      yaml += `${spaces}${key}:\n${toYaml(value, indent + 1)}`
    } else if (typeof value === 'string') {
      yaml += `${spaces}${key}: "${value}"\n`
    } else {
      yaml += `${spaces}${key}: ${value}\n`
    }
  }

  return yaml
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = req.url || '/'

  console.log(`[${new Date().toISOString()}] ${req.method} ${url}`)

  if (url === '/openapi.json' || url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(openapi3Spec, null, 2))
  } else if (url === '/openapi.yaml') {
    res.writeHead(200, { 'Content-Type': 'text/yaml' })
    res.end(toYaml(openapi3Spec))
  } else if (url === '/swagger.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(swagger2Spec, null, 2))
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  }
})

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║            OpenAPI Test Server Running                          ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Available endpoints:                                           ║
║                                                                 ║
║  OpenAPI 3.0 (JSON):  http://localhost:${PORT}/openapi.json       ║
║  OpenAPI 3.0 (YAML):  http://localhost:${PORT}/openapi.yaml       ║
║  Swagger 2.0 (JSON):  http://localhost:${PORT}/swagger.json       ║
║                                                                 ║
║  Use these URLs in Posty's Import modal to test the feature.   ║
║                                                                 ║
║  Press Ctrl+C to stop the server.                               ║
╚════════════════════════════════════════════════════════════════╝
`)
})
