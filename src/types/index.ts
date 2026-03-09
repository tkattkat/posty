// HTTP Methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD'

// Request types
export type RequestType = 'http' | 'websocket' | 'graphql' | 'grpc'

// Key-value pair for headers, params, etc.
export interface KeyValue {
  id: string
  key: string
  value: string
  enabled: boolean
  description?: string
}

export interface HttpRequestAuth {
  type: 'none' | 'bearer' | 'basic' | 'api-key'
  token?: string
  username?: string
  password?: string
  key?: string
  value?: string
  addTo?: 'header' | 'query'
}

export interface RequestTest {
  id: string
  enabled: boolean
  type: 'status-code' | 'header-equals' | 'header-contains' | 'json-path-exists' | 'json-path-equals' | 'response-time-under'
  label?: string
  target?: string
  expectedValue?: string
  expectedStatus?: number
  maxDurationMs?: number
}

export interface RequestVariableExtraction {
  id: string
  enabled: boolean
  source: 'json-path' | 'header' | 'cookie'
  path: string
  variableName: string
}

// HTTP Request
export interface HttpRequest {
  id: string
  name: string
  type: 'http'
  method: HttpMethod
  url: string
  headers: KeyValue[]
  params: KeyValue[]
  cookies: KeyValue[]
  body: {
    type: 'none' | 'json' | 'form' | 'text' | 'binary'
    content: string
  }
  auth?: HttpRequestAuth
  tests?: RequestTest[]
  extractions?: RequestVariableExtraction[]
}

// WebSocket Request
export interface WebSocketRequest {
  id: string
  name: string
  type: 'websocket'
  url: string
  headers: KeyValue[]
}

// GraphQL Request
export interface GraphQLRequest {
  id: string
  name: string
  type: 'graphql'
  url: string
  headers: KeyValue[]
  query: string
  variables: string
}

// gRPC Request
export interface GrpcRequest {
  id: string
  name: string
  type: 'grpc'
  url: string
  protoFile?: string
  service?: string
  method?: string
  metadata: KeyValue[]
  body: string
}

// Union type for all request types
export type Request = HttpRequest | WebSocketRequest | GraphQLRequest | GrpcRequest

// HTTP Response
export interface HttpResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  time: number
  size: number
}

export interface AssertionResult {
  testId: string
  testName: string
  passed: boolean
  message: string
  actualValue?: string | number | boolean | null
}

export type RuntimeVariableMap = Record<string, string>

export interface RequestExecutionResult {
  requestId: string
  requestName: string
  response: HttpResponse
  assertions: AssertionResult[]
  extractedVariables: RuntimeVariableMap
  passed: boolean
}

export interface RunnerStepResult {
  requestId: string
  requestName: string
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled'
  result?: RequestExecutionResult
  error?: string
  startedAt?: number
  finishedAt?: number
}

export interface RunnerResult {
  id: string
  collectionId: string
  collectionName: string
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  stopOnFail: boolean
  startedAt: number
  finishedAt?: number
  steps: RunnerStepResult[]
}

// WebSocket Message
export interface WebSocketMessage {
  id: string
  direction: 'sent' | 'received'
  content: string
  timestamp: number
}

// OpenAPI source info for collections
export interface OpenApiSource {
  type: 'url' | 'text' | 'file'
  url?: string
  spec?: string
  path?: string
  lastUpdated?: number
  sourceModifiedAt?: number
}

export interface SecretVariable {
  id: string
  name: string
  value: string
}

// Collection
export interface Collection {
  id: string
  name: string
  description?: string
  baseUrl?: string
  requests: Request[]
  folders: Collection[]
  parentId?: string
  openApiSource?: OpenApiSource
  secrets?: SecretVariable[]
}

// Environment
export interface Environment {
  id: string
  name: string
  baseUrl?: string
  variables: KeyValue[]
  isActive: boolean
}

// History Entry
export interface HistoryEntry {
  id: string
  request: Request
  response?: HttpResponse
  timestamp: number
  sourceRequestId?: string
  sourceCollectionId?: string
}

// Tab
export interface Tab {
  id: string
  request: Request
  isDirty: boolean
  sourceRequestId?: string
  sourceCollectionId?: string
}

// Command Palette Item
export interface CommandPaletteItem {
  id: string
  type: 'request' | 'collection' | 'action'
  title: string
  subtitle?: string
  icon?: string
  method?: HttpMethod
  action?: () => void
}
