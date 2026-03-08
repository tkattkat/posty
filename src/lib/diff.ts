import type { HistoryEntry, HttpRequest, KeyValue } from '../types'

export interface DiffResult {
  type: 'added' | 'removed' | 'changed' | 'unchanged'
  key: string
  left?: string
  right?: string
}

export interface RequestDiff {
  method: DiffResult
  url: DiffResult
  headers: DiffResult[]
  params: DiffResult[]
  body: DiffResult
  response: {
    status: DiffResult
    body: DiffResult
    time: DiffResult
    size: DiffResult
  }
}

function diffValue(key: string, left: string | undefined, right: string | undefined): DiffResult {
  if (left === right) {
    return { type: 'unchanged', key, left, right }
  }
  if (!left && right) {
    return { type: 'added', key, right }
  }
  if (left && !right) {
    return { type: 'removed', key, left }
  }
  return { type: 'changed', key, left, right }
}

function diffKeyValues(left: KeyValue[], right: KeyValue[]): DiffResult[] {
  const results: DiffResult[] = []
  const leftMap = new Map(left.filter(kv => kv.enabled).map(kv => [kv.key, kv.value]))
  const rightMap = new Map(right.filter(kv => kv.enabled).map(kv => [kv.key, kv.value]))

  // Check all left keys
  for (const [key, value] of leftMap) {
    if (!rightMap.has(key)) {
      results.push({ type: 'removed', key, left: value })
    } else if (rightMap.get(key) !== value) {
      results.push({ type: 'changed', key, left: value, right: rightMap.get(key) })
    } else {
      results.push({ type: 'unchanged', key, left: value, right: value })
    }
  }

  // Check for new keys in right
  for (const [key, value] of rightMap) {
    if (!leftMap.has(key)) {
      results.push({ type: 'added', key, right: value })
    }
  }

  return results
}

export function diffRequests(left: HistoryEntry, right: HistoryEntry): RequestDiff {
  const leftReq = left.request as HttpRequest
  const rightReq = right.request as HttpRequest

  return {
    method: diffValue('method', leftReq.method, rightReq.method),
    url: diffValue('url', leftReq.url, rightReq.url),
    headers: diffKeyValues(leftReq.headers, rightReq.headers),
    params: diffKeyValues(leftReq.params, rightReq.params),
    body: diffValue('body', leftReq.body.content, rightReq.body.content),
    response: {
      status: diffValue('status',
        left.response ? `${left.response.status} ${left.response.statusText}` : undefined,
        right.response ? `${right.response.status} ${right.response.statusText}` : undefined
      ),
      body: diffValue('body',
        left.response?.body,
        right.response?.body
      ),
      time: diffValue('time',
        left.response ? `${left.response.time}ms` : undefined,
        right.response ? `${right.response.time}ms` : undefined
      ),
      size: diffValue('size',
        left.response ? formatBytes(left.response.size) : undefined,
        right.response ? formatBytes(right.response.size) : undefined
      ),
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function hasChanges(diff: RequestDiff): boolean {
  if (diff.method.type !== 'unchanged') return true
  if (diff.url.type !== 'unchanged') return true
  if (diff.body.type !== 'unchanged') return true
  if (diff.headers.some(h => h.type !== 'unchanged')) return true
  if (diff.params.some(p => p.type !== 'unchanged')) return true
  if (diff.response.status.type !== 'unchanged') return true
  if (diff.response.body.type !== 'unchanged') return true
  return false
}
