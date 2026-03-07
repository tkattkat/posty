import { useState } from 'react'
import { FolderPlus, Clock, ChevronDown, Folder, Upload, Sun, Moon, Monitor } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useCollectionStore } from '../../stores/collectionStore'
import { useRequestStore } from '../../stores/requestStore'
import { ImportModal } from '../ImportModal/ImportModal'
import type { Collection, HttpRequest } from '../../types'

const methodBadgeClass: Record<string, string> = {
  GET: 'method-badge method-badge-get',
  POST: 'method-badge method-badge-post',
  PUT: 'method-badge method-badge-put',
  PATCH: 'method-badge method-badge-patch',
  DELETE: 'method-badge method-badge-delete',
  OPTIONS: 'method-badge method-badge-options',
  HEAD: 'method-badge method-badge-head',
}

function CollectionItem({ collection, depth = 0 }: { collection: Collection; depth?: number }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const { addTab } = useRequestStore()

  return (
    <div>
      <div
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover rounded cursor-pointer transition-colors group"
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-text-muted transition-transform duration-150" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          <ChevronDown className="w-3 h-3" />
        </span>
        <Folder className="w-3.5 h-3.5 text-text-tertiary" />
        <span className="text-[13px] font-medium truncate flex-1 text-text-secondary group-hover:text-text-primary">{collection.name}</span>
        <span className="text-[11px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
          {collection.requests.length}
        </span>
      </div>

      {isExpanded && (
        <div>
          {collection.requests.map((request) => (
            <div
              key={request.id}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover rounded cursor-pointer transition-colors group"
              style={{ paddingLeft: `${(depth + 1) * 12 + 12}px` }}
              onClick={() => addTab(request)}
            >
              {request.type === 'http' && (
                <span className={methodBadgeClass[request.method]}>
                  {request.method.slice(0, 3)}
                </span>
              )}
              <span className="text-[13px] text-text-tertiary truncate group-hover:text-text-secondary transition-colors">
                {request.name}
              </span>
            </div>
          ))}
          {collection.folders.map((folder) => (
            <CollectionItem key={folder.id} collection={folder} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryPanel() {
  const { history } = useCollectionStore()
  const { addTab } = useRequestStore()

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

  return (
    <div className="py-1">
      {history.slice(0, 20).map((entry) => (
        <div
          key={entry.id}
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover rounded cursor-pointer transition-colors group"
          onClick={() => addTab(entry.request)}
        >
          {entry.request.type === 'http' && (
            <span className={methodBadgeClass[(entry.request as HttpRequest).method]}>
              {(entry.request as HttpRequest).method.slice(0, 3)}
            </span>
          )}
          <span className="text-[13px] text-text-tertiary truncate flex-1 group-hover:text-text-secondary transition-colors">
            {entry.request.type === 'http' ? (() => {
              try { return new URL((entry.request as HttpRequest).url).pathname }
              catch { return (entry.request as HttpRequest).url || entry.request.name }
            })() : entry.request.name}
          </span>
          <span className="text-[10px] text-text-muted tabular-nums font-mono">
            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  )
}

export function Sidebar() {
  const { activePanel, setActivePanel, theme, setTheme } = useUIStore()
  const { collections, addCollection } = useCollectionStore()
  const [isCreating, setIsCreating] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  const handleCreateCollection = () => {
    if (newCollectionName.trim()) {
      addCollection(newCollectionName.trim())
      setNewCollectionName('')
      setIsCreating(false)
    }
  }

  return (
    <div className="flex flex-col h-full no-drag">
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
                  <CollectionItem key={collection.id} collection={collection} />
                ))}
              </div>
            )}
          </div>
        )}

        {activePanel === 'history' && <HistoryPanel />}
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
    </div>
  )
}
