import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface UIStore {
  sidebarWidth: number
  isCommandPaletteOpen: boolean
  isSidebarCollapsed: boolean
  activePanel: 'collections' | 'history' | 'environments'
  theme: Theme

  // Actions
  setSidebarWidth: (width: number) => void
  toggleCommandPalette: () => void
  openCommandPalette: () => void
  closeCommandPalette: () => void
  toggleSidebar: () => void
  setActivePanel: (panel: 'collections' | 'history' | 'environments') => void
  setTheme: (theme: Theme) => void
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')

  if (theme === 'system') {
    // Let CSS media query handle it
    return
  }

  root.classList.add(theme)
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarWidth: 280,
      isCommandPaletteOpen: false,
      isSidebarCollapsed: false,
      activePanel: 'collections',
      theme: 'system',

      setSidebarWidth: (width) => {
        set({ sidebarWidth: Math.max(200, Math.min(500, width)) })
      },

      toggleCommandPalette: () => {
        set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen }))
      },

      openCommandPalette: () => {
        set({ isCommandPaletteOpen: true })
      },

      closeCommandPalette: () => {
        set({ isCommandPaletteOpen: false })
      },

      toggleSidebar: () => {
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed }))
      },

      setActivePanel: (panel) => {
        set({ activePanel: panel })
      },

      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
    }),
    {
      name: 'posty-ui',
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          applyTheme(state.theme)
        }
      },
    }
  )
)
