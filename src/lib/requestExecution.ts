import { invoke } from '@tauri-apps/api/core'
import type {
  HttpRequest,
  HttpResponse,
  KeyValue,
  RequestExecutionResult,
  RequestVariableExtraction,
  RuntimeVariableMap,
  SecretVariable,
} from '../types'
import { resolveTemplateReferences } from './secrets'
import { evaluateRequestTests, extractRuntimeVariables } from './requestAssertions.ts'

interface RawHttpResponse {
  status: number
  status_text: string
  headers: Record<string, string>
  body: string
  time: number
  size: number
}

export interface ExecutionContext {
  secrets?: SecretVariable[]
  runtimeVariables?: RuntimeVariableMap
}

export function getEnabledItems(items: KeyValue[]): KeyValue[] {
  return items.filter((item) => item.enabled && item.key)
}

export function buildRequestUrl(url: string, params: KeyValue[]): string {
  const enabledParams = getEnabledItems(params)
  if (enabledParams.length === 0) return url

  const queryString = enabledParams
    .map((param) => `${encodeURIComponent(param.key)}=${encodeURIComponent(param.value)}`)
    .join('&')

  return url.includes('?') ? `${url}&${queryString}` : `${url}?${queryString}`
}

function resolveKeyValueItems(
  items: KeyValue[],
  secrets: SecretVariable[],
  runtimeVariables: RuntimeVariableMap
): KeyValue[] {
  return items.map((item) => ({
    ...item,
    key: resolveTemplateReferences(item.key, secrets, runtimeVariables),
    value: resolveTemplateReferences(item.value, secrets, runtimeVariables),
  }))
}

function ensureHeader(headers: KeyValue[], key: string, value: string): KeyValue[] {
  const existingHeader = headers.find((header) => header.key.toLowerCase() === key.toLowerCase())
  if (existingHeader) {
    return headers.map((header) =>
      header.key.toLowerCase() === key.toLowerCase()
        ? { ...header, value }
        : header
    )
  }

  return [
    ...headers,
    {
      id: crypto.randomUUID(),
      key,
      value,
      enabled: true,
    },
  ]
}

export function resolveHttpRequest(
  request: HttpRequest,
  context: ExecutionContext = {}
): HttpRequest {
  const secrets = context.secrets ?? []
  const runtimeVariables = context.runtimeVariables ?? {}

  const resolvedHeaders = resolveKeyValueItems(request.headers, secrets, runtimeVariables)
  const resolvedParams = resolveKeyValueItems(request.params, secrets, runtimeVariables)
  const resolvedAuth = request.auth
    ? {
        ...request.auth,
        token: request.auth.token
          ? resolveTemplateReferences(request.auth.token, secrets, runtimeVariables)
          : request.auth.token,
        username: request.auth.username
          ? resolveTemplateReferences(request.auth.username, secrets, runtimeVariables)
          : request.auth.username,
        password: request.auth.password
          ? resolveTemplateReferences(request.auth.password, secrets, runtimeVariables)
          : request.auth.password,
        key: request.auth.key
          ? resolveTemplateReferences(request.auth.key, secrets, runtimeVariables)
          : request.auth.key,
        value: request.auth.value
          ? resolveTemplateReferences(request.auth.value, secrets, runtimeVariables)
          : request.auth.value,
      }
    : undefined

  let nextHeaders = resolvedHeaders
  let nextParams = resolvedParams

  if (resolvedAuth?.type === 'bearer' && resolvedAuth.token) {
    nextHeaders = ensureHeader(nextHeaders, 'Authorization', `Bearer ${resolvedAuth.token}`)
  } else if (resolvedAuth?.type === 'basic' && resolvedAuth.username) {
    const authValue = btoa(`${resolvedAuth.username}:${resolvedAuth.password ?? ''}`)
    nextHeaders = ensureHeader(nextHeaders, 'Authorization', `Basic ${authValue}`)
  } else if (resolvedAuth?.type === 'api-key' && resolvedAuth.key) {
    if (resolvedAuth.addTo === 'query') {
      const existingParam = nextParams.find((param) => param.key === resolvedAuth.key)
      if (existingParam) {
        nextParams = nextParams.map((param) =>
          param.key === resolvedAuth.key
            ? { ...param, value: resolvedAuth.value ?? '' }
            : param
        )
      } else {
        nextParams = [
          ...nextParams,
          {
            id: crypto.randomUUID(),
            key: resolvedAuth.key,
            value: resolvedAuth.value ?? '',
            enabled: true,
          },
        ]
      }
    } else {
      nextHeaders = ensureHeader(nextHeaders, resolvedAuth.key, resolvedAuth.value ?? '')
    }
  }

  if (request.body.type === 'json' && request.body.content) {
    nextHeaders = ensureHeader(nextHeaders, 'Content-Type', 'application/json')
  }

  return {
    ...request,
    url: buildRequestUrl(resolveTemplateReferences(request.url, secrets, runtimeVariables), nextParams),
    headers: nextHeaders,
    params: nextParams,
    body: {
      ...request.body,
      content: resolveTemplateReferences(request.body.content, secrets, runtimeVariables),
    },
    auth: resolvedAuth,
  }
}

export function normalizeHttpResponse(response: RawHttpResponse): HttpResponse {
  return {
    status: response.status,
    statusText: response.status_text,
    headers: response.headers,
    body: response.body,
    time: response.time,
    size: response.size,
  }
}

export async function executeHttpRequest(
  request: HttpRequest,
  context: ExecutionContext = {}
): Promise<RequestExecutionResult> {
  const resolvedRequest = resolveHttpRequest(request, context)
  const response = normalizeHttpResponse(
    await invoke<RawHttpResponse>('send_http_request', {
      method: resolvedRequest.method,
      url: resolvedRequest.url,
      headers: getEnabledItems(resolvedRequest.headers).reduce<Record<string, string>>((acc, header) => {
        acc[header.key] = header.value
        return acc
      }, {}),
      body: resolvedRequest.body.type !== 'none' ? resolvedRequest.body.content : null,
    })
  )

  const assertions = evaluateRequestTests(request.tests ?? [], response)
  const extractedVariables = extractRuntimeVariables(request.extractions ?? [], response)

  return {
    requestId: request.id,
    requestName: request.name,
    response,
    assertions,
    extractedVariables,
    passed: assertions.every((assertion) => assertion.passed),
  }
}

export function createExecutionErrorResponse(error: unknown): HttpResponse {
  return {
    status: 0,
    statusText: 'Error',
    headers: {},
    body: String(error),
    time: 0,
    size: 0,
  }
}

export function getRequestExtractionRules(extractions: RequestVariableExtraction[]): RequestVariableExtraction[] {
  return extractions.filter((extraction) => extraction.enabled && extraction.variableName.trim() && extraction.path.trim())
}
