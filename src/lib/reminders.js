// Daily reminders (phase 5.8): asking permission, getting this phone's push
// token, and saving your reminder settings. The reminders themselves are
// sent by an hourly job (scripts/reminders/send.mjs).
//
// private/{you}/settings/reminders   on, tz, slots { morning|afternoon|evening: { on, time } }, lastSent
// private/{you}/devices/{id}         token, platform, updatedAt   (one per phone or browser)
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging'
import { db, app } from '../firebase'
import { localTz } from './clock'
import { isIOS, isInstalled } from './device'

export const VAPID = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''
export const remindersConfigured = Boolean(VAPID)
export const DEFAULT_SLOTS = {
  morning: { on: true, time: '08:00' },
  afternoon: { on: true, time: '13:00' },
  evening: { on: true, time: '19:00' },
}

/** Why reminders can't be turned on here, or '' if they can. */
export async function blocker() {
  if (!remindersConfigured) return 'setup'
  if (isIOS() && !isInstalled()) return 'ios-install'
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !(await isSupported().catch(() => false))) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return ''
}

async function deviceId(token) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(buf).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function currentToken() {
  const registration = await navigator.serviceWorker.ready
  return getToken(getMessaging(app), { vapidKey: VAPID, serviceWorkerRegistration: registration })
}

/** Ask permission, register this phone, and switch reminders on. */
export async function enableReminders(uid, settings) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications weren\'t allowed. You can allow them in your phone\'s settings for this app.')
  const token = await currentToken()
  if (!token) throw new Error('Couldn\'t register this phone for reminders. Try again in a minute.')
  await setDoc(doc(db, 'private', uid, 'devices', await deviceId(token)), {
    token, platform: isIOS() ? 'ios' : /android/i.test(navigator.userAgent) ? 'android' : 'web', updatedAt: serverTimestamp(),
  })
  await setDoc(doc(db, 'private', uid, 'settings', 'reminders'), {
    on: true, tz: localTz(), slots: settings?.slots || DEFAULT_SLOTS,
  }, { merge: true })
}

/** Switch reminders off and forget this phone. */
export async function disableReminders(uid) {
  try {
    const token = await currentToken()
    if (token) await deleteDoc(doc(db, 'private', uid, 'devices', await deviceId(token)))
    await deleteToken(getMessaging(app))
  } catch { /* already gone */ }
  await setDoc(doc(db, 'private', uid, 'settings', 'reminders'), { on: false }, { merge: true })
}

export const saveReminderSlots = (uid, slots) =>
  setDoc(doc(db, 'private', uid, 'settings', 'reminders'), { slots }, { merge: true })

/** On app open: keep this phone's token and your timezone up to date (both can change). */
export async function refreshReminders(uid, settings) {
  if (!settings?.on || (await blocker()) || Notification.permission !== 'granted') return
  const token = await currentToken().catch(() => null)
  if (token) {
    await setDoc(doc(db, 'private', uid, 'devices', await deviceId(token)), { token, updatedAt: serverTimestamp() }, { merge: true })
  }
  if (settings.tz !== localTz()) await setDoc(doc(db, 'private', uid, 'settings', 'reminders'), { tz: localTz() }, { merge: true })
}

/** Show a sample notification right now, to check they appear on this phone. */
export async function testReminder(name) {
  const registration = await navigator.serviceWorker.ready
  await registration.showNotification(`Hello, ${name || 'there'}`, {
    body: 'This is how your FitPot reminders will look. Kind words, three times a day.',
    icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'fitpot-test',
  })
}
