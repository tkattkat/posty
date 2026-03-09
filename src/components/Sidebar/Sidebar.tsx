import { useEffect, useRef, useState } from 'react'
import { FolderPlus, Clock, ChevronDown, Folder, GripVertical, Play, Upload, Sun, Moon, Monitor, RefreshCw, Edit2, GitCompare, Check, Trash2, AlertTriangle, X, Lock, Plus, Save, Eye, EyeOff, Globe, Copy, FileText, Pencil } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useCollectionStore } from '../../stores/collectionStore'
import { useRequestStore } from '../../stores/requestStore'
import { ImportModal } from '../ImportModal/ImportModal'
import { EditSpecModal } from '../Modals/EditSpecModal'
import { DiffModal } from '../Modals/DiffModal'
import type { Collection, HttpRequest, HistoryEntry, SecretVariable } from '../../types'
import { CollectionRunnerModal } from '../Runner/CollectionRunnerModal'
import { getRunnableCollectionLabel } from '../../lib/runner'

const methodBadgeClass: Record<string, string> = {
  GET: 'method-badge method-badge-get',
  POST: 'method-badge method-badge-post',
  PUT: 'method-badge method-badge-put',
  PATCH: 'method-badge method-badge-patch',
  DELETE: 'method-badge method-badge-delete',
  OPTIONS: 'method-badge method-badge-options',
  HEAD: 'method-badge method-badge-head',
}

function findSiblingIds(collections: Collection[], collectionId: string): string[] | null {
  const directMatch = collections.find((collection) => collection.id === collectionId)
  if (directMatch) {
    return collections.map((collection) => collection.id)
  }

  for (const collection of collections) {
    const nestedMatch = findSiblingIds(collection.folders, collectionId)
    if (nestedMatch) {
      return nestedMatch
    }
  }

  return null
}

function canReorderCollection(
  collections: Collection[],
  draggedCollectionId: string | null,
  targetCollectionId: string
) {
  if (!draggedCollectionId || draggedCollectionId === targetCollectionId) {
    return false
  }

  const siblingIds = findSiblingIds(collections, draggedCollectionId)
  return siblingIds?.includes(targetCollectionId) ?? false
}

function findCollectionById(collections: Collection[], collectionId: string): Collection | null {
  for (const collection of collections) {
    if (collection.id === collectionId) {
      return collection
    }

    const nested = findCollectionById(collection.folders, collectionId)
    if (nested) {
      return nested
    }
  }

  return null
}

