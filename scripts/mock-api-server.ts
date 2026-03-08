import http from 'node:http'

const port = Number(process.env.POSTY_MOCK_PORT ?? 4011)
const validToken = 'mock-token-123'

function unauthorized(response: http.ServerResponse) {
  sendJson(response, 401, { error: 'Unauthorized' })
}

function isAuthorized(request: http.IncomingMessage): boolean {
  return request.headers.authorization === `Bearer ${validToken}`
}

async function readJsonBody(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) {
    return {}
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

function sendJson(response: http.ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  })
  response.end(payload)
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`)
  const projectMatch = url.pathname.match(/^\/projects\/([^/]+)$/)
  const projectRunsMatch = url.pathname.match(/^\/projects\/([^/]+)\/runs$/)
  const projectDeployMatch = url.pathname.match(/^\/projects\/([^/]+)\/deploy$/)

  if (request.method === 'POST' && url.pathname === '/auth/login') {
    const body = await readJsonBody(request)
    const email = typeof body.email === 'string' ? body.email : 'demo@example.com'

    sendJson(response, 200, {
      token: validToken,
      user: {
        id: 'user-1',
        email,
      },
    })
    return
  }

  if (request.method === 'GET' && url.pathname === '/users/me') {
    if (!isAuthorized(request)) {
      unauthorized(response)
      return
    }

    sendJson(response, 200, {
      id: 'user-1',
      name: 'Posty Demo',
      role: 'admin',
    })
    return
  }

  if (request.method === 'POST' && url.pathname === '/projects') {
    if (!isAuthorized(request)) {
      unauthorized(response)
      return
    }

    const body = await readJsonBody(request)
    const projectName = typeof body.name === 'string' && body.name.trim()
      ? body.name.trim()
      : 'Runner demo project'

    sendJson(response, 201, {
      project: {
        id: 'project-1',
        name: projectName,
        environment: typeof body.environment === 'string' ? body.environment : 'staging',
      },
    })
    return
  }

  if (request.method === 'GET' && projectMatch) {
    if (!isAuthorized(request)) {
      unauthorized(response)
      return
    }

    const [, projectId] = projectMatch
    sendJson(response, 200, {
      id: projectId,
      status: 'ready',
      ownerId: 'user-1',
      url: `https://${projectId}.local.posty.dev`,
      region: 'us-east-1',
    })
    return
  }

  if (request.method === 'GET' && projectRunsMatch) {
    if (!isAuthorized(request)) {
      unauthorized(response)
      return
    }

    const [, projectId] = projectRunsMatch
    const status = url.searchParams.get('status') ?? 'success'
    const limit = Number(url.searchParams.get('limit') ?? '2')

    sendJson(response, 200, {
      projectId,
      runs: Array.from({ length: Math.max(1, Math.min(limit, 5)) }, (_, index) => ({
        id: `run-${index + 1}`,
        status,
        durationMs: 120 + index * 45,
      })),
    })
    return
  }

  if (request.method === 'POST' && projectDeployMatch) {
    if (!isAuthorized(request)) {
      unauthorized(response)
      return
    }

    const [, projectId] = projectDeployMatch
    const body = await readJsonBody(request)
    sendJson(response, 202, {
      deployment: {
        id: `deploy-${projectId}`,
        projectId,
        environment: typeof body.environment === 'string' ? body.environment : 'staging',
        version: typeof body.version === 'string' ? body.version : '2026.03.08',
        status: 'queued',
      },
    })
    return
  }

  if (request.method === 'GET' && url.pathname === '/slow') {
    await new Promise((resolve) => setTimeout(resolve, 750))
    sendJson(response, 200, { ok: true, delayed: true })
    return
  }

  if (request.method === 'GET' && url.pathname === '/error') {
    sendJson(response, 500, { error: 'Intentional mock failure' })
    return
  }

  sendJson(response, 404, {
    error: 'Not found',
    path: url.pathname,
  })
})

server.listen(port, () => {
  console.log(`Posty mock API listening on http://127.0.0.1:${port}`)
})
