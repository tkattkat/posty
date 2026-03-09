import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, Plus, Send, Loader2, Code, ChevronDown, Lock, Globe } from 'lucide-react'
import { useRequestStore } from '../../stores/requestStore'
import { useCollectionStore } from '../../stores/collectionStore'
import { isCurlCommand, curlToHttpRequest } from '../../lib/curlParser'
import { ResponsePanel } from '../ResponsePanel/ResponsePanel'
import { CodeGeneratorModal } from '../Modals/CodeGeneratorModal'
import type { HttpMethod, KeyValue, Request, SecretVariable } from '../../types'
import { createSecretReference, getSecretReferenceName } from '../../lib/secrets'
import { createExecutionErrorResponse, executeHttpRequest } from '../../lib/requestExecution'
import { RequestTestsEditor } from './RequestTestsEditor'

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

// Syntax highlight JSON string for display
function highlightJson(json: string): string {
  if (!json.trim()) return ''

  // Escape HTML
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Apply syntax highlighting
  return escaped
    // Strings (but not keys)
    .replace(/: *("(?:[^"\\]|\\.)*")/g, ': <span class="json-string">$1</span>')
    // Keys
    .replace(/"([^"]+)"(?=\s*:)/g, '<span class="json-key">"$1"</span>')
    // Numbers
    .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
    // Booleans
    .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
    // Null
    .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>')
    // Brackets
    .replace(/([{}\[\]])/g, '<span class="json-bracket">$1</span>')
}

function JsonBodyEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLPreElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }

  const formatJson = () => {
    try {
      const parsed = JSON.parse(value)
      onChange(JSON.stringify(parsed, null, 2))
    } catch {
      // Invalid JSON, don't format
    }
  }

  const highlighted = useMemo(() => highlightJson(value), [value])

  return (
    <div ref={containerRef} className="json-editor-container">
      <pre
        ref={highlightRef}
        className="json-editor-highlight"
        dangerouslySetInnerHTML={{ __html: highlighted || '<span class="json-placeholder">{\n  "key": "value"\n}</span>' }}
      />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        placeholder=""
        className="json-editor-input"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={formatJson}
        className="json-editor-format"
        title="Format JSON"
      >
        Format
      </button>
    </div>
  )
}

