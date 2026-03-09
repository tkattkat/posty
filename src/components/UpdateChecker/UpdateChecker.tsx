import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { Download, X, RefreshCw, CheckCircle } from 'lucide-react'
import { useUpdateStore } from '../../stores/updateStore'

export function UpdateChecker() {
  const {
    updateAvailable,
    isDownloading,
    downloadProgress,
    dismissed,
    showUpToDate,
    checkForUpdates,
    downloadAndInstall,
    dismiss,
    dismissUpToDate,
    reset,
  } = useUpdateStore()

  useEffect(() => {
    // Check for updates on mount (not from menu, so no "up to date" message)
    checkForUpdates(false)

    // Check every 30 minutes
    const interval = setInterval(() => checkForUpdates(false), 30 * 60 * 1000)

    // Listen for menu "Check for Updates" event
    const unlisten = listen('check-for-updates', () => {
      // Reset dismissed state and check again (from menu, so show "up to date" if no update)
      reset()
      checkForUpdates(true)
    })

    return () => {
      clearInterval(interval)
      unlisten.then((fn) => fn())
    }
  }, [checkForUpdates, reset])

  // Show "You're up to date" notification
  if (showUpToDate) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
        <div className="glass-elevated rounded-lg border border-border shadow-2xl p-4 max-w-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[14px] font-medium text-text-primary">
                You're up to date
              </h3>
              <p className="text-[12px] text-text-secondary mt-0.5">
                Posty is running the latest version
              </p>
            </div>
            <button
              onClick={dismissUpToDate}
              className="p-1 hover:bg-bg-hover rounded transition-colors text-text-muted hover:text-text-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
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
            onClick={dismiss}
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
              onClick={dismiss}
              className="btn-secondary flex-1 text-[12px] py-1.5"
            >
              Later
            </button>
            <button
              onClick={downloadAndInstall}
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
