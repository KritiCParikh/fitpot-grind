/**
 * FitPot — Drive photo backend (Google Apps Script)
 *
 * Saves workout photos into the Google Drive of whoever deploys this script:
 *   FitPot/<member name>/<YYYY-MM>/<YYYY-MM-DD_HHmmss>.jpg
 * and serves them back, but only to members of the same FitPot group.
 *
 * Setup: docs/BUILD_GUIDE.md → Phase 4. In short:
 *   Project Settings → Script properties:
 *     FIREBASE_API_KEY     your Firebase web apiKey
 *     FIREBASE_PROJECT_ID  e.g. fitpot-grind
 *     TIMEZONE             America/New_York
 *   Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone
 *
 * Security: the URL is public, but every request must carry the caller's
 * Firebase ID token. The script (1) asks Google who the token belongs to and
 * (2) reads the caller's member record from Firestore USING THAT TOKEN, so
 * Firestore's own security rules confirm they're really in the group.
 */

const ROOT_FOLDER_NAME = 'FitPot';
const MAX_BYTES = 2 * 1024 * 1024;

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const user = verifyFirebaseToken_(body.idToken);
    if (!user) return json_({ ok: false, error: 'Not signed in (token rejected).' });
    if (!body.groupId || !isMember_(body.groupId, user.localId, body.idToken)) {
      return json_({ ok: false, error: 'Not a member of this group.' });
    }

    if (body.action === 'upload') return json_(uploadPhoto_(user, body));
    if (body.action === 'get') return json_(getPhoto_(body));
    return json_({ ok: false, error: 'Unknown action.' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// Visiting the URL in a browser shows this — handy to confirm the deployment works.
function doGet() {
  return json_({ ok: true, service: 'fitpot-drive', configured: Boolean(prop_('FIREBASE_API_KEY') && prop_('FIREBASE_PROJECT_ID')) });
}

function uploadPhoto_(user, body) {
  const tz = prop_('TIMEZONE') || 'America/New_York';
  const now = new Date(); // server time; the phone's clock is never trusted
  const month = Utilities.formatDate(now, tz, 'yyyy-MM');
  const stamp = Utilities.formatDate(now, tz, 'yyyy-MM-dd_HHmmss');
  const day = Utilities.formatDate(now, tz, 'yyyy-MM-dd');

  const bytes = Utilities.base64Decode(body.imageBase64 || '');
  if (!bytes.length) return { ok: false, error: 'Empty image.' };
  if (bytes.length > MAX_BYTES) return { ok: false, error: 'Image too large (max 2 MB).' };

  const memberName = (user.displayName || user.email || user.localId).replace(/[\\/:*?"<>|]/g, '-');
  const root = getOrCreate_(DriveApp.getRootFolder(), ROOT_FOLDER_NAME);
  const folder = getOrCreate_(getOrCreate_(root, memberName), month);

  const file = folder.createFile(Utilities.newBlob(bytes, 'image/jpeg', stamp + '.jpg'));
  file.setDescription(JSON.stringify({ app: 'fitpot', groupId: body.groupId, uid: user.localId, day: day, takenAt: now.toISOString() }));
  return { ok: true, fileId: file.getId(), day: day, takenAt: now.toISOString() };
}

function getPhoto_(body) {
  const file = DriveApp.getFileById(body.fileId);
  let meta = {};
  try { meta = JSON.parse(file.getDescription() || '{}'); } catch (e) { /* ignore */ }
  // Only hand out FitPot photos that belong to the caller's group.
  if (meta.app !== 'fitpot' || meta.groupId !== body.groupId) return { ok: false, error: 'Not found.' };
  return { ok: true, mime: 'image/jpeg', data: Utilities.base64Encode(file.getBlob().getBytes()) };
}

/** Ask Google's Identity Toolkit who this Firebase ID token belongs to. */
function verifyFirebaseToken_(idToken) {
  if (!idToken) return null;
  const res = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + prop_('FIREBASE_API_KEY'),
    { method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) return null;
  const users = JSON.parse(res.getContentText()).users;
  return users && users[0] ? users[0] : null;
}

/** Read groups/{gid}/members/{uid} from Firestore as the caller; the security rules decide. */
function isMember_(groupId, uid, idToken) {
  const url = 'https://firestore.googleapis.com/v1/projects/' + prop_('FIREBASE_PROJECT_ID') +
    '/databases/(default)/documents/groups/' + encodeURIComponent(groupId) + '/members/' + encodeURIComponent(uid);
  const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + idToken }, muteHttpExceptions: true });
  return res.getResponseCode() === 200;
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
