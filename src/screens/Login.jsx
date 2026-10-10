import { useState } from 'react'
import { signInGoogle, signUpEmail, signInEmail, resetPassword, authMessage, MIN_PASSWORD } from '../lib/account'

// Sign in with Google, or with email + password (create account / sign in /
// forgot password). One account per email: a Google account can add a
// password later in Account.
export default function Login() {
  const [mode, setMode] = useState('signin') // signin | signup | reset
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function run(fn) {
    setBusy(true); setError(''); setInfo('')
    try { await fn() } catch (e) { setError(authMessage(e)) } finally { setBusy(false) }
  }

  function submit(e) {
    e.preventDefault()
    if (mode === 'signup') run(() => signUpEmail({ name, email, password }))
    else if (mode === 'signin') run(() => signInEmail(email, password))
    else run(async () => {
      await resetPassword(email)
      setInfo(`If ${email.trim()} has a FitPot password, a reset link is on its way. Check your inbox (and spam).`)
    })
  }

  const go = (m) => { setMode(m); setError(''); setInfo('') }

  return (
    <main className="center login">
      <h1 className="logo">FitPot</h1>
      <p className="tagline">Show up or pay up.</p>

      <button className="btn-primary wide google-btn" onClick={() => run(signInGoogle)} disabled={busy}>
        <span className="g-mark" aria-hidden="true">G</span> Continue with Google
      </button>

      <div className="divider"><span>or with email</span></div>

      <form className="card form login-form" onSubmit={submit}>
        {mode !== 'reset' && (
          <div className="segmented">
            <button type="button" className={mode === 'signin' ? 'on' : ''} onClick={() => go('signin')}>Sign in</button>
            <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => go('signup')}>Create account</button>
          </div>
        )}
        {mode === 'reset' && <p><strong>Reset your password</strong><br /><span className="muted small">We'll email you a link to choose a new one.</span></p>}

        {mode === 'signup' && (
          <label>Your name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shown to friends in your groups" autoComplete="name" maxLength={40} required />
          </label>
        )}
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" inputMode="email" required />
        </label>
        {mode !== 'reset' && (
          <label>Password
            <span className="pw-wrap">
              <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? `At least ${MIN_PASSWORD} characters` : ''}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? MIN_PASSWORD : undefined} required />
              <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
            </span>
          </label>
        )}

        <button className="btn-primary" disabled={busy}>
          {busy ? '...' : mode === 'signup' ? 'Create account' : mode === 'signin' ? 'Sign in' : 'Send reset link'}
        </button>
        {mode === 'signin' && <button type="button" className="link-btn" onClick={() => go('reset')}>Forgot password?</button>}
        {mode === 'reset' && <button type="button" className="link-btn" onClick={() => go('signin')}>‹ Back to sign in</button>}
        {mode === 'signup' && <p className="muted small">We'll email you a link to confirm your address. You need it before joining a group.</p>}
      </form>

      {error && <p className="error small" role="alert">{error}</p>}
      {info && <p className="muted small" role="status">{info}</p>}
    </main>
  )
}
