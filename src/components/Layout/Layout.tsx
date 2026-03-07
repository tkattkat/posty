import { useEffect } from 'react'
import { Sidebar } from '../Sidebar/Sidebar'
import { RequestPanel } from '../RequestPanel/RequestPanel'
import { CommandPalette } from '../CommandPalette/CommandPalette'
import { useUIStore } from '../../stores/uiStore'
import { useRequestStore } from '../../stores/requestStore'

export function Layout() {
  const { isCommandPaletteOpen, openCommandPalette, closeCommandPalette, isSidebarCollapsed } = useUIStore()
  const { tabs, addTab } = useRequestStore()

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
    <div className="flex h-full w-full overflow-hidden">
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

      {/* Command Palette */}
      {isCommandPaletteOpen && <CommandPalette />}
    </div>
  )
}
