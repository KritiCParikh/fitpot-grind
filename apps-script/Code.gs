/**
 * FitPot — Drive photo backend (Google Apps Script)
 *
 * Runs as YOU, so every workout photo lands in YOUR Google Drive:
 *   FitPot/<member name>/<YYYY-MM>/<YYYY-MM-DD_HHmmss>.jpg
 *
 * Deploy: Extensions → Apps Script (or script.google.com) → paste this file →
 *   Project Settings → Script properties:
 *     FIREBASE_API_KEY = your Firebase web API key
 *     TIMEZONE         = America/New_York
 *   Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 * Put the web app URL in VITE_DRIVE_UPLOAD_URL.
 *
 * "Anyone" can reach the URL, but every request must carry a valid Firebase
 * ID token, which is verified below before anything is written.
 *
 * Status: starter. Wired into the app in the photo-wall phase.
 */

const ROOT_FOLDER_NAME = 'FitPot';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const user = verifyFirebaseToken_(body.idToken);
    if (!user) return json_({ ok: false, error: 'unauthorized' });

    if (body.action === 'upload') return json_(uploadPhoto_(user, body));
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'fitpot-drive' });
}

/** Save a base64 JPEG into FitPot/<member>/<month>/ and return its file id. */
function uploadPhoto_(user, body) {
  const tz = prop_('TIMEZONE') || 'America/New_York';
  const now = new Date(); // server time — the client clock is never trusted
  const month = Utilities.formatDate(now, tz, 'yyyy-MM');
  const stamp = Utilities.formatDate(now, tz, 'yyyy-MM-dd_HHmmss');

  const memberName = (user.displayName || user.email || user.localId).replace(/[\\/]/g, '-');
  const folder = getOrCreate_(getOrCreate_(getOrCreate_(DriveApp.getRootFolder(), ROOT_FOLDER_NAME), memberName), month);

  const bytes = Utilities.base64Decode(body.imageBase64);
  if (bytes.length > 2 * 1024 * 1024) return { ok: false, error: 'image too large (max 2 MB)' };

  const file = folder.createFile(Utilities.newBlob(bytes, 'image/jpeg', stamp + '.jpg'));
  file.setDescription(JSON.stringify({ uid: user.localId, takenAt: now.toISOString() }));
  return { ok: true, fileId: file.getId(), takenAt: now.toISOString() };
}

/** Verify a Firebase ID token by asking Google's Identity Toolkit who it belongs to. */
function verifyFirebaseToken_(idToken) {
  if (!idToken) return null;
  const res = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + prop_('FIREBASE_API_KEY'),
    { method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken }), muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) return null;
  const users = JSON.parse(res.getContentText()).users;
  return users && users[0] ? users[0] : null;
}

function getOrCreate_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function prop_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
