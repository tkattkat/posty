import { useState } from 'react'
import { X, Save, Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useCollectionStore } from '../../stores/collectionStore'
import type { Collection, HttpRequest, KeyValue } from '../../types'

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

function convertImportedCollection(imported: ImportedCollection): { requests: HttpRequest[], folders: Collection[] } {
  return {
    requests: imported.requests.map((req): HttpRequest => ({
      id: crypto.randomUUID(),
      type: 'http',
      name: req.name,
      method: req.method as HttpRequest['method'],
      url: req.url,
      headers: req.headers as KeyValue[],
      params: req.params as KeyValue[],
      body: req.body ? { type: req.body.type as 'json' | 'text' | 'form' | 'none', content: req.body.content } : { type: 'none', content: '' },
    })),
    folders: imported.folders.map((folder) => {
      const converted = convertImportedCollection(folder)
      return {
        id: crypto.randomUUID(),
        name: folder.name,
        requests: converted.requests,
        folders: converted.folders,
      }
    }),
  }
}

interface EditSpecModalProps {
  collection: Collection
  onClose: () => void
}

export function EditSpecModal({ collection, onClose }: EditSpecModalProps) {
  const source = collection.openApiSource
  const isUrlBased = source?.type === 'url'

  const [specContent, setSpecContent] = useState(source?.spec || '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const { refreshCollectionFromSource, updateCollection } = useCollectionStore()

  const handleRefresh = async () => {
    if (!source?.url) return

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await invoke<ImportedCollection>('fetch_and_parse_openapi', { url: source.url })
      const { requests, folders } = convertImportedCollection(result)

      refreshCollectionFromSource(collection.id, requests, folders)
      setSuccess(`Refreshed with ${requests.length} requests`)

      setTimeout(onClose, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!specContent.trim()) {
      setError('Spec content cannot be empty')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await invoke<ImportedCollection>('parse_openapi_spec', { specContent: specContent.trim() })
      const { requests, folders } = convertImportedCollection(result)

      refreshCollectionFromSource(collection.id, requests, folders)

      // Update the stored spec
      updateCollection(collection.id, {
        openApiSource: {
          type: 'text',
          spec: specContent.trim(),
          lastUpdated: Date.now(),
        },
      })

      setSuccess(`Updated with ${requests.length} requests`)

      setTimeout(onClose, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const lastUpdated = source?.lastUpdated
    ? new Date(source.lastUpdated).toLocaleString()
    : 'Never'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl glass-elevated rounded-lg flex flex-col animate-scale-in max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-text-secondary" />
            <span className="text-[14px] font-medium">
              {isUrlBased ? 'Refresh Collection' : 'Edit Spec'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors text-text-muted hover:text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-auto">
          {isUrlBased ? (
            <div>
              <label className="block text-[12px] text-text-secondary mb-2">
                Source URL
              </label>
              <input
                type="text"
                value={source?.url || ''}
                disabled
                className="input-field text-[13px] font-mono opacity-60"
              />
              <p className="text-[11px] text-text-muted mt-2">
                Last updated: {lastUpdated}
              </p>
              <p className="text-[12px] text-text-secondary mt-4">
                Click refresh to fetch the latest spec from the URL and update all requests in this collection.
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
                className="input-field text-[13px] font-mono h-64 resize-none"
                autoFocus
              />
              <p className="text-[11px] text-text-muted mt-2">
                Last updated: {lastUpdated}
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
          {isUrlBased ? (
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={isLoading || !specContent.trim()}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
