// Progress photos in EACH PERSON'S OWN Google Drive.
//
// Unlike workout photos (which go through the organiser's Apps Script), these
// never touch anyone else's account. The app asks Google for a token with the
// narrowest Drive permission, "drive.file": FitPot can only see and manage
// files FitPot itself created, nothing else in your Drive.
//
// Uses Google Identity Services (the official Google sign-in library),
// loaded only when you use progress photos.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const FOLDER_NAME = 'FitPot Progress'

export const myDriveEnabled = Boolean(CLIENT_ID)

let gisPromise = null
function loadGis() {
  gisPromise ||= new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Could not load Google sign-in'))
    document.head.appendChild(s)
  })
  return gisPromise
}

let token = null // { value, expiresAt }

// Must be called from a tap (it may open a Google popup).
export async function getDriveToken({ hint } = {}) {
  if (token && Date.now() < token.expiresAt - 60_000) return token.value
  await loadGis()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      login_hint: hint,
      callback: (res) => {
        if (res.error) return reject(new Error(res.error_description || res.error))
        token = { value: res.access_token, expiresAt: Date.now() + Number(res.expires_in || 3600) * 1000 }
        resolve(token.value)
      },
      error_callback: (e) => reject(new Error(e?.message || 'Google access was cancelled')),
    })
    client.requestAccessToken({ prompt: '' })
  })
}

export const hasDriveToken = () => Boolean(token && Date.now() < token.expiresAt - 60_000)

async function api(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const res = await fetch(`https://www.googleapis.com${path}`, {
    method, body, headers: { Authorization: `Bearer ${token.value}`, ...headers },
  })
  if (!res.ok) throw new Error(`Google Drive error ${res.status}`)
  return raw ? res : res.status === 204 ? null : res.json()
}

async function ensureFolder() {
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  const found = await api(`/drive/v3/files?q=${q}&fields=files(id)`)
  if (found.files?.length) return found.files[0].id
  const made = await api('/drive/v3/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  })
  return made.id
}

export async function uploadProgressPhoto(blob, date) {
  await getDriveToken()
  const folderId = await ensureFolder()
  const meta = { name: `${date}_${Date.now()}.jpg`, parents: [folderId], mimeType: 'image/jpeg' }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }))
  form.append('file', blob)
  const made = await api('/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: form })
  return made.id
}

const urls = new Map()
export async function progressPhotoUrl(fileId) {
  if (urls.has(fileId)) return urls.get(fileId)
  await getDriveToken()
  const res = await api(`/drive/v3/files/${fileId}?alt=media`, { raw: true })
  const url = URL.createObjectURL(await res.blob())
  urls.set(fileId, url)
  return url
}

export async function deleteProgressFile(fileId) {
  await getDriveToken()
  try { await api(`/drive/v3/files/${fileId}`, { method: 'DELETE' }) } catch { /* already gone */ }
}