function CollectionItem({
  collection,
  depth = 0,
  activeSourceRequestId,
  onOpenContextMenu,
  onOpenRequestContextMenu,
  draggedCollectionId,
  dropTargetCollectionId,
  canDropOnCollection,
  shouldSuppressToggle,
  consumeSuppressedToggle,
  onCollectionPointerDown,
  onCollectionHover,
}: {
  collection: Collection
  depth?: number
  activeSourceRequestId?: string | null
  onOpenContextMenu: (collection: Collection, x: number, y: number) => void
  onOpenRequestContextMenu: (request: HttpRequest, collectionId: string, x: number, y: number) => void
  draggedCollectionId?: string | null
  dropTargetCollectionId?: string | null
  canDropOnCollection: (targetCollectionId: string) => boolean
  shouldSuppressToggle: () => boolean
  consumeSuppressedToggle: () => void
  onCollectionPointerDown: (collectionId: string, x: number, y: number) => void
  onCollectionHover: (collectionId: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const { addTab } = useRequestStore()

  const isDropTarget = dropTargetCollectionId === collection.id && canDropOnCollection(collection.id)
  const isDragged = draggedCollectionId === collection.id

  return (
    <div>
      <div
        onMouseEnter={() => {
          if (canDropOnCollection(collection.id)) {
            onCollectionHover(collection.id)
          }
        }}
        className={`relative flex min-w-0 items-center gap-2 py-1.5 rounded cursor-pointer transition-colors group ${
          isDropTarget
            ? 'bg-accent/10 ring-1 ring-accent/35'
            : 'hover:bg-bg-hover'
        } ${isDragged ? 'bg-bg-tertiary ring-1 ring-accent/25 shadow-sm opacity-70' : ''}`}
        style={{ paddingLeft: `${depth * 12}px`, paddingRight: '8px' }}
        onClick={() => {
          if (shouldSuppressToggle()) {
            consumeSuppressedToggle()
            return
          }
          setIsExpanded(!isExpanded)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onOpenContextMenu(collection, e.clientX, e.clientY)
        }}
      >
        <span
          className="text-text-muted transition-transform duration-150"
          style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        >
          <ChevronDown className="w-3 h-3" />
        </span>
        <Folder className="w-3.5 h-3.5 text-text-tertiary" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text-secondary group-hover:text-text-primary">
          {collection.name}
        </span>
        <span className="text-[11px] text-text-muted">
          {collection.requests.length}
        </span>
      </div>

      {isExpanded && (
        <div>
          {collection.folders.map((folder) => (
            <CollectionItem
              key={folder.id}
              collection={folder}
              depth={depth + 1}
              activeSourceRequestId={activeSourceRequestId}
              onOpenContextMenu={onOpenContextMenu}
              onOpenRequestContextMenu={onOpenRequestContextMenu}
              draggedCollectionId={draggedCollectionId}
              dropTargetCollectionId={dropTargetCollectionId}
              canDropOnCollection={canDropOnCollection}
              shouldSuppressToggle={shouldSuppressToggle}
              consumeSuppressedToggle={consumeSuppressedToggle}
              onCollectionPointerDown={onCollectionPointerDown}
              onCollectionHover={onCollectionHover}
            />
          ))}
          {collection.requests.map((request) => (
            <div
              key={request.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors group ${
                activeSourceRequestId === request.id
                  ? 'bg-accent/12 ring-1 ring-accent/20'
                  : 'hover:bg-bg-hover'
              }`}
              style={{ paddingLeft: `${(depth + 1) * 12 + 20}px` }}
              onClick={() => addTab(request, { collectionId: collection.id, requestId: request.id })}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (request.type === 'http') {
                  onOpenRequestContextMenu(request, collection.id, e.clientX, e.clientY)
                }
              }}
            >
              {request.type === 'http' && (
                <span className={methodBadgeClass[request.method]}>
                  {request.method.slice(0, 3)}
                </span>
              )}
              <span
                className={`text-[13px] truncate transition-colors ${
                  activeSourceRequestId === request.id
                    ? 'text-text-primary'
                    : 'text-text-tertiary group-hover:text-text-secondary'
                }`}
              >
                {request.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CollectionContextMenu({
  collection,
  x,
  y,
  onClose,
  onRunCollection,
  onEditBaseUrl,
  onEditSpec,
  onEditSecrets,
  onRename,
  onAddFolder,
  onAddRequest,
  onDuplicate,
  onDeleteCollection,
}: {
  collection: Collection
  x: number
  y: number
  onClose: () => void
  onRunCollection: (collection: Collection) => void
  onEditBaseUrl: (collection: Collection) => void
  onEditSpec: (collection: Collection) => void
  onEditSecrets: (collection: Collection) => void
  onRename: (collection: Collection) => void
  onAddFolder: (collection: Collection) => void
  onAddRequest: (collection: Collection) => void
  onDuplicate: (collection: Collection) => void
  onDeleteCollection: (collection: Collection) => void
}) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const hasOpenApiSource = !!collection.openApiSource

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 min-w-48 overflow-hidden rounded-lg border border-border bg-bg-secondary shadow-2xl"
        style={{ left: x, top: y }}
      >
        <button
          onClick={() => {
            onAddRequest(collection)
            onClose()
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <FileText className="h-3.5 w-3.5" />
          Add request
        </button>
        <button
          onClick={() => {
            onAddFolder(collection)
            onClose()
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          Add folder
        </button>
        <div className="border-t border-border" />
        <button
          onClick={() => {
            onRunCollection(collection)
            onClose()
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <Play className="h-3.5 w-3.5" />
          {getRunnableCollectionLabel(collection)}
        </button>
        <div className="border-t border-border" />
        <button
          onClick={() => {
            onRename(collection)
            onClose()
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <Pencil className="h-3.5 w-3.5" />
          Rename
        </button>
        <button
          onClick={() => {
            onDuplicate(collection)
            onClose()
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <Copy className="h-3.5 w-3.5" />
          Duplicate
        </button>
        <div className="border-t border-border" />
        <button
          onClick={() => {
            onEditBaseUrl(collection)
            onClose()
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <Globe className="h-3.5 w-3.5" />
          Base URL
        </button>
        <button
          onClick={() => {
            onEditSecrets(collection)
            onClose()
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <Lock className="h-3.5 w-3.5" />
          Secrets
        </button>
        {hasOpenApiSource && (
          <button
            onClick={() => {
              onEditSpec(collection)
              onClose()
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            {collection.openApiSource?.type === 'url' || collection.openApiSource?.type === 'file' ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <Edit2 className="h-3.5 w-3.5" />
            )}
            {collection.openApiSource?.type === 'url'
              ? 'Refresh from URL'
              : collection.openApiSource?.type === 'file'
                ? 'Refresh from file'
                : 'Edit spec'}
          </button>
        )}
        <div className="border-t border-border" />
        <button
          onClick={() => {
            onDeleteCollection(collection)
            onClose()
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-error transition-colors hover:bg-error-muted"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    </>
  )
}

function RequestContextMenu({
  request,
  collectionId,
  x,
  y,
  onClose,
  onRename,
  onDuplicate,
  onDelete,
}: {
  request: HttpRequest
  collectionId: string
  x: number
  y: number
  onClose: () => void
  onRename: (request: HttpRequest) => void
  onDuplicate: (request: HttpRequest, collectionId: string) => void
  onDelete: (request: HttpRequest, collectionId: string) => void
}) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 min-w-40 overflow-hidden rounded-lg border border-border bg-bg-secondary shadow-2xl"
        style={{ left: x, top: y }}
      >
        <button
          onClick={() => {
            onRename(request)
            onClose()
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <Pencil className="h-3.5 w-3.5" />
          Rename
        </button>
        <button
          onClick={() => {
            onDuplicate(request, collectionId)
            onClose()
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <Copy className="h-3.5 w-3.5" />
          Duplicate
        </button>
        <div className="border-t border-border" />
        <button
          onClick={() => {
            onDelete(request, collectionId)
            onClose()
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-error transition-colors hover:bg-error-muted"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    </>
  )
}

function HistoryPanel({
  onCompare,
  activeSourceRequestId,
}: {
  onCompare: (left: HistoryEntry, right: HistoryEntry) => void
  activeSourceRequestId?: string | null
}) {
  const { history } = useCollectionStore()
  const { addTab } = useRequestStore()
  const [compareMode, setCompareMode] = useState(false)
  const [selected, setSelected] = useState<HistoryEntry[]>([])

  if (history.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Clock className="w-5 h-5" />
        </div>
        <p className="empty-state-title">No history yet</p>
        <p className="empty-state-desc">Your requests will appear here</p>
      </div>
    )
  }

  const handleClick = (entry: HistoryEntry) => {
    if (compareMode) {
      if (selected.some(s => s.id === entry.id)) {
        setSelected(selected.filter(s => s.id !== entry.id))
      } else if (selected.length < 2) {
        const newSelected = [...selected, entry]
        setSelected(newSelected)
        if (newSelected.length === 2) {
          onCompare(newSelected[0], newSelected[1])
          setCompareMode(false)
          setSelected([])
        }
      }
    } else {
      addTab(entry.request, {
        collectionId: entry.sourceCollectionId,
        requestId: entry.sourceRequestId ?? entry.request.id,
      })
    }
  }

  const toggleCompareMode = () => {
    setCompareMode(!compareMode)
    setSelected([])
  }

  return (
    <div className="flex flex-col h-full">
      {/* Compare button */}
      <div className="px-2 pb-2">
        <button
          onClick={toggleCompareMode}
          className={`w-full flex items-center justify-center gap-1.5 text-[12px] py-1.5 rounded transition-colors ${
            compareMode
              ? 'bg-accent text-white'
              : 'btn-ghost'
          }`}
        >
          <GitCompare className="w-3.5 h-3.5" />
          {compareMode ? `Select 2 to compare (${selected.length}/2)` : 'Compare'}
        </button>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-auto py-1">
        {history.slice(0, 30).map((entry) => {
          const isSelected = selected.some(s => s.id === entry.id)
          const isActiveEntry = activeSourceRequestId === entry.request.id
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors group ${
                isSelected
                  ? 'bg-accent/20'
                  : isActiveEntry
                    ? 'bg-accent/12 ring-1 ring-accent/20'
                    : 'hover:bg-bg-hover'
              }`}
              onClick={() => handleClick(entry)}
            >
              {compareMode && (
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-accent border-accent' : 'border-border'
                }`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
              )}
              {entry.request.type === 'http' && (
                <span className={methodBadgeClass[(entry.request as HttpRequest).method]}>
                  {(entry.request as HttpRequest).method.slice(0, 3)}
                </span>
              )}
              <span
                className={`text-[13px] truncate flex-1 transition-colors ${
                  isActiveEntry
                    ? 'text-text-primary'
                    : 'text-text-tertiary group-hover:text-text-secondary'
                }`}
              >
                {entry.request.type === 'http' ? (() => {
                  try { return new URL((entry.request as HttpRequest).url).pathname }
                  catch { return (entry.request as HttpRequest).url || entry.request.name }
                })() : entry.request.name}
              </span>
              <span className="text-[10px] text-text-muted tabular-nums font-mono">
                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DeleteCollectionModal({
  collection,
  onClose,
  onConfirm,
}: {
  collection: Collection
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass-elevated rounded-lg flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-error" />
            <span className="text-[14px] font-medium">Delete Collection</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors text-text-muted hover:text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4">
          <p className="text-[13px] text-text-primary">
            Delete "{collection.name}" and all nested requests/folders?
          </p>
          <p className="mt-2 text-[12px] text-text-secondary">
            This cannot be undone.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-error text-white hover:opacity-90 transition-opacity"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function CollectionSecretsModal({
  collection,
  onClose,
  onSave,
}: {
  collection: Collection
  onClose: () => void
  onSave: (secrets: SecretVariable[]) => void
}) {
  const [draftSecrets, setDraftSecrets] = useState<SecretVariable[]>(
    collection.secrets?.length
      ? collection.secrets
      : [{ id: crypto.randomUUID(), name: '', value: '' }]
  )
  const [error, setError] = useState('')
  const [showSecretValues, setShowSecretValues] = useState(false)

  const updateSecret = (id: string, field: 'name' | 'value', value: string) => {
    setDraftSecrets((current) => current.map((secret) => (secret.id === id ? { ...secret, [field]: value } : secret)))
  }

  const addSecret = () => {
    setDraftSecrets((current) => [...current, { id: crypto.randomUUID(), name: '', value: '' }])
  }

  const removeSecret = (id: string) => {
    setDraftSecrets((current) => current.filter((secret) => secret.id !== id))
  }

  const handleSave = () => {
    const cleanedSecrets = draftSecrets
      .map((secret) => ({ ...secret, name: secret.name.trim() }))
      .filter((secret) => secret.name && secret.value)

    const secretNames = cleanedSecrets.map((secret) => secret.name)
    const hasDuplicateNames = new Set(secretNames).size !== secretNames.length

    if (hasDuplicateNames) {
      setError('Secret names must be unique')
      return
    }

    setError('')
    onSave(cleanedSecrets)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl glass-elevated rounded-lg flex flex-col animate-scale-in max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-accent" />
            <span className="text-[14px] font-medium">Collection Secrets</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors text-text-muted hover:text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-auto">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[12px] text-text-secondary">
              Secrets are scoped to "{collection.name}". Use `/` in header value fields to insert them as hidden tokens.
            </p>
            <button
              type="button"
              onClick={() => setShowSecretValues((current) => !current)}
              className="btn-ghost flex items-center gap-1.5 text-[12px] whitespace-nowrap"
            >
              {showSecretValues ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showSecretValues ? 'Hide values' : 'Show values'}
            </button>
          </div>

          <div className="space-y-3">
            {draftSecrets.map((secret) => (
              <div key={secret.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={secret.name}
                  onChange={(e) => updateSecret(secret.id, 'name', e.target.value)}
                  placeholder="SECRET_NAME"
                  className="min-w-0 flex-1 input-field font-mono text-sm"
                />
                <input
                  type={showSecretValues ? 'text' : 'password'}
                  value={secret.value}
                  onChange={(e) => updateSecret(secret.id, 'value', e.target.value)}
                  placeholder="Secret value"
                  className="min-w-0 flex-1 input-field text-sm"
                />
                <button
                  onClick={() => removeSecret(secret.id)}
                  className="p-2 text-text-tertiary hover:text-error hover:bg-error/10 rounded-md transition-all"
                  title="Remove secret"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4 rounded bg-error-muted px-3 py-2 text-[12px] text-error">
              {error}
            </div>
          )}

          <button
            onClick={addSecret}
            className="mt-4 flex items-center gap-1.5 text-xs text-text-secondary hover:text-accent transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add secret
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            Save Secrets
          </button>
        </div>
      </div>
    </div>
  )
}

function RenameModal({
  title,
  currentName,
  onClose,
  onSave,
}: {
  title: string
  currentName: string
  onClose: () => void
  onSave: (newName: string) => void
}) {
  const [name, setName] = useState(currentName)

  const handleSave = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== currentName) {
      onSave(trimmed)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass-elevated rounded-lg flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-accent" />
            <span className="text-[14px] font-medium">{title}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors text-text-muted hover:text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') onClose()
            }}
            placeholder="Enter name"
            className="input-field text-[13px]"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || name.trim() === currentName}
            className="btn-primary"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function AddFolderModal({
  parentCollection,
  onClose,
  onSave,
}: {
  parentCollection: Collection
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState('')

  const handleSave = () => {
    const trimmed = name.trim()
    if (trimmed) {
      onSave(trimmed)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass-elevated rounded-lg flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-accent" />
            <span className="text-[14px] font-medium">Add Folder</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors text-text-muted hover:text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <p className="mb-3 text-[12px] text-text-secondary">
            Create a new folder inside "{parentCollection.name}"
          </p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') onClose()
            }}
            placeholder="Folder name"
            className="input-field text-[13px]"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="btn-primary"
          >
            Create Folder
          </button>
        </div>
      </div>
    </div>
  )
}

function CollectionBaseUrlModal({
  collection,
  onClose,
  onSave,
}: {
  collection: Collection
  onClose: () => void
  onSave: (baseUrl: string | undefined) => void
}) {
  const [draftBaseUrl, setDraftBaseUrl] = useState(collection.baseUrl ?? '')

  const handleSave = () => {
    const trimmedBaseUrl = draftBaseUrl.trim()
    onSave(trimmedBaseUrl || undefined)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl glass-elevated rounded-lg flex flex-col animate-scale-in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-accent" />
            <span className="text-[14px] font-medium">Collection Base URL</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-bg-hover rounded transition-colors text-text-muted hover:text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <p className="mb-3 text-[12px] text-text-secondary">
            Relative request URLs in "{collection.name}" will resolve against this base URL. Absolute request URLs still take precedence.
          </p>
          <input
            type="text"
            value={draftBaseUrl}
            onChange={(event) => setDraftBaseUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleSave()
              }
            }}
            placeholder="https://api.example.com/v1"
            className="input-field text-[13px] font-mono"
            autoFocus
          />
          <p className="mt-2 text-[11px] text-text-muted">
            Leave blank to disable collection-level base URL resolution.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            Save Base URL
          </button>
        </div>
      </div>
    </div>
  )
}

export function Sidebar() {
  const { activePanel, setActivePanel, theme, setTheme } = useUIStore()
  const { collections, addCollection, deleteCollection, moveCollection, updateCollection, addRequestToCollection, duplicateCollection, removeRequestFromCollection, duplicateRequest, updateRequestInCollection } = useCollectionStore()
  const { tabs, activeTabId, addTab } = useRequestStore()
  const [isCreating, setIsCreating] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null)
  const [editingBaseUrlCollection, setEditingBaseUrlCollection] = useState<Collection | null>(null)
  const [editingSecretsCollection, setEditingSecretsCollection] = useState<Collection | null>(null)
  const [renamingCollection, setRenamingCollection] = useState<Collection | null>(null)
  const [renamingRequest, setRenamingRequest] = useState<{ request: HttpRequest; collectionId: string } | null>(null)
  const [addingFolderToCollection, setAddingFolderToCollection] = useState<Collection | null>(null)
  const [diffEntries, setDiffEntries] = useState<{ left: HistoryEntry; right: HistoryEntry } | null>(null)
  const [pendingDeleteCollection, setPendingDeleteCollection] = useState<Collection | null>(null)
  const [pendingDragCollection, setPendingDragCollection] = useState<{ id: string; x: number; y: number } | null>(null)
  const [draggedCollectionId, setDraggedCollectionId] = useState<string | null>(null)
  const [dropTargetCollectionId, setDropTargetCollectionId] = useState<string | null>(null)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ collection: Collection; x: number; y: number } | null>(null)
  const [requestContextMenu, setRequestContextMenu] = useState<{ request: HttpRequest; collectionId: string; x: number; y: number } | null>(null)
  const [runnerCollection, setRunnerCollection] = useState<Collection | null>(null)
  const suppressNextCollectionToggleRef = useRef(false)

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  const activeSourceRequestId = tabs.find((tab) => tab.id === activeTabId)?.sourceRequestId ?? null

  const handleCreateCollection = () => {
    if (newCollectionName.trim()) {
      addCollection(newCollectionName.trim())
      setNewCollectionName('')
      setIsCreating(false)
    }
  }

  const handleDeleteCollection = (collection: Collection) => {
    setPendingDeleteCollection(collection)
  }

  const confirmDeleteCollection = () => {
    if (!pendingDeleteCollection) return

    if (editingCollection?.id === pendingDeleteCollection.id) {
      setEditingCollection(null)
    }

    deleteCollection(pendingDeleteCollection.id)
    setPendingDeleteCollection(null)
  }

  const handleSaveSecrets = (collectionId: string, secrets: SecretVariable[]) => {
    updateCollection(collectionId, { secrets })
    setEditingSecretsCollection(null)
  }

  const handleSaveBaseUrl = (collectionId: string, baseUrl: string | undefined) => {
    updateCollection(collectionId, { baseUrl })
    setEditingBaseUrlCollection(null)
  }

  const handleRename = (collectionId: string, newName: string) => {
    updateCollection(collectionId, { name: newName })
  }

  const handleAddFolder = (parentId: string, folderName: string) => {
    addCollection(folderName, parentId)
  }

  const handleAddRequest = (collection: Collection) => {
    const newRequest: HttpRequest = {
      id: crypto.randomUUID(),
      name: 'New Request',
      type: 'http',
      method: 'GET',
      url: '',
      headers: [],
      params: [],
      cookies: [],
      body: { type: 'none', content: '' },
    }
    addRequestToCollection(collection.id, newRequest)
    // Open the new request in a tab
    addTab(newRequest, { collectionId: collection.id, requestId: newRequest.id })
  }

  const handleDuplicate = (collection: Collection) => {
    duplicateCollection(collection.id)
  }

  const handleRenameRequest = (requestId: string, newName: string) => {
    updateRequestInCollection(requestId, { name: newName })
  }

  const handleDuplicateRequest = (request: HttpRequest, collectionId: string) => {
    duplicateRequest(collectionId, request.id)
  }

  const handleDeleteRequest = (request: HttpRequest, collectionId: string) => {
    removeRequestFromCollection(collectionId, request.id)
  }

  const openRequestContextMenu = (request: HttpRequest, collectionId: string, x: number, y: number) => {
    setRequestContextMenu({ request, collectionId, x, y })
  }

  const handleCollectionDragEnd = () => {
    setPendingDragCollection(null)
    setDraggedCollectionId(null)
    setDropTargetCollectionId(null)
    setDragPosition(null)
  }

  const openCollectionContextMenu = (collection: Collection, x: number, y: number) => {
    setContextMenu({ collection, x, y })
  }

  const handleCollectionDrop = (targetCollectionId: string) => {
    if (!canReorderCollection(collections, draggedCollectionId, targetCollectionId) || !draggedCollectionId) {
      handleCollectionDragEnd()
      return
    }

    moveCollection(draggedCollectionId, targetCollectionId)
    handleCollectionDragEnd()
  }

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!pendingDragCollection) return

      const movedEnough =
        Math.abs(event.clientX - pendingDragCollection.x) > 4 ||
        Math.abs(event.clientY - pendingDragCollection.y) > 4

      if (!movedEnough) return

      if (!draggedCollectionId) {
        suppressNextCollectionToggleRef.current = true
        setDraggedCollectionId(pendingDragCollection.id)
        setDropTargetCollectionId(pendingDragCollection.id)
        setDragPosition({ x: event.clientX, y: event.clientY })
        return
      }

      setDragPosition({ x: event.clientX, y: event.clientY })
    }

    const handleMouseUp = () => {
      if (draggedCollectionId && dropTargetCollectionId) {
        handleCollectionDrop(dropTargetCollectionId)
        return
      }

      handleCollectionDragEnd()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [pendingDragCollection, draggedCollectionId, dropTargetCollectionId, collections])

  const draggedCollection = draggedCollectionId
    ? findCollectionById(collections, draggedCollectionId)
    : null

  return (
    <div
      className="flex flex-col h-full no-drag"
      onClick={() => {
        if (contextMenu) {
          setContextMenu(null)
        }
        if (requestContextMenu) {
          setRequestContextMenu(null)
        }
      }}
    >
      {/* Segmented Control */}
      <div className="p-3 pb-2">
        <div className="segmented-control">
          <button
            onClick={() => setActivePanel('collections')}
            className={activePanel === 'collections' ? 'active' : ''}
          >
            Collections
          </button>
          <button
            onClick={() => setActivePanel('history')}
            className={activePanel === 'history' ? 'active' : ''}
          >
            History
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-2">
        {activePanel === 'collections' && (
          <div>
            {/* Actions */}
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => setIsCreating(true)}
                className="btn-ghost flex-1 flex items-center justify-center gap-1.5 text-[12px]"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                New
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="btn-ghost flex-1 flex items-center justify-center gap-1.5 text-[12px]"
              >
                <Upload className="w-3.5 h-3.5" />
                Import
              </button>
            </div>

            {isCreating && (
              <div className="mb-3 p-3 bg-bg-secondary rounded border border-border animate-fade-in">
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateCollection()
                    if (e.key === 'Escape') setIsCreating(false)
                  }}
                  placeholder="Collection name"
                  className="input-field text-[13px] mb-2"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={handleCreateCollection} className="btn-primary flex-1 text-[12px] py-1.5">
                    Create
                  </button>
                  <button
                    onClick={() => setIsCreating(false)}
                    className="btn-secondary flex-1 text-[12px] py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Collections List */}
            {collections.length === 0 && !isCreating ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Folder className="w-5 h-5" />
                </div>
                <p className="empty-state-title">No collections</p>
                <p className="empty-state-desc">Create a collection to organize requests</p>
              </div>
            ) : (
              <div>
                {collections.map((collection) => (
                  <CollectionItem
                    key={collection.id}
                    collection={collection}
                    activeSourceRequestId={activeSourceRequestId}
                    onOpenContextMenu={openCollectionContextMenu}
                    onOpenRequestContextMenu={openRequestContextMenu}
                    draggedCollectionId={draggedCollectionId}
                    dropTargetCollectionId={dropTargetCollectionId}
                    canDropOnCollection={(targetCollectionId) =>
                      canReorderCollection(collections, draggedCollectionId, targetCollectionId)
                    }
                    shouldSuppressToggle={() => suppressNextCollectionToggleRef.current}
                    consumeSuppressedToggle={() => {
                      suppressNextCollectionToggleRef.current = false
                    }}
                    onCollectionPointerDown={(collectionId, x, y) => {
                      setContextMenu(null)
                      setPendingDragCollection({ id: collectionId, x, y })
                    }}
                    onCollectionHover={setDropTargetCollectionId}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activePanel === 'history' && (
          <HistoryPanel
            onCompare={(left, right) => setDiffEntries({ left, right })}
            activeSourceRequestId={activeSourceRequestId}
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            <span className="kbd">⌘K</span>
            <span className="kbd">⌘T</span>
          </div>
          <button
            onClick={cycleTheme}
            className="btn-ghost p-1.5"
            title={`Theme: ${theme}`}
          >
            <ThemeIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} />}

      {/* Edit Spec Modal */}
      {editingCollection && (
        <EditSpecModal
          collection={editingCollection}
          onClose={() => setEditingCollection(null)}
        />
      )}

      {editingBaseUrlCollection && (
        <CollectionBaseUrlModal
          collection={editingBaseUrlCollection}
          onClose={() => setEditingBaseUrlCollection(null)}
          onSave={(baseUrl) => handleSaveBaseUrl(editingBaseUrlCollection.id, baseUrl)}
        />
      )}

      {editingSecretsCollection && (
        <CollectionSecretsModal
          collection={editingSecretsCollection}
          onClose={() => setEditingSecretsCollection(null)}
          onSave={(secrets) => handleSaveSecrets(editingSecretsCollection.id, secrets)}
        />
      )}

      {pendingDeleteCollection && (
        <DeleteCollectionModal
          collection={pendingDeleteCollection}
          onClose={() => setPendingDeleteCollection(null)}
          onConfirm={confirmDeleteCollection}
        />
      )}

      {renamingCollection && (
        <RenameModal
          title="Rename"
          currentName={renamingCollection.name}
          onClose={() => setRenamingCollection(null)}
          onSave={(newName) => handleRename(renamingCollection.id, newName)}
        />
      )}

      {addingFolderToCollection && (
        <AddFolderModal
          parentCollection={addingFolderToCollection}
          onClose={() => setAddingFolderToCollection(null)}
          onSave={(name) => handleAddFolder(addingFolderToCollection.id, name)}
        />
      )}

      {contextMenu && (
        <CollectionContextMenu
          collection={contextMenu.collection}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onRunCollection={setRunnerCollection}
          onEditBaseUrl={setEditingBaseUrlCollection}
          onEditSpec={setEditingCollection}
          onEditSecrets={setEditingSecretsCollection}
          onRename={setRenamingCollection}
          onAddFolder={setAddingFolderToCollection}
          onAddRequest={handleAddRequest}
          onDuplicate={handleDuplicate}
          onDeleteCollection={handleDeleteCollection}
        />
      )}

      {requestContextMenu && (
        <RequestContextMenu
          request={requestContextMenu.request}
          collectionId={requestContextMenu.collectionId}
          x={requestContextMenu.x}
          y={requestContextMenu.y}
          onClose={() => setRequestContextMenu(null)}
          onRename={(request) => setRenamingRequest({ request, collectionId: requestContextMenu.collectionId })}
          onDuplicate={handleDuplicateRequest}
          onDelete={handleDeleteRequest}
        />
      )}

      {renamingRequest && (
        <RenameModal
          title="Rename Request"
          currentName={renamingRequest.request.name}
          onClose={() => setRenamingRequest(null)}
          onSave={(newName) => handleRenameRequest(renamingRequest.request.id, newName)}
        />
      )}

      {runnerCollection && (
        <CollectionRunnerModal
          collection={runnerCollection}
          onClose={() => setRunnerCollection(null)}
        />
      )}

      {draggedCollection && dragPosition && (
        <div
          className="pointer-events-none fixed z-50 flex items-center gap-2 rounded-md border border-accent/30 bg-bg-tertiary px-3 py-2 text-[12px] text-text-primary shadow-2xl"
          style={{
            left: dragPosition.x + 14,
            top: dragPosition.y + 14,
          }}
        >
          <GripVertical className="h-3.5 w-3.5 text-text-muted" />
          <Folder className="h-3.5 w-3.5 text-text-tertiary" />
          <span className="max-w-56 truncate font-medium">{draggedCollection.name}</span>
        </div>
      )}

      {/* Diff Modal */}
      {diffEntries && (
        <DiffModal
          left={diffEntries.left}
          right={diffEntries.right}
          onClose={() => setDiffEntries(null)}
        />
      )}
    </div>
  )
}
