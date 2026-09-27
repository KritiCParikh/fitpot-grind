import { useEffect, useRef, useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useUserDoc } from '../hooks'
import { uploadPhoto } from '../lib/photos'

const MAX_SIDE = 1080
const TARGET_BYTES = 500 * 1024

// Live camera only: there is no file picker anywhere, so gallery photos
// can't be submitted. Works on phones and on laptops with a webcam.
export default function CameraCapture({ user, group, onClose, onUploaded, checkIn = false }) {
  const profile = useUserDoc(user.uid)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [facing, setFacing] = useState('environment')
  const [phase, setPhase] = useState('starting') // starting | live | review | uploading
  const [shot, setShot] = useState(null) // { blob, url }
  const [error, setError] = useState('')
  const consented = profile?.photoConsent === true
  const wantCamera = consented && (phase === 'starting' || phase === 'live')

  useEffect(() => {
    if (!wantCamera) return
    let cancelled = false
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 } }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        videoRef.current.srcObject = stream
        setPhase('live')
      })
      .catch((e) => setError(e.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access for this site in your browser settings, then try again.'
        : `Couldn't open the camera (${e.message}).`))
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()) }
  }, [wantCamera, facing])

  async function capture() {
    const video = videoRef.current
    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight))
    const w = Math.round(video.videoWidth * scale), h = Math.round(video.videoHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, w, h)
    watermark(ctx, w, h, user.displayName || 'FitPot', group.timezone)

    let blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.75))
    if (blob.size > TARGET_BYTES) blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.55))
    streamRef.current?.getTracks().forEach((t) => t.stop())
    setShot({ blob, url: URL.createObjectURL(blob) })
    setPhase('review')
  }

  async function send() {
    setPhase('uploading'); setError('')
    try {
      await uploadPhoto(user, group, shot.blob, { checkIn })
      onUploaded?.()
      onClose()
    } catch (e) {
      setError(e.message || String(e)); setPhase('review')
    }
  }

  function retake() { setShot(null); setPhase('starting') }

  if (profile === undefined) return <Overlay onClose={onClose}><p className="muted">Loading…</p></Overlay>

  if (!consented) {
    return (
      <Overlay onClose={onClose}>
        <div className="card consent">
          <h3>Before your first photo</h3>
          <ul className="muted small">
            <li>Your photo is shared with <strong>everyone in {group.name}</strong> right away.</li>
            <li>It's saved in the group organiser's Google Drive, in a folder with your name.</li>
            <li>The date and time are stamped onto it. No location is recorded.</li>
            <li>Only the live camera works. You can't upload from your gallery.</li>
          </ul>
          <button className="btn-primary" onClick={() => setDoc(doc(db, 'users', user.uid), { photoConsent: true }, { merge: true })}>
            I understand
          </button>
        </div>
      </Overlay>
    )
  }

  return (
    <Overlay onClose={onClose}>
      <div className="camera">
        {phase === 'review' || phase === 'uploading'
          ? <img src={shot.url} alt="Your workout photo" className="camera-view" />
          : <video ref={videoRef} className="camera-view" autoPlay playsInline muted />}
        {error && <p className="error small">{error}</p>}
        <div className="camera-controls">
          {phase === 'live' && (
            <>
              <button className="btn-ghost" onClick={() => { setPhase('starting'); setFacing((f) => (f === 'user' ? 'environment' : 'user')) }}>Flip</button>
              <button className="shutter" onClick={capture} aria-label="Take photo" />
              <span style={{ width: 56 }} />
            </>
          )}
          {phase === 'review' && (
            <>
              <button className="btn-ghost" onClick={retake}>Retake</button>
              <button className="btn-primary" onClick={send}>{checkIn ? 'Check in + post' : 'Post to group'}</button>
            </>
          )}
          {phase === 'uploading' && <p className="muted">Uploading…</p>}
          {phase === 'starting' && !error && <p className="muted">Opening camera…</p>}
        </div>
      </div>
    </Overlay>
  )
}

function Overlay({ children, onClose }) {
  return (
    <div className="overlay">
      <button className="overlay-close btn-ghost" onClick={onClose} aria-label="Close">✕</button>
      {children}
    </div>
  )
}

function watermark(ctx, w, h, name, timeZone) {
  const stamp = new Date().toLocaleString(undefined, {
    timeZone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  const size = Math.max(16, Math.round(w / 32))
  const bar = size * 2.4
  ctx.fillStyle = 'rgba(11, 13, 12, 0.6)'
  ctx.fillRect(0, h - bar, w, bar)
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${size}px Inter, Arial, sans-serif`
  ctx.fillStyle = '#c6ff3d'
  ctx.fillText('FitPot', size * 0.8, h - bar / 2)
  const brandW = ctx.measureText('FitPot').width
  ctx.fillStyle = '#ffffff'
  ctx.font = `500 ${size}px Inter, Arial, sans-serif`
  ctx.fillText(`  ${name} · ${stamp}`, size * 0.8 + brandW, h - bar / 2)
}
