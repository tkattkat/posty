import { useState, useMemo } from 'react'
import { Copy, Check, Code2, FileText, Clock, HardDrive, Zap, ChevronRight, ChevronDown } from 'lucide-react'
import { useRequestStore } from '../../stores/requestStore'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'var(--success)'
  if (status >= 300 && status < 400) return 'var(--warning)'
  if (status >= 400 && status < 500) return '#F97316'
  if (status >= 500) return 'var(--error)'
  return 'var(--text-secondary)'
}

// Syntax highlighting for JSON
function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 2)

  if (value === null) {
    return <span className="json-null">null</span>
  }

  if (typeof value === 'boolean') {
    return <span className="json-boolean">{value.toString()}</span>
  }

  if (typeof value === 'number') {
    return <span className="json-number">{value}</span>
  }

  if (typeof value === 'string') {
    // Check if it's a URL
    if (value.match(/^https?:\/\//)) {
      return <span className="json-string">"{value}"</span>
    }
    // Check if it's a date
    if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return <span className="json-string json-date">"{value}"</span>
    }
    return <span className="json-string">"{value}"</span>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="json-bracket">[]</span>
    }

    if (collapsed) {
      return (
        <span>
          <button onClick={() => setCollapsed(false)} className="json-toggle">
            <ChevronRight className="w-3 h-3" />
          </button>
          <span className="json-bracket">[</span>
          <span className="json-collapsed">{value.length} items</span>
          <span className="json-bracket">]</span>
        </span>
      )
    }

    return (
      <span>
        <button onClick={() => setCollapsed(true)} className="json-toggle">
          <ChevronDown className="w-3 h-3" />
        </button>
        <span className="json-bracket">[</span>
        <div className="json-indent">
          {value.map((item, index) => (
            <div key={index} className="json-line">
              <JsonValue value={item} depth={depth + 1} />
              {index < value.length - 1 && <span className="json-comma">,</span>}
            </div>
          ))}
        </div>
        <span className="json-bracket">]</span>
      </span>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)

    if (entries.length === 0) {
      return <span className="json-bracket">{'{}'}</span>
    }

    if (collapsed) {
      return (
        <span>
          <button onClick={() => setCollapsed(false)} className="json-toggle">
            <ChevronRight className="w-3 h-3" />
          </button>
          <span className="json-bracket">{'{'}</span>
          <span className="json-collapsed">{entries.length} keys</span>
          <span className="json-bracket">{'}'}</span>
        </span>
      )
    }

    return (
      <span>
        <button onClick={() => setCollapsed(true)} className="json-toggle">
          <ChevronDown className="w-3 h-3" />
        </button>
        <span className="json-bracket">{'{'}</span>
        <div className="json-indent">
          {entries.map(([key, val], index) => (
            <div key={key} className="json-line">
              <span className="json-key">"{key}"</span>
              <span className="json-colon">: </span>
              <JsonValue value={val} depth={depth + 1} />
              {index < entries.length - 1 && <span className="json-comma">,</span>}
            </div>
          ))}
        </div>
        <span className="json-bracket">{'}'}</span>
      </span>
    )
  }

  return <span>{String(value)}</span>
}

function JsonViewer({ json }: { json: string }) {
  const parsed = useMemo(() => {
    try {
      return JSON.parse(json)
    } catch {
      return null
    }
  }, [json])

  if (!parsed) {
    return <pre className="json-raw">{json}</pre>
  }

  return (
    <div className="json-viewer">
      <JsonValue value={parsed} />
    </div>
  )
}

export function ResponsePanel() {
  const { response, isLoading } = useRequestStore()
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body')
  const [viewMode, setViewMode] = useState<'pretty' | 'raw'>('pretty')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!response) return
    await navigator.clipboard.writeText(response.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-8 h-8 mx-auto mb-3">
            <div className="absolute inset-0 border-2 border-border rounded-full" />
            <div className="absolute inset-0 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-[13px] text-text-secondary">Sending...</p>
        </div>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="empty-state">
          <div className="empty-state-icon">
            <Zap className="w-5 h-5" />
          </div>
          <p className="empty-state-title">Response will appear here</p>
          <p className="empty-state-desc">Press <span className="kbd">⌘↵</span> to send</p>
        </div>
      </div>
    )
  }

  const isJson = response.headers['content-type']?.includes('application/json')
  const statusColor = getStatusColor(response.status)

  return (
    <div className="h-full flex flex-col">
      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span
              className="response-status"
              style={{ color: statusColor }}
            >
              {response.status}
            </span>
            <span className="text-[13px] text-text-secondary">{response.statusText}</span>
          </div>

          {/* Metrics */}
          <div className="response-metrics">
            <span className="response-metric">
              <Clock className="w-3 h-3" />
              {formatTime(response.time)}
            </span>
            <span className="response-metric">
              <HardDrive className="w-3 h-3" />
              {formatBytes(response.size)}
            </span>
          </div>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="btn-ghost p-1.5"
          title="Copy response"
        >
          {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('body')}
            className={`tab ${activeTab === 'body' ? 'tab-active' : ''}`}
          >
            Body
          </button>
          <button
            onClick={() => setActiveTab('headers')}
            className={`tab flex items-center gap-1.5 ${activeTab === 'headers' ? 'tab-active' : ''}`}
          >
            Headers
            <span className="text-[10px] text-text-muted tabular-nums">
              {Object.keys(response.headers).length}
            </span>
          </button>
        </div>

        {activeTab === 'body' && isJson && (
          <div className="segmented-control" style={{ padding: '2px' }}>
            <button
              onClick={() => setViewMode('pretty')}
              className={viewMode === 'pretty' ? 'active' : ''}
              title="Pretty"
              style={{ padding: '4px 8px' }}
            >
              <Code2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={viewMode === 'raw' ? 'active' : ''}
              title="Raw"
              style={{ padding: '4px 8px' }}
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto response-content">
        {activeTab === 'body' && (
          <>
            {!response.body ? (
              <div className="h-full flex items-center justify-center">
                <span className="text-text-muted text-[13px]">Empty response body</span>
              </div>
            ) : isJson && viewMode === 'pretty' ? (
              <JsonViewer json={response.body} />
            ) : (
              <pre className="response-raw">{response.body}</pre>
            )}
          </>
        )}

        {activeTab === 'headers' && (
          <div className="response-headers">
            {Object.entries(response.headers).map(([key, value]) => (
              <div key={key} className="response-header">
                <span className="response-header-key">{key}</span>
                <span className="response-header-value">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
