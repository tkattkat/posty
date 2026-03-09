import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Sidebar } from '../Sidebar/Sidebar'
import { RequestPanel } from '../RequestPanel/RequestPanel'
import { CommandPalette } from '../CommandPalette/CommandPalette'
import { UpdateChecker } from '../UpdateChecker/UpdateChecker'
import { useUIStore } from '../../stores/uiStore'
import { useRequestStore } from '../../stores/requestStore'
import { useCollectionStore } from '../../stores/collectionStore'
import { convertImportedCollectionContents, type ImportedCollection } from '../../lib/openapiImport'
import type { Collection } from '../../types'

interface OpenApiFileMetadata {
  modified_at: number
}

function flattenCollections(collections: Collection[]): Collection[] {
  return collections.flatMap((collection) => [collection, ...flattenCollections(collection.folders)])
}

export function Layout() {
  const { isCommandPaletteOpen, openCommandPalette, closeCommandPalette, isSidebarCollapsed, toggleSidebar } = useUIStore()
  const { tabs, addTab, removeTab, activeTabId, duplicateActiveTab } = useRequestStore()
  const isMacOS = import.meta.env.TAURI_ENV_PLATFORM === 'darwin'
  const layoutRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        isCommandPaletteOpen ? closeCommandPalette() : openCommandPalette()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault()
        addTab()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        toggleSidebar()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        e.preventDefault()
        if (activeTabId) {
          removeTab(activeTabId)
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault()
        duplicateActiveTab()
      }
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        closeCommandPalette()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isCommandPaletteOpen, openCommandPalette, closeCommandPalette, addTab, toggleSidebar, activeTabId, removeTab, duplicateActiveTab])

  useEffect(() => {
    if (tabs.length === 0) {
      addTab()
    }
  }, [])

  useEffect(() => {
    let isPolling = false

    const pollFileBackedSpecs = async () => {
      if (isPolling) return
      isPolling = true

      try {
        const { collections, refreshCollectionFromSource, updateCollection } = useCollectionStore.getState()
        const fileBackedCollections = flattenCollections(collections).filter(
          (collection) => collection.openApiSource?.type === 'file' && collection.openApiSource.path
        )

        for (const collection of fileBackedCollections) {
          const source = collection.openApiSource
          if (!source?.path) continue

          try {
            const metadata = await invoke<OpenApiFileMetadata>('get_openapi_file_metadata', {
              filePath: source.path,
            })

            if (!source.sourceModifiedAt) {
              updateCollection(collection.id, {
                openApiSource: {
                  ...source,
                  sourceModifiedAt: metadata.modified_at,
                },
              })

              if (source.lastUpdated && metadata.modified_at <= source.lastUpdated) {
                continue
              }
            }

            if (source.sourceModifiedAt && metadata.modified_at <= source.sourceModifiedAt) {
              continue
            }

            const result = await invoke<ImportedCollection>('parse_openapi_file', {
              filePath: source.path,
            })
            const { requests, folders } = convertImportedCollectionContents(result)

            refreshCollectionFromSource(collection.id, requests, folders, {
              sourceModifiedAt: metadata.modified_at,
            })
          } catch (error) {
            console.error('Failed to auto-refresh OpenAPI file source', error)
          }
        }
      } finally {
        isPolling = false
      }
    }

    void pollFileBackedSpecs()
    const intervalId = window.setInterval(() => {
      void pollFileBackedSpecs()
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!layoutRef.current) return
    layoutRef.current.style.setProperty('--sidebar-width', '224px')
  }, [])

  const handleSidebarResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!layoutRef.current) return

    event.preventDefault()

    const container = layoutRef.current
    const rect = container.getBoundingClientRect()
    const minWidth = 180
    const maxWidth = Math.min(420, rect.width - 480)

    document.body.classList.add('is-resizing')

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(Math.max(moveEvent.clientX - rect.left, minWidth), maxWidth)
      container.style.setProperty('--sidebar-width', `${nextWidth}px`)
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
    <div ref={layoutRef} className="layout-shell flex h-full w-full flex-col overflow-hidden">
      {isMacOS && (
        <div
          data-tauri-drag-region
          className="flex h-9 flex-shrink-0 overflow-hidden border-b border-border-subtle select-none"
        >
          {!isSidebarCollapsed && (
            <div data-tauri-drag-region className="drag-region sidebar layout-sidebar-panel flex items-center">
              <div className="w-20" />
            </div>
          )}
          <div
            data-tauri-drag-region
            className="drag-region app-titlebar-main flex min-w-0 flex-1 px-4"
          />
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar */}
        {!isSidebarCollapsed && (
          <>
            <aside className="layout-sidebar-panel flex-shrink-0 sidebar">
              <Sidebar />
            </aside>
            <div
              className="split-handle split-handle-vertical no-drag"
              onPointerDown={handleSidebarResizeStart}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
            />
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0 flex flex-col bg-bg-primary">
          <RequestPanel />
        </main>
      </div>

      {/* Command Palette */}
      {isCommandPaletteOpen && <CommandPalette />}

      {/* Update Checker */}
      <UpdateChecker />
    </div>
  )
}
