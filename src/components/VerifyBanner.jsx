import { useState } from 'react'
import { isVerified, resendVerification, refreshVerified, authMessage } from '../lib/account'

// Shown until an email account confirms its address. Joining or creating a
// group needs a verified email.
export default function VerifyBanner({ user, onVerified }) {
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  if (isVerified(user)) return null

  async function act(fn) {
    setBusy(true); setMsg('')
    try { await fn() } catch (e) { setMsg(authMessage(e)) } finally { setBusy(false) }
  }

  return (
    <div className="card verify-card" role="status">
      <p><strong>Confirm your email</strong></p>
      <p className="muted small">We sent a link to <strong>{user.email}</strong>. Tap it, then come back and press "I've confirmed". You need this before joining or creating a group. (Check spam if it's not there.)</p>
      <div className="action-row">
        <button className="btn-primary" disabled={busy} onClick={() => act(async () => {
          if (await refreshVerified(user)) onVerified?.()
          else setMsg('Not confirmed yet. Open the link in the email first.')
        })}>I've confirmed</button>
        <button className="btn-ghost" disabled={busy} onClick={() => act(async () => { await resendVerification(user); setMsg('Sent again.') })}>Resend email</button>
      </div>
      {msg && <p className="muted small">{msg}</p>}
    </div>
  )
}
