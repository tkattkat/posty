import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, FileJson, Folder, Command, Zap } from 'lucide-react'
import Fuse from 'fuse.js'
import { useUIStore } from '../../stores/uiStore'
import { useCollectionStore } from '../../stores/collectionStore'
import { useRequestStore } from '../../stores/requestStore'
import type { CommandPaletteItem, HttpMethod } from '../../types'

const methodBadgeClass: Record<HttpMethod, string> = {
  GET: 'method-badge method-badge-get',
  POST: 'method-badge method-badge-post',
  PUT: 'method-badge method-badge-put',
  PATCH: 'method-badge method-badge-patch',
  DELETE: 'method-badge method-badge-delete',
  OPTIONS: 'method-badge method-badge-options',
  HEAD: 'method-badge method-badge-head',
}

export function CommandPalette() {
  const { closeCommandPalette } = useUIStore()
  const { collections, history, getAllRequests } = useCollectionStore()
  const { addTab } = useRequestStore()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo<CommandPaletteItem[]>(() => {
    const result: CommandPaletteItem[] = []

    const allRequests = getAllRequests()
    allRequests.forEach((request) => {
      result.push({
        id: request.id,
        type: 'request',
        title: request.name,
        subtitle: 'url' in request ? request.url : undefined,
        method: request.type === 'http' ? request.method : undefined,
        action: () => {
          addTab(request)
          closeCommandPalette()
        },
      })
    })

    const addCollections = (cols: typeof collections) => {
      cols.forEach((col) => {
        result.push({
          id: col.id,
          type: 'collection',
          title: col.name,
          subtitle: `${col.requests.length} requests`,
        })
        addCollections(col.folders)
      })
    }
    addCollections(collections)

    history.slice(0, 15).forEach((entry) => {
      result.push({
        id: `history-${entry.id}`,
        type: 'request',
        title: entry.request.name,
        subtitle: 'url' in entry.request ? entry.request.url : undefined,
        method: entry.request.type === 'http' ? entry.request.method : undefined,
        action: () => {
          addTab(entry.request)
          closeCommandPalette()
        },
      })
    })

    return result
  }, [collections, history, getAllRequests, addTab, closeCommandPalette])

  const fuse = useMemo(
    () => new Fuse(items, { keys: ['title', 'subtitle'], threshold: 0.3 }),
    [items]
  )

  const filteredItems = useMemo(() => {
    if (!query) return items.slice(0, 8)
    return fuse.search(query).map((result) => result.item).slice(0, 8)
  }, [query, items, fuse])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filteredItems.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        filteredItems[selectedIndex]?.action?.()
        break
      case 'Escape':
        e.preventDefault()
        closeCommandPalette()
        break
    }
  }

  useEffect(() => {
    const selectedEl = listRef.current?.children[selectedIndex] as HTMLElement
    selectedEl?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={closeCommandPalette}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg glass shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
          <Search className="w-5 h-5 text-text-tertiary" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search requests, collections..."
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none text-sm"
          />
          <kbd className="px-2 py-1 bg-black/20 text-text-tertiary text-[10px] rounded font-medium">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-72 overflow-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-10 h-10 rounded-xl bg-glass-bg flex items-center justify-center mx-auto mb-3">
                <Zap className="w-4 h-4 text-text-tertiary" />
              </div>
              <p className="text-sm text-text-secondary">No results found</p>
              <p className="text-xs text-text-tertiary mt-1">Try a different search term</p>
            </div>
          ) : (
            filteredItems.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                  index === selectedIndex
                    ? 'bg-accent/15 text-text-primary'
                    : 'text-text-secondary hover:bg-glass-bg'
                }`}
                onClick={() => item.action?.()}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {item.type === 'request' && item.method ? (
                  <span className={methodBadgeClass[item.method]}>
                    {item.method.slice(0, 3)}
                  </span>
                ) : item.type === 'collection' ? (
                  <Folder className="w-4 h-4 text-accent" />
                ) : item.type === 'action' ? (
                  <Command className="w-4 h-4" />
                ) : (
                  <FileJson className="w-4 h-4 text-text-tertiary" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{item.title}</div>
                  {item.subtitle && (
                    <div className="text-xs text-text-tertiary truncate">{item.subtitle}</div>
                  )}
                </div>

                {index === selectedIndex && (
                  <kbd className="px-1.5 py-0.5 bg-black/20 text-text-tertiary text-[10px] rounded">↵</kbd>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border text-[10px] text-text-tertiary">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 bg-black/20 rounded">↑</kbd>
              <kbd className="px-1 bg-black/20 rounded">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 bg-black/20 rounded">↵</kbd>
              select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1 bg-black/20 rounded">⌘</kbd>
            <kbd className="px-1 bg-black/20 rounded">K</kbd>
            toggle
          </span>
        </div>
      </div>
    </div>
  )
}
