import { useEffect, useState } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { Download, X, RefreshCw } from 'lucide-react'

interface UpdateInfo {
  version: string
  body?: string
}

export function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const update = await check()
        if (update) {
          setUpdateAvailable({
            version: update.version,
            body: update.body,
          })
        }
      } catch (error) {
        console.error('Failed to check for updates:', error)
      }
    }

    // Check for updates on mount
    checkForUpdates()

    // Check every 30 minutes
    const interval = setInterval(checkForUpdates, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const handleUpdate = async () => {
    try {
      setIsDownloading(true)
      const update = await check()
      if (!update) return

      let totalSize = 0
      let downloaded = 0
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          totalSize = (event.data as { contentLength?: number }).contentLength || 0
        } else if (event.event === 'Progress') {
          downloaded += (event.data as { chunkLength: number }).chunkLength
          if (totalSize > 0) {
            setDownloadProgress((downloaded / totalSize) * 100)
          }
        }
      })

      // Relaunch the app after update
      await relaunch()
    } catch (error) {
      console.error('Failed to install update:', error)
      setIsDownloading(false)
    }
  }

  if (!updateAvailable || dismissed) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
      <div className="glass-elevated rounded-lg border border-border shadow-2xl p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <Download className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-medium text-text-primary">
              Update Available
            </h3>
            <p className="text-[12px] text-text-secondary mt-0.5">
              Version {updateAvailable.version} is ready to install
            </p>
            {updateAvailable.body && (
              <p className="text-[11px] text-text-tertiary mt-2 line-clamp-2">
                {updateAvailable.body}
              </p>
            )}
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-bg-hover rounded transition-colors text-text-muted hover:text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isDownloading ? (
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-accent animate-spin" />
              <span className="text-[12px] text-text-secondary">
                Downloading... {Math.round(downloadProgress)}%
              </span>
            </div>
            <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setDismissed(true)}
              className="btn-secondary flex-1 text-[12px] py-1.5"
            >
              Later
            </button>
            <button
              onClick={handleUpdate}
              className="btn-primary flex-1 text-[12px] py-1.5"
            >
              Update Now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
