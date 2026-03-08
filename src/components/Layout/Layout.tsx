import { useEffect } from 'react'
import { Sidebar } from '../Sidebar/Sidebar'
import { RequestPanel } from '../RequestPanel/RequestPanel'
import { CommandPalette } from '../CommandPalette/CommandPalette'
import { useUIStore } from '../../stores/uiStore'
import { useRequestStore } from '../../stores/requestStore'

export function Layout() {
  const { isCommandPaletteOpen, openCommandPalette, closeCommandPalette, isSidebarCollapsed } = useUIStore()
  const { tabs, addTab } = useRequestStore()
  const isMacOS = import.meta.env.TAURI_ENV_PLATFORM === 'darwin'

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
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        closeCommandPalette()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isCommandPaletteOpen, openCommandPalette, closeCommandPalette, addTab])

  useEffect(() => {
    if (tabs.length === 0) {
      addTab()
    }
  }, [])

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {isMacOS && (
        <div
          data-tauri-drag-region
          className="flex h-14 flex-shrink-0 overflow-hidden border-b border-border-subtle select-none"
        >
          {!isSidebarCollapsed && (
            <div data-tauri-drag-region className="drag-region sidebar flex w-56 items-center">
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
          <aside className="w-56 flex-shrink-0 sidebar">
            <Sidebar />
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0 flex flex-col bg-bg-primary">
          <RequestPanel />
        </main>
      </div>

      {/* Command Palette */}
      {isCommandPaletteOpen && <CommandPalette />}
    </div>
  )
}
