import { create } from 'zustand'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

interface UpdateInfo {
  version: string
  body?: string
}

interface UpdateStore {
  updateAvailable: UpdateInfo | null
  isChecking: boolean
  isDownloading: boolean
  downloadProgress: number
  dismissed: boolean
  update: Update | null
  showUpToDate: boolean

  checkForUpdates: (fromMenu?: boolean) => Promise<void>
  downloadAndInstall: () => Promise<void>
  dismiss: () => void
  dismissUpToDate: () => void
  reset: () => void
}

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  updateAvailable: null,
  isChecking: false,
  isDownloading: false,
  downloadProgress: 0,
  dismissed: false,
  update: null,
  showUpToDate: false,

  checkForUpdates: async (fromMenu = false) => {
    set({ isChecking: true, dismissed: false, showUpToDate: false })
    try {
      const update = await check()
      console.log('Update check result:', update)
      if (update) {
        set({
          updateAvailable: {
            version: update.version,
            body: update.body,
          },
          update,
        })
      } else {
        set({
          updateAvailable: null,
          update: null,
          // Only show "up to date" message when triggered from menu
          showUpToDate: fromMenu,
        })
      }
    } catch (error) {
      console.error('Failed to check for updates:', error)
      // If from menu and there's an error, still show "up to date"
      // (likely means no releases exist yet or network issue)
      if (fromMenu) {
        set({ showUpToDate: true })
      }
    } finally {
      set({ isChecking: false })
    }
  },

  downloadAndInstall: async () => {
    const { update } = get()
    if (!update) return

    set({ isDownloading: true, downloadProgress: 0 })
    try {
      let totalSize = 0
      let downloaded = 0
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          totalSize = (event.data as { contentLength?: number }).contentLength || 0
        } else if (event.event === 'Progress') {
          downloaded += (event.data as { chunkLength: number }).chunkLength
          if (totalSize > 0) {
            set({ downloadProgress: (downloaded / totalSize) * 100 })
          }
        }
      })
      await relaunch()
    } catch (error) {
      console.error('Failed to install update:', error)
      set({ isDownloading: false })
    }
  },

  dismiss: () => set({ dismissed: true }),

  dismissUpToDate: () => set({ showUpToDate: false }),

  reset: () => set({
    updateAvailable: null,
    isChecking: false,
    isDownloading: false,
    downloadProgress: 0,
    dismissed: false,
    update: null,
    showUpToDate: false,
  }),
}))
