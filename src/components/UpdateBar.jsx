import { useRegisterSW } from 'virtual:pwa-register/react'

// When a new version of FitPot has been uploaded, the phone downloads it in
// the background and this bar asks before switching, so nothing you're typing
// gets lost. It also checks for updates every hour while the app is open.
export default function UpdateBar() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
    },
  })
  if (!needRefresh) return null
  return (
    <div className="update-bar" role="status">
      <span className="update-text">New version ready.</span>
      <button className="btn-ghost" onClick={() => setNeedRefresh(false)}>Later</button>
      <button className="btn-primary" onClick={() => updateServiceWorker(true)}>Update</button>
    </div>
  )
}
