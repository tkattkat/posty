import { useState } from 'react'
import { X, Save, Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useCollectionStore } from '../../stores/collectionStore'
import type { Collection } from '../../types'
import { convertImportedCollectionContents, type ImportedCollection } from '../../lib/openapiImport'

interface OpenApiFileMetadata {
  modified_at: number
}

interface EditSpecModalProps {
  collection: Collection
  onClose: () => void
}

export function EditSpecModal({ collection, onClose }: EditSpecModalProps) {
  const source = collection.openApiSource
  const isUrlBased = source?.type === 'url'
  const isFileBased = source?.type === 'file'

  const [specContent, setSpecContent] = useState(source?.spec || '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const { refreshCollectionFromSource, updateCollection } = useCollectionStore()

  const handleRefresh = async () => {
    if (!source) return

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = isFileBased
        ? await invoke<ImportedCollection>('parse_openapi_file', { filePath: source.path })
        : await invoke<ImportedCollection>('fetch_and_parse_openapi', { url: source.url })
      const { requests, folders } = convertImportedCollectionContents(result)

      const sourceUpdates = isFileBased
        ? {
            sourceModifiedAt: (
              await invoke<OpenApiFileMetadata>('get_openapi_file_metadata', { filePath: source.path })
            ).modified_at,
          }
        : undefined

      refreshCollectionFromSource(collection.id, requests, folders, sourceUpdates)
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
      const { requests, folders } = convertImportedCollectionContents(result)

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
              {isUrlBased || isFileBased ? 'Refresh Collection' : 'Edit Spec'}
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
          {isUrlBased || isFileBased ? (
            <div>
              <label className="block text-[12px] text-text-secondary mb-2">
                {isFileBased ? 'Source File' : 'Source URL'}
              </label>
              <input
                type="text"
                value={isFileBased ? source?.path || '' : source?.url || ''}
                disabled
                className="input-field text-[13px] font-mono opacity-60"
              />
              <p className="text-[11px] text-text-muted mt-2">
                Last updated: {lastUpdated}
              </p>
              <p className="text-[12px] text-text-secondary mt-4">
                {isFileBased
                  ? 'Click refresh to re-read the current local spec file and update all requests in this collection.'
                  : 'Click refresh to fetch the latest spec from the URL and update all requests in this collection.'}
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
          {isUrlBased || isFileBased ? (
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
