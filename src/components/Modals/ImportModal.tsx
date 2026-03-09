import { useState } from 'react'
import { X, Upload, Link, FileJson, Loader2 } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useCollectionStore } from '../../stores/collectionStore'

interface ImportModalProps {
  onClose: () => void
}

interface ImportedCollection {
  name: string
  description?: string
  requests: ImportedRequest[]
  folders: ImportedCollection[]
}

interface ImportedRequest {
  id: string
  name: string
  method: string
  url: string
  headers: { id: string; key: string; value: string; enabled: boolean }[]
  params: { id: string; key: string; value: string; enabled: boolean }[]
  body?: { type: string; content: string }
}

export function ImportModal({ onClose }: ImportModalProps) {
  const [mode, setMode] = useState<'file' | 'url'>('file')
  const [url, setUrl] = useState('')
  const [fileContent, setFileContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<ImportedCollection | null>(null)

  const { addCollection, addRequestToCollection } = useCollectionStore()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setFileContent(event.target?.result as string)
      }
      reader.readAsText(file)
    }
  }

  const handleParse = async () => {
    setError('')
    setIsLoading(true)
    setPreview(null)

    try {
      let result: ImportedCollection

      if (mode === 'file' && fileContent) {
        result = await invoke<ImportedCollection>('parse_openapi_spec', {
          specContent: fileContent,
        })
      } else if (mode === 'url' && url) {
        result = await invoke<ImportedCollection>('fetch_and_parse_openapi', {
          url,
        })
      } else {
        throw new Error('Please provide a file or URL')
      }

      setPreview(result)
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleImport = () => {
    if (!preview) return

    // Create the main collection
    addCollection(preview.name)

    // Get the newly created collection
    const state = useCollectionStore.getState()
    const collection = state.collections.find((c) => c.name === preview.name)

    if (collection) {
      // Add all requests
      for (const req of preview.requests) {
        addRequestToCollection(collection.id, {
          id: req.id,
          name: req.name,
          type: 'http',
          method: req.method as any,
          url: req.url,
          headers: req.headers,
          params: req.params,
          cookies: [],
          body: req.body
            ? { type: req.body.type as any, content: req.body.content }
            : { type: 'none', content: '' },
        })
      }

      // TODO: Handle nested folders
    }

    onClose()
  }

  const countRequests = (collection: ImportedCollection): number => {
    let count = collection.requests.length
    for (const folder of collection.folders) {
      count += countRequests(folder)
    }
    return count
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg bg-bg-secondary border border-border rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold">Import OpenAPI Spec</h2>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 p-4 border-b border-border">
          <button
            onClick={() => setMode('file')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded ${
              mode === 'file'
                ? 'bg-accent text-white'
                : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload File
          </button>
          <button
            onClick={() => setMode('url')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded ${
              mode === 'url'
                ? 'bg-accent text-white'
                : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
            }`}
          >
            <Link className="w-4 h-4" />
            From URL
          </button>
        </div>

        {/* Input */}
        <div className="p-4">
          {mode === 'file' ? (
            <div>
              <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent transition-colors">
                <FileJson className="w-8 h-8 text-text-secondary mb-2" />
                <span className="text-text-secondary text-sm">
                  {fileContent ? 'File loaded' : 'Click to select OpenAPI file'}
                </span>
                <span className="text-text-secondary text-xs mt-1">
                  Supports JSON and YAML
                </span>
                <input
                  type="file"
                  accept=".json,.yaml,.yml"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div>
              <label className="block text-sm text-text-secondary mb-2">OpenAPI Spec URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/openapi.json"
                className="w-full px-4 py-2 bg-bg-tertiary border border-border rounded focus:outline-none focus:border-accent"
              />
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-error/10 border border-error/50 rounded text-error text-sm">
              {error}
            </div>
          )}

          {preview && (
            <div className="mt-4 p-4 bg-bg-tertiary rounded">
              <h3 className="font-semibold mb-2">{preview.name}</h3>
              {preview.description && (
                <p className="text-text-secondary text-sm mb-2">{preview.description}</p>
              )}
              <div className="flex gap-4 text-sm text-text-secondary">
                <span>{countRequests(preview)} requests</span>
                <span>{preview.folders.length} folders</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-bg-tertiary/50">
          {!preview ? (
            <button
              onClick={handleParse}
              disabled={isLoading || (!fileContent && !url)}
              className="px-4 py-2 bg-accent text-white rounded hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? 'Parsing...' : 'Parse Spec'}
            </button>
          ) : (
            <button
              onClick={handleImport}
              className="px-4 py-2 bg-accent text-white rounded hover:bg-accent-hover"
            >
              Import Collection
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-bg-primary text-text-secondary rounded hover:bg-bg-tertiary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
