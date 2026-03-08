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

// HTTP Request
export interface HttpRequest {
  id: string
  name: string
  type: 'http'
  method: HttpMethod
  url: string
  headers: KeyValue[]
  params: KeyValue[]
  body: {
    type: 'none' | 'json' | 'form' | 'text' | 'binary'
    content: string
  }
  auth?: {
    type: 'none' | 'bearer' | 'basic' | 'api-key'
    token?: string
    username?: string
    password?: string
    key?: string
    value?: string
    addTo?: 'header' | 'query'
  }
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

// Collection
export interface Collection {
  id: string
  name: string
  description?: string
  requests: Request[]
  folders: Collection[]
  parentId?: string
  openApiSource?: OpenApiSource
}

// Environment
export interface Environment {
  id: string
  name: string
  variables: KeyValue[]
  isActive: boolean
}

// History Entry
export interface HistoryEntry {
  id: string
  request: Request
  response?: HttpResponse
  timestamp: number
}

// Tab
export interface Tab {
  id: string
  request: Request
  isDirty: boolean
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
