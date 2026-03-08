import { useState, useEffect, useRef } from 'react'
import { X, Plus, Send, Loader2, Code, ChevronDown } from 'lucide-react'
import { useRequestStore } from '../../stores/requestStore'
import { useCollectionStore } from '../../stores/collectionStore'
import { isCurlCommand, curlToHttpRequest } from '../../lib/curlParser'
import { ResponsePanel } from '../ResponsePanel/ResponsePanel'
import { CodeGeneratorModal } from '../Modals/CodeGeneratorModal'
import type { HttpMethod, KeyValue } from '../../types'
import { invoke } from '@tauri-apps/api/core'

const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']

const methodColors: Record<HttpMethod, string> = {
  GET: '#22C55E',
  POST: '#F59E0B',
  PUT: '#3B82F6',
  PATCH: '#A855F7',
  DELETE: '#EF4444',
  OPTIONS: '#6B7280',
  HEAD: '#06B6D4',
}

function KeyValueEditor({
  items,
  onChange,
  placeholder = { key: 'Key', value: 'Value' },
}: {
  items: KeyValue[]
  onChange: (items: KeyValue[]) => void
  placeholder?: { key: string; value: string }
}) {
  const addItem = () => {
    onChange([...items, { id: crypto.randomUUID(), key: '', value: '', enabled: true }])
  }

  const updateItem = (id: string, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
    onChange(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id))
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={item.id} className="flex gap-2 items-center animate-fade-in" style={{ animationDelay: `${index * 30}ms` }}>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={item.enabled}
              onChange={(e) => updateItem(item.id, 'enabled', e.target.checked)}
              className="w-4 h-4 rounded border-border bg-black/20 accent-accent"
            />
          </label>
          <input
            type="text"
            value={item.key}
            onChange={(e) => updateItem(item.id, 'key', e.target.value)}
            placeholder={placeholder.key}
            className="flex-1 input-field text-sm py-2"
          />
          <input
            type="text"
            value={item.value}
            onChange={(e) => updateItem(item.id, 'value', e.target.value)}
            placeholder={placeholder.value}
            className="flex-1 input-field text-sm py-2"
          />
          <button
            onClick={() => removeItem(item.id)}
            className="p-2 text-text-tertiary hover:text-error hover:bg-error/10 rounded-md transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-accent transition-colors py-2"
      >
        <Plus className="w-3.5 h-3.5" />
        Add {placeholder.key.toLowerCase()}
      </button>
    </div>
  )
}

