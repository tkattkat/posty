import { useState } from 'react'
import { X, Upload, Link, FileJson, Loader2, Check, AlertCircle } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useCollectionStore } from '../../stores/collectionStore'
import type { Collection, HttpRequest, KeyValue, OpenApiSource } from '../../types'

interface ImportedRequest {
  id: string
  name: string
  method: string
  url: string
  headers: Array<{ id: string; key: string; value: string; enabled: boolean; description?: string }>
  params: Array<{ id: string; key: string; value: string; enabled: boolean; description?: string }>
  body: { type: string; content: string } | null
}

interface ImportedCollection {
  name: string
  description: string | null
  requests: ImportedRequest[]
  folders: ImportedCollection[]
}

function convertImportedCollection(imported: ImportedCollection): Collection {
  return {
    id: crypto.randomUUID(),
    name: imported.name,
    requests: imported.requests.map((req): HttpRequest => ({
      id: req.id,
      type: 'http',
      name: req.name,
      method: req.method as HttpRequest['method'],
      url: req.url,
      headers: req.headers as KeyValue[],
      params: req.params as KeyValue[],
      body: req.body ? { type: req.body.type as 'json' | 'text' | 'form' | 'none', content: req.body.content } : { type: 'none', content: '' },
    })),
    folders: imported.folders.map(convertImportedCollection),
  }
}

interface ImportModalProps {
  onClose: () => void
}

export function ImportModal({ onClose }: ImportModalProps) {
  const [mode, setMode] = useState<'url' | 'paste'>('url')
  const [url, setUrl] = useState('')
  const [specContent, setSpecContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const { importCollection } = useCollectionStore()

  const handleImport = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      let result: ImportedCollection

      if (mode === 'url') {
        if (!url.trim()) {
          throw new Error('Please enter a URL')
        }
        result = await invoke<ImportedCollection>('fetch_and_parse_openapi', { url: url.trim() })
      } else {
        if (!specContent.trim()) {
          throw new Error('Please paste an OpenAPI spec')
        }
        result = await invoke<ImportedCollection>('parse_openapi_spec', { specContent: specContent.trim() })
      }

      const collection = convertImportedCollection(result)

      // Store the source info for refresh/edit later
      const source: OpenApiSource = mode === 'url'
        ? { type: 'url', url: url.trim() }
        : { type: 'text', spec: specContent.trim() }

      importCollection(collection, source)

      const requestCount = countRequests(result)
      setSuccess(`Imported "${result.name}" with ${requestCount} requests`)

      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const countRequests = (col: ImportedCollection): number => {
    return col.requests.length + col.folders.reduce((sum, f) => sum + countRequests(f), 0)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg glass-elevated rounded-lg flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-text-secondary" />
            <span className="text-[14px] font-medium">Import Collection</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors text-text-muted hover:text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="px-4 py-3 border-b border-border">
          <div className="segmented-control">
            <button
              onClick={() => setMode('url')}
              className={mode === 'url' ? 'active' : ''}
            >
              <Link className="w-3.5 h-3.5 mr-1.5 inline" />
              From URL
            </button>
            <button
              onClick={() => setMode('paste')}
              className={mode === 'paste' ? 'active' : ''}
            >
              <FileJson className="w-3.5 h-3.5 mr-1.5 inline" />
              Paste Spec
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex-1">
          {mode === 'url' ? (
            <div>
              <label className="block text-[12px] text-text-secondary mb-2">
                OpenAPI/Swagger Spec URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/openapi.json"
                className="input-field text-[13px] font-mono"
                autoFocus
              />
              <p className="text-[11px] text-text-muted mt-2">
                Supports OpenAPI 3.x and Swagger 2.x (JSON or YAML)
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-[12px] text-text-secondary mb-2">
                OpenAPI/Swagger Spec
              </label>
              <textarea
                value={specContent}
                onChange={(e) => setSpecContent(e.target.value)}
                placeholder='{"openapi": "3.0.0", ...}'
                className="input-field text-[13px] font-mono h-48 resize-none"
                autoFocus
              />
              <p className="text-[11px] text-text-muted mt-2">
                Paste your OpenAPI spec in JSON or YAML format
              </p>
            </div>
          )}

          {/* Status Messages */}
          {error && (
            <div className="mt-4 p-3 bg-error-muted rounded flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
              <span className="text-[13px] text-error">{error}</span>
            </div>
          )}

          {success && (
            <div className="mt-4 p-3 bg-success-muted rounded flex items-start gap-2">
              <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
              <span className="text-[13px] text-success">{success}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isLoading || (mode === 'url' && !url.trim()) || (mode === 'paste' && !specContent.trim())}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Import
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