function KeyValueEditor({
  items,
  onChange,
  placeholder = { key: 'Key', value: 'Value' },
  secrets = [],
  enableSecretTokens = false,
}: {
  items: KeyValue[]
  onChange: (items: KeyValue[]) => void
  placeholder?: { key: string; value: string }
  secrets?: SecretVariable[]
  enableSecretTokens?: boolean
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
            />
          </label>
          <input
            type="text"
            value={item.key}
            onChange={(e) => updateItem(item.id, 'key', e.target.value)}
            placeholder={placeholder.key}
            className="flex-1 input-field text-sm py-2"
          />
          {enableSecretTokens ? (
            <SecretValueInput
              value={item.value}
              onChange={(value) => updateItem(item.id, 'value', value)}
              secrets={secrets}
              placeholder={placeholder.value}
            />
          ) : (
            <input
              type="text"
              value={item.value}
              onChange={(e) => updateItem(item.id, 'value', e.target.value)}
              placeholder={placeholder.value}
              className="flex-1 input-field text-sm py-2"
            />
          )}
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

function SecretValueInput({
  value,
  onChange,
  secrets,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  secrets: SecretVariable[]
  placeholder: string
}) {
  const [query, setQuery] = useState(value.startsWith('/') ? value.slice(1) : '')
  const [isPickerOpen, setIsPickerOpen] = useState(value.startsWith('/'))
  const secretReferenceName = getSecretReferenceName(value)

  const filteredSecrets = secrets.filter((secret) =>
    secret.name.toLowerCase().includes(query.toLowerCase())
  )

  if (secretReferenceName) {
    return (
      <div className="secret-chip-field">
        <button
          type="button"
          className="secret-chip"
          onClick={() => onChange('')}
          title={`Secret reference: ${secretReferenceName}`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span className="secret-chip-label">{secretReferenceName}</span>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const nextValue = e.target.value
          onChange(nextValue)

          if (nextValue.startsWith('/')) {
            setQuery(nextValue.slice(1))
            setIsPickerOpen(true)
          } else {
            setQuery('')
            setIsPickerOpen(false)
          }
        }}
        onBlur={() => {
          window.setTimeout(() => setIsPickerOpen(false), 120)
        }}
        onFocus={() => {
          if (value.startsWith('/')) {
            setIsPickerOpen(true)
          }
        }}
        placeholder={placeholder}
        className="w-full input-field text-sm py-2"
      />

      {isPickerOpen && (
        <div className="secret-picker">
          {filteredSecrets.length > 0 ? (
            filteredSecrets.map((secret) => (
              <button
                key={secret.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(createSecretReference(secret.name))
                  setIsPickerOpen(false)
                  setQuery('')
                }}
                className="secret-picker-item"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="secret-picker-label">{secret.name}</span>
              </button>
            ))
          ) : (
            <div className="secret-picker-empty">
              {secrets.length === 0 ? 'No collection secrets yet' : 'No matching secrets'}
            </div>
          )}
        </div>
      )}
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
    setExecutionResult,
    setLoading,
    isLoading,
    tabExecutionResults,
  } = useRequestStore()
  const executionResult = activeTabId ? tabExecutionResults[activeTabId] ?? null : null
  const { addToHistory, findCollectionById, findCollectionByRequestId, getEffectiveBaseUrlForCollection, getEffectiveBaseUrlForRequest, updateRequestInCollection, getActiveEnvironment, environments, setActiveEnvironment, activeEnvironmentId } = useCollectionStore()
  const [activeSubTab, setActiveSubTab] = useState<'params' | 'headers' | 'cookies' | 'body' | 'auth' | 'tests'>('params')
  const [showMethodDropdown, setShowMethodDropdown] = useState(false)
  const [showEnvDropdown, setShowEnvDropdown] = useState(false)
  const [showCodeGen, setShowCodeGen] = useState(false)
  const requestSplitRef = useRef<HTMLDivElement | null>(null)

  const activeRequest = getActiveRequest()
  const httpRequest = activeRequest?.type === 'http' ? activeRequest : null
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null
  const activeCollection =
    (activeTab?.sourceCollectionId ? findCollectionById(activeTab.sourceCollectionId) : null) ??
    (activeTab?.sourceRequestId ? findCollectionByRequestId(activeTab.sourceRequestId) : null)
  const activeEnvironment = getActiveEnvironment()

  // Merge collection secrets with environment secrets (environment secrets take priority)
  const activeSecrets = useMemo(() => {
    const collectionSecrets = activeCollection?.secrets ?? []
    const envSecrets = activeEnvironment?.secrets ?? []

    // Create a map with collection secrets first, then override with env secrets
    const secretsMap = new Map<string, SecretVariable>()
    for (const secret of collectionSecrets) {
      secretsMap.set(secret.name, secret)
    }
    for (const secret of envSecrets) {
      secretsMap.set(secret.name, secret)
    }

    return Array.from(secretsMap.values())
  }, [activeCollection, activeEnvironment])

  // Environment baseUrl takes priority over collection baseUrl
  const collectionBaseUrl =
    (activeCollection?.id ? getEffectiveBaseUrlForCollection(activeCollection.id) : undefined) ??
    (activeTab?.sourceRequestId ? getEffectiveBaseUrlForRequest(activeTab.sourceRequestId) : undefined)
  const effectiveBaseUrl = activeEnvironment?.baseUrl || collectionBaseUrl

  // Convert environment variables to Record<string, string>
  const envVariables = useMemo(() => {
    if (!activeEnvironment?.variables) return {}
    return activeEnvironment.variables
      .filter(v => v.enabled && v.key)
      .reduce<Record<string, string>>((acc, v) => {
        acc[v.key] = v.value
        return acc
      }, {})
  }, [activeEnvironment?.variables])

  const updateRequestAndSource = useCallback((updates: Partial<Request>) => {
    updateActiveRequest(updates)

    if (activeTab?.sourceRequestId) {
      updateRequestInCollection(activeTab.sourceRequestId, updates)
    }
  }, [activeTab?.sourceRequestId, updateActiveRequest, updateRequestInCollection])

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
        updateRequestAndSource({
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
    updateRequestAndSource({ url: value })
  }

  const handleSendRequest = useCallback(async () => {
    if (!httpRequest || !httpRequest.url) return

    setLoading(true)
    setResponse(null)
    setExecutionResult(null)

    try {
      const result = await executeHttpRequest(httpRequest, {
        secrets: activeSecrets,
        baseUrl: effectiveBaseUrl,
        envVariables,
      })

      setResponse(result.response)
      setExecutionResult(result)
      addToHistory({
        request: httpRequest,
        response: result.response,
        timestamp: Date.now(),
        sourceCollectionId: activeCollection?.id,
        sourceRequestId: activeTab?.sourceRequestId,
      })
    } catch (error) {
      setResponse(createExecutionErrorResponse(error))
      setExecutionResult(null)
    } finally {
      setLoading(false)
    }
  }, [activeCollection?.id, activeSecrets, activeTab?.sourceRequestId, addToHistory, effectiveBaseUrl, envVariables, httpRequest, setExecutionResult, setLoading, setResponse])

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
  }, [handleSendRequest])

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
        <div className="flex gap-2 items-center">
          {/* Environment Selector */}
          <div className="relative flex items-center">
            <button
              onClick={() => setShowEnvDropdown(!showEnvDropdown)}
              className={`h-[36px] flex items-center gap-1.5 px-3 rounded-lg text-[13px] font-medium border transition-all duration-100 ${
                activeEnvironment
                  ? 'bg-transparent text-green-500 border-green-500/30 hover:border-green-500/50'
                  : 'bg-transparent border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
              }`}
              title={activeEnvironment ? `Environment: ${activeEnvironment.name}` : 'No environment'}
            >
              <Globe className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="max-w-[60px] truncate">
                {activeEnvironment?.name || 'Env'}
              </span>
              <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-50" />
            </button>
            {showEnvDropdown && (
              <div className="absolute top-full left-0 mt-1 py-1 bg-surface-raised border border-border rounded-lg shadow-lg z-50 min-w-[180px] animate-fade-in">
                <button
                  onClick={() => {
                    setActiveEnvironment(null)
                    setShowEnvDropdown(false)
                  }}
                  className={`w-full px-3 py-2 text-left text-[12px] hover:bg-bg-hover transition-colors flex items-center gap-2.5 ${
                    !activeEnvironmentId ? 'text-accent' : 'text-text-secondary'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${!activeEnvironmentId ? 'bg-accent' : 'bg-text-muted'}`} />
                  <span>No Environment</span>
                </button>
                {environments.length > 0 && <div className="border-t border-border my-1" />}
                {environments.map((env) => (
                  <button
                    key={env.id}
                    onClick={() => {
                      setActiveEnvironment(env.id)
                      setShowEnvDropdown(false)
                    }}
                    className={`w-full px-3 py-2 text-left text-[12px] hover:bg-bg-hover transition-colors flex items-center gap-2.5 ${
                      env.id === activeEnvironmentId ? 'text-green-500' : 'text-text-secondary'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${env.id === activeEnvironmentId ? 'bg-green-500' : 'bg-text-muted'}`} />
                    <span className="flex-1 truncate">{env.name}</span>
                    {env.baseUrl && (
                      <span className="text-[10px] text-text-muted truncate max-w-[60px]">
                        {env.baseUrl.replace(/^https?:\/\//, '').split('/')[0]}
                      </span>
                    )}
                  </button>
                ))}
                {environments.length === 0 && (
                  <p className="px-3 py-2 text-[11px] text-text-muted">
                    No environments yet
                  </p>
                )}
              </div>
            )}
          </div>

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
                        updateRequestAndSource({ method })
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

          <button
            onClick={() => setShowCodeGen(true)}
            disabled={!httpRequest?.url}
            className="btn-ghost p-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Generate Code"
          >
            <Code className="w-5 h-5" />
          </button>
        </div>
        {httpRequest && effectiveBaseUrl && httpRequest.url && !/^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(httpRequest.url.trim()) && (
          <p className="mt-2 text-[11px] text-text-muted">
            Relative path resolves against <span className="font-mono text-text-secondary">{effectiveBaseUrl}</span>
          </p>
        )}
      </div>

      {/* Split View: Request Config + Response */}
      <div ref={requestSplitRef} className="request-split-shell">
        {/* Request Config */}
        <div className="request-pane">
          {/* Sub Tabs */}
          <div className="request-subtabs">
            {(['params', 'headers', 'cookies', 'body', 'auth', 'tests'] as const).map((tab) => (
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
                {tab === 'cookies' && httpRequest && (httpRequest.cookies?.length ?? 0) > 0 && (
                  <span className="text-[10px] text-text-muted tabular-nums">
                    {httpRequest.cookies?.length}
                  </span>
                )}
                {tab === 'tests' && httpRequest && (httpRequest.tests?.length ?? 0) > 0 && (
                  <span className="text-[10px] text-text-muted tabular-nums">
                    {httpRequest.tests?.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="request-content">
            {httpRequest && activeSubTab === 'params' && (
              <KeyValueEditor
                items={httpRequest.params}
                onChange={(params) => updateRequestAndSource({ params })}
                placeholder={{ key: 'Parameter', value: 'Value' }}
              />
            )}

            {httpRequest && activeSubTab === 'headers' && (
              <KeyValueEditor
                items={httpRequest.headers}
                onChange={(headers) => updateRequestAndSource({ headers })}
                placeholder={{ key: 'Header', value: 'Value or /secret' }}
                secrets={activeSecrets}
                enableSecretTokens
              />
            )}

            {httpRequest && activeSubTab === 'cookies' && (
              <KeyValueEditor
                items={httpRequest.cookies ?? []}
                onChange={(cookies) => updateRequestAndSource({ cookies })}
                placeholder={{ key: 'Cookie name', value: 'Cookie value' }}
                secrets={activeSecrets}
                enableSecretTokens
              />
            )}

            {httpRequest && activeSubTab === 'body' && (
              <div>
                <div className="flex gap-1 mb-4">
                  {(['none', 'json', 'text', 'form'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => updateRequestAndSource({ body: { ...httpRequest.body, type } })}
                      className={`tab capitalize ${httpRequest.body.type === type ? 'tab-active' : ''}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {httpRequest.body.type !== 'none' && httpRequest.body.type === 'json' ? (
                  <JsonBodyEditor
                    value={httpRequest.body.content}
                    onChange={(content) => updateRequestAndSource({ body: { ...httpRequest.body, content } })}
                  />
                ) : httpRequest.body.type !== 'none' && (
                  <textarea
                    value={httpRequest.body.content}
                    onChange={(e) => updateRequestAndSource({ body: { ...httpRequest.body, content: e.target.value } })}
                    placeholder="Enter request body..."
                    className="w-full h-48 input-field font-mono text-sm resize-none"
                  />
                )}
              </div>
            )}

            {httpRequest && activeSubTab === 'auth' && (
              <div className="space-y-4">
                <select
                  value={httpRequest.auth?.type || 'none'}
                  onChange={(e) =>
                    updateRequestAndSource({
                      auth: {
                        ...httpRequest.auth,
                        type: e.target.value as NonNullable<typeof httpRequest.auth>['type'],
                      },
                    })
                  }
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
                    onChange={(e) => updateRequestAndSource({ auth: { ...httpRequest.auth, type: 'bearer', token: e.target.value } })}
                    placeholder="Enter token"
                    className="input-field font-mono text-sm"
                  />
                )}

                {httpRequest.auth?.type === 'basic' && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={httpRequest.auth.username || ''}
                      onChange={(e) => updateRequestAndSource({ auth: { ...httpRequest.auth, type: 'basic', username: e.target.value } })}
                      placeholder="Username"
                      className="input-field text-sm"
                    />
                    <input
                      type="password"
                      value={httpRequest.auth.password || ''}
                      onChange={(e) => updateRequestAndSource({ auth: { ...httpRequest.auth, type: 'basic', password: e.target.value } })}
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
                      onChange={(e) => updateRequestAndSource({ auth: { ...httpRequest.auth, type: 'api-key', key: e.target.value } })}
                      placeholder="Header name"
                      className="input-field text-sm"
                    />
                    <input
                      type="text"
                      value={httpRequest.auth.value || ''}
                      onChange={(e) => updateRequestAndSource({ auth: { ...httpRequest.auth, type: 'api-key', value: e.target.value } })}
                      placeholder="Value"
                      className="input-field text-sm"
                    />
                  </div>
                )}
              </div>
            )}

            {httpRequest && activeSubTab === 'tests' && (
              <RequestTestsEditor
                tests={httpRequest.tests ?? []}
                onTestsChange={(tests) => updateRequestAndSource({ tests })}
                extractions={httpRequest.extractions ?? []}
                onExtractionsChange={(extractions) => updateRequestAndSource({ extractions })}
                latestExecution={executionResult}
              />
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
        <div className="response-pane">
          <ResponsePanel />
        </div>
      </div>

      {/* Code Generation Modal */}
      {showCodeGen && httpRequest && (
        <CodeGeneratorModal
          request={httpRequest}
          secrets={activeSecrets}
          onClose={() => setShowCodeGen(false)}
        />
      )}
    </div>
  )
}
