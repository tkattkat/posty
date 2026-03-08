import { useState } from 'react'
import { X, Upload, Link, FileJson, Loader2, Check, AlertCircle, FolderOpen } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useCollectionStore } from '../../stores/collectionStore'
import type { OpenApiSource } from '../../types'
import {
  convertImportedCollection,
  countImportedRequests,
  type ImportedCollection,
  type PickedOpenApiFile,
} from '../../lib/openapiImport'

interface OpenApiFileMetadata {
  modified_at: number
}

interface ImportModalProps {
  onClose: () => void
}

export function ImportModal({ onClose }: ImportModalProps) {
  const [mode, setMode] = useState<'file' | 'url' | 'paste'>('file')
  const [url, setUrl] = useState('')
  const [filePath, setFilePath] = useState('')
  const [specContent, setSpecContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const { importCollection } = useCollectionStore()

  const handleChooseFile = async () => {
    setError(null)

    try {
      const result = await invoke<PickedOpenApiFile>('pick_openapi_file')
      setFilePath(result.path)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message !== 'No file selected') {
        setError(message)
      }
    }
  }

  const handleImport = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      let result: ImportedCollection

      if (mode === 'file') {
        if (!filePath.trim()) {
          throw new Error('Please choose a local spec file')
        }
        result = await invoke<ImportedCollection>('parse_openapi_file', { filePath: filePath.trim() })
      } else if (mode === 'url') {
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
      const fileMetadata = mode === 'file'
        ? await invoke<OpenApiFileMetadata>('get_openapi_file_metadata', {
            filePath: filePath.trim(),
          })
        : null

      // Store the source info for refresh/edit later
      const source: OpenApiSource =
        mode === 'file'
          ? {
              type: 'file',
              path: filePath.trim(),
              sourceModifiedAt: fileMetadata?.modified_at,
            }
          : mode === 'url'
            ? { type: 'url', url: url.trim() }
            : { type: 'text', spec: specContent.trim() }

      importCollection(collection, source)

      const requestCount = countImportedRequests(result)
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
              onClick={() => setMode('file')}
              className={mode === 'file' ? 'active' : ''}
            >
              <FolderOpen className="w-3.5 h-3.5 mr-1.5 inline" />
              Local File
            </button>
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
          {mode === 'file' ? (
            <div>
              <label className="block text-[12px] text-text-secondary mb-2">
                Local OpenAPI/Swagger Spec
              </label>
              <button
                onClick={handleChooseFile}
                className="btn-secondary flex items-center gap-2"
                type="button"
              >
                <FolderOpen className="w-4 h-4" />
                {filePath ? 'Choose Different File' : 'Choose File'}
              </button>
              {filePath && (
                <div className="mt-3 rounded border border-border bg-bg-tertiary px-3 py-2 font-mono text-[12px] text-text-secondary break-all">
                  {filePath}
                </div>
              )}
              <p className="text-[11px] text-text-muted mt-2">
                Best for Git-managed specs in your local repository. You can refresh the collection from this file later.
              </p>
            </div>
          ) : mode === 'url' ? (
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
            disabled={
              isLoading ||
              (mode === 'file' && !filePath.trim()) ||
              (mode === 'url' && !url.trim()) ||
              (mode === 'paste' && !specContent.trim())
            }
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
