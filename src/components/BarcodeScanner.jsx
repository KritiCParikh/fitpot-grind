import { useEffect, useRef, useState } from 'react'

// Scans EAN/UPC barcodes on packaged food with the camera. Uses the phone's
// built-in detector when it has one (Android Chrome), otherwise loads a small
// open-source scanner (ZXing, runs on the phone) on first use.
async function getDetector() {
  const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e']
  if ('BarcodeDetector' in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats()
      if (formats.some((f) => supported.includes(f))) return new window.BarcodeDetector({ formats })
    } catch { /* fall through to the library */ }
  }
  const { BarcodeDetector } = await import('barcode-detector/ponyfill')
  return new BarcodeDetector({ formats })
}

export default function BarcodeScanner({ onCode, onClose }) {
  const videoRef = useRef(null)
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')

  useEffect(() => {
    let stream, timer, stopped = false
    ;(async () => {
      try {
        const detector = await getDetector()
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (stopped) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        const tick = async () => {
          if (stopped) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length) { navigator.vibrate?.(40); onCode(codes[0].rawValue); return }
          } catch { /* frame not ready */ }
          timer = setTimeout(tick, 250)
        }
        tick()
      } catch (e) {
        setError(e.name === 'NotAllowedError' ? 'Camera permission was denied.' : `Scanner unavailable (${e.message}). Type the number instead.`)
      }
    })()
    return () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()) }
  }, [onCode])

  return (
    <div className="overlay">
      <button className="overlay-close btn-ghost" onClick={onClose} aria-label="Close">✕</button>
      <div className="camera">
        <div className="scan-frame">
          <video ref={videoRef} className="camera-view" playsInline muted />
          <div className="scan-line" />
        </div>
        <p className="muted small">Point at the barcode on the pack.</p>
        {error && <p className="error small">{error}</p>}
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) onCode(manual.trim()) }}>
          <input className="text-input" inputMode="numeric" placeholder="Or type the barcode number" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))} />
          <button className="btn-ghost" disabled={manual.length < 8}>Look up</button>
        </form>
      </div>
    </div>
  )
}