export function RequestPanel() {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    removeTab,
    addTab,
    getActiveRequest,
    updateActiveRequest,
    setResponse,
    setLoading,
    isLoading,
  } = useRequestStore()
  const { addToHistory } = useCollectionStore()
  const [activeSubTab, setActiveSubTab] = useState<'params' | 'headers' | 'body' | 'auth'>('params')
  const [showMethodDropdown, setShowMethodDropdown] = useState(false)
  const [showCodeGen, setShowCodeGen] = useState(false)
  const requestSplitRef = useRef<HTMLDivElement | null>(null)

  const activeRequest = getActiveRequest()
  const httpRequest = activeRequest?.type === 'http' ? activeRequest : null

  useEffect(() => {
    if (!requestSplitRef.current) return
    requestSplitRef.current.style.setProperty('--request-pane-width', '50%')
  }, [])

  // Handle paste for curl import
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text')
      if (text && isCurlCommand(text)) {
        const parsed = curlToHttpRequest(text)
        if (parsed) {
          e.preventDefault()
          addTab(parsed)
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [addTab])

  // Handle URL input for curl
  const handleUrlChange = (value: string) => {
    if (isCurlCommand(value)) {
      const parsed = curlToHttpRequest(value)
      if (parsed) {
        updateActiveRequest({
          method: parsed.method,
          url: parsed.url,
          headers: parsed.headers,
          params: parsed.params,
          body: parsed.body,
          auth: parsed.auth,
        })
        return
      }
    }
    updateActiveRequest({ url: value })
  }

  const handleSendRequest = async () => {
    if (!httpRequest || !httpRequest.url) return

    setLoading(true)
    setResponse(null)

    try {
      const response = await invoke<{
        status: number
        status_text: string
        headers: Record<string, string>
        body: string
        time: number
        size: number
      }>('send_http_request', {
        method: httpRequest.method,
        url: httpRequest.url,
        headers: httpRequest.headers
          .filter((h) => h.enabled && h.key)
          .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {}),
        body: httpRequest.body.type !== 'none' ? httpRequest.body.content : null,
      })

      const httpResponse = {
        status: response.status,
        statusText: response.status_text,
        headers: response.headers,
        body: response.body,
        time: response.time,
        size: response.size,
      }

      setResponse(httpResponse)
      addToHistory({ request: httpRequest, response: httpResponse, timestamp: Date.now() })
    } catch (error) {
      setResponse({
        status: 0,
        statusText: 'Error',
        headers: {},
        body: String(error),
        time: 0,
        size: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  // Keyboard shortcut to send
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSendRequest()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [httpRequest])

  if (!activeRequest) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="empty-state">
          <div className="empty-state-icon">
            <Send className="w-5 h-5" />
          </div>
          <p className="empty-state-title">No request open</p>
          <p className="empty-state-desc mb-4">Create a new request or paste a curl command</p>
          <button onClick={() => addTab()} className="btn-primary">
            New Request
          </button>
        </div>
      </div>
    )
  }

  const methodColor = httpRequest ? methodColors[httpRequest.method] : methodColors.GET

  const handleRequestPaneResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!requestSplitRef.current) return

    event.preventDefault()

    const container = requestSplitRef.current
    const rect = container.getBoundingClientRect()
    const minWidth = 320
    const maxWidth = rect.width - 320

    document.body.classList.add('is-resizing')

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(Math.max(moveEvent.clientX - rect.left, minWidth), maxWidth)
      container.style.setProperty('--request-pane-width', `${nextWidth}px`)
    }

    const handlePointerUp = () => {
      document.body.classList.remove('is-resizing')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="tab-bar">
        <div className="tab-scroll-container">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            const color = tab.request.type === 'http' ? methodColors[tab.request.method] : methodColors.GET
            return (
              <div
                key={tab.id}
                className={`tab-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.request.type === 'http' && (
                  <span
                    className="method-badge"
                    style={{
                      backgroundColor: `${color}18`,
                      color: color
                    }}
                  >
                    {tab.request.method.slice(0, 3)}
                  </span>
                )}
                <span className="tab-name">{tab.request.name}</span>
                {tab.isDirty && <span className="dirty-indicator" />}
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    removeTab(tab.id)
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="tab-close-btn"
                  aria-label="Close tab"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
        <button
          onClick={() => addTab()}
          className="tab-add-btn"
          aria-label="New tab"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* URL Bar */}
      <div className="px-4 py-3 flex-shrink-0 border-b border-border">
        <div className="flex gap-2">
          {httpRequest && (
            <div className="relative">
              <button
                onClick={() => setShowMethodDropdown(!showMethodDropdown)}
                className="method-selector"
                style={{ color: methodColor }}
              >
                {httpRequest.method}
                <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
              </button>
              {showMethodDropdown && (
                <div className="absolute top-full left-0 mt-1 py-1 bg-surface-raised border border-border rounded shadow-lg z-50 min-w-[100px] animate-fade-in">
                  {methods.map((method) => (
                    <button
                      key={method}
                      onClick={() => {
                        updateActiveRequest({ method })
                        setShowMethodDropdown(false)
                      }}
                      className="w-full px-3 py-1.5 text-left text-[13px] font-mono font-semibold hover:bg-bg-hover transition-colors"
                      style={{ color: methodColors[method] }}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <input
            type="text"
            value={'url' in activeRequest ? activeRequest.url : ''}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="Enter URL or paste curl command..."
            className="flex-1 url-input font-mono text-[13px]"
          />
          <button
            onClick={() => setShowCodeGen(true)}
            disabled={!httpRequest?.url}
            className="btn-ghost p-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Generate Code"
          >
            <Code className="w-5 h-5" />
          </button>
          <button
            onClick={handleSendRequest}
            disabled={isLoading || !httpRequest?.url}
            className="send-button disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send
          </button>
        </div>
      </div>

      {/* Split View: Request Config + Response */}
      <div ref={requestSplitRef} className="request-split-shell flex-1 flex min-h-0">
        {/* Request Config */}
        <div className="request-pane flex flex-col min-h-0">
          {/* Sub Tabs */}
          <div className="flex gap-1 px-4 py-2 border-b border-border flex-shrink-0">
            {(['params', 'headers', 'body', 'auth'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`tab capitalize flex items-center gap-1.5 ${activeSubTab === tab ? 'tab-active' : ''}`}
              >
                {tab}
                {tab === 'params' && httpRequest && httpRequest.params.length > 0 && (
                  <span className="text-[10px] text-text-muted tabular-nums">
                    {httpRequest.params.length}
                  </span>
                )}
                {tab === 'headers' && httpRequest && httpRequest.headers.length > 0 && (
                  <span className="text-[10px] text-text-muted tabular-nums">
                    {httpRequest.headers.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4">
            {httpRequest && activeSubTab === 'params' && (
              <KeyValueEditor
                items={httpRequest.params}
                onChange={(params) => updateActiveRequest({ params })}
                placeholder={{ key: 'Parameter', value: 'Value' }}
              />
            )}

            {httpRequest && activeSubTab === 'headers' && (
              <KeyValueEditor
                items={httpRequest.headers}
                onChange={(headers) => updateActiveRequest({ headers })}
                placeholder={{ key: 'Header', value: 'Value' }}
              />
            )}

            {httpRequest && activeSubTab === 'body' && (
              <div>
                <div className="flex gap-1 mb-4">
                  {(['none', 'json', 'text', 'form'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => updateActiveRequest({ body: { ...httpRequest.body, type } })}
                      className={`tab capitalize ${httpRequest.body.type === type ? 'tab-active' : ''}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {httpRequest.body.type !== 'none' && (
                  <textarea
                    value={httpRequest.body.content}
                    onChange={(e) => updateActiveRequest({ body: { ...httpRequest.body, content: e.target.value } })}
                    placeholder={httpRequest.body.type === 'json' ? '{\n  "key": "value"\n}' : 'Enter request body...'}
                    className="w-full h-48 input-field font-mono text-sm resize-none"
                  />
                )}
              </div>
            )}

            {httpRequest && activeSubTab === 'auth' && (
              <div className="space-y-4">
                <select
                  value={httpRequest.auth?.type || 'none'}
                  onChange={(e) => updateActiveRequest({ auth: { ...httpRequest.auth, type: e.target.value as any } })}
                  className="input-field text-sm"
                >
                  <option value="none">No Auth</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                  <option value="api-key">API Key</option>
                </select>

                {httpRequest.auth?.type === 'bearer' && (
                  <input
                    type="text"
                    value={httpRequest.auth.token || ''}
                    onChange={(e) => updateActiveRequest({ auth: { ...httpRequest.auth, type: 'bearer', token: e.target.value } })}
                    placeholder="Enter token"
                    className="input-field font-mono text-sm"
                  />
                )}

                {httpRequest.auth?.type === 'basic' && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={httpRequest.auth.username || ''}
                      onChange={(e) => updateActiveRequest({ auth: { ...httpRequest.auth, type: 'basic', username: e.target.value } })}
                      placeholder="Username"
                      className="input-field text-sm"
                    />
                    <input
                      type="password"
                      value={httpRequest.auth.password || ''}
                      onChange={(e) => updateActiveRequest({ auth: { ...httpRequest.auth, type: 'basic', password: e.target.value } })}
                      placeholder="Password"
                      className="input-field text-sm"
                    />
                  </div>
                )}

                {httpRequest.auth?.type === 'api-key' && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={httpRequest.auth.key || ''}
                      onChange={(e) => updateActiveRequest({ auth: { ...httpRequest.auth, type: 'api-key', key: e.target.value } })}
                      placeholder="Header name"
                      className="input-field text-sm"
                    />
                    <input
                      type="text"
                      value={httpRequest.auth.value || ''}
                      onChange={(e) => updateActiveRequest({ auth: { ...httpRequest.auth, type: 'api-key', value: e.target.value } })}
                      placeholder="Value"
                      className="input-field text-sm"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          className="split-handle split-handle-vertical"
          onPointerDown={handleRequestPaneResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize request and response panels"
        />

        {/* Response Panel */}
        <div className="response-pane min-h-0">
          <ResponsePanel />
        </div>
      </div>

      {/* Code Generation Modal */}
      {showCodeGen && httpRequest && (
        <CodeGeneratorModal request={httpRequest} onClose={() => setShowCodeGen(false)} />
      )}
    </div>
  )
}
