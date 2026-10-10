import { useEffect, useState } from 'react'

// Small helpers about the phone the app is running on (phase 5.5).

/** Opened from the home screen icon (installed), not a browser tab. */
export const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true ||
  document.referrer.startsWith('android-app://') // the Android app wrapper

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) // iPad in desktop mode

/** True while the phone has a connection. */
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine !== false)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

// Remember small choices (like hiding the install card) on this phone only.
export const local = {
  get(k) { try { return localStorage.getItem(k) } catch { return null } },
  set(k, v) { try { localStorage.setItem(k, v) } catch { /* private mode: fine */ } },
}
