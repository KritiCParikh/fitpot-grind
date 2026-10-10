import { useEffect, useState } from 'react'
import { isInstalled, isIOS, local } from '../lib/device'

// "Install FitPot" card. On Android/Chrome it's one tap. On iPhone there's no
// install button a website can show, so it explains the two taps in Safari.
// Hidden once installed, or after "Not now".
export default function InstallCard({ always = false }) {
  const [prompt, setPrompt] = useState(() => window.__installPrompt || null)
  const [hidden, setHidden] = useState(() => !always && local.get('fitpot-install-hidden') === '1')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const ready = () => setPrompt(window.__installPrompt)
    const installed = () => setDone(true)
    window.addEventListener('fitpot-installable', ready)
    window.addEventListener('appinstalled', installed)
    return () => { window.removeEventListener('fitpot-installable', ready); window.removeEventListener('appinstalled', installed) }
  }, [])

  if (isInstalled() || done) return always ? <p className="muted small">FitPot is installed on this phone.</p> : null
  if (hidden) return null
  const hide = () => { local.set('fitpot-install-hidden', '1'); setHidden(true) }

  async function install() {
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    window.__installPrompt = null
    setPrompt(null)
    if (outcome === 'accepted') setDone(true)
  }

  return (
    <div className="card install-card">
      <p><strong>Install FitPot on your phone</strong></p>
      <p className="muted small">Get it on your home screen. It opens full screen like any app, works offline and updates itself.</p>
      {prompt ? (
        <div className="action-row">
          <button className="btn-primary" onClick={install}>Install</button>
          {!always && <button className="btn-ghost" onClick={hide}>Not now</button>}
        </div>
      ) : isIOS() ? (
        <>
          <ol className="muted small install-steps">
            <li>Open this page in <strong>Safari</strong>.</li>
            <li>Tap the <strong>Share</strong> button (the square with an arrow pointing up).</li>
            <li>Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
          </ol>
          {!always && <button className="btn-ghost" onClick={hide}>Got it</button>}
        </>
      ) : (
        <>
          <ol className="muted small install-steps">
            <li>Open the browser menu (three dots, top right).</li>
            <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
          </ol>
          {!always && <button className="btn-ghost" onClick={hide}>Got it</button>}
        </>
      )}
    </div>
  )
}
