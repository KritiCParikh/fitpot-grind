// Sign-in and account management (phase 5.3).
//
// Two ways in, one account per email:
//   • Continue with Google
//   • Email + password (create account, sign in, forgot password)
// New email accounts get a verification email; joining or creating a group
// needs a verified email (the Firestore rules check it too). Google users can
// add a password, so both ways work for the same account.

import {
  signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
  sendEmailVerification, updateProfile, updatePassword, reauthenticateWithCredential, reauthenticateWithPopup,
  linkWithCredential, EmailAuthProvider, deleteUser, signOut,
} from 'firebase/auth'
import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase'

export const MIN_PASSWORD = 8

// Where links in Firebase's emails (verify, reset) send people back to.
const backToApp = () => ({ url: `${location.origin}${location.pathname}` })

/** Plain-English messages for Firebase Auth errors. */
export function authMessage(e) {
  const code = e?.code || ''
  const map = {
    'auth/invalid-credential': 'Email or password is wrong. If you signed up with Google, use Continue with Google.',
    'auth/wrong-password': 'Wrong password.',
    'auth/user-not-found': 'No account with that email. Create one below.',
    'auth/invalid-email': 'That email address doesn\'t look right.',
    'auth/email-already-in-use': 'That email already has an account. Sign in instead (or use Continue with Google, then add a password in Account).',
    'auth/weak-password': `Use at least ${MIN_PASSWORD} characters.`,
    'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
    'auth/network-request-failed': 'No connection. Check your internet and try again.',
    'auth/popup-closed-by-user': 'The Google window was closed before finishing.',
    'auth/cancelled-popup-request': 'The Google window was closed before finishing.',
    'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site.',
    'auth/requires-recent-login': 'For your security, sign in again and retry.',
    'auth/credential-already-in-use': 'That email and password already belong to another account.',
    'auth/provider-already-linked': 'This account already has a password.',
    'auth/operation-not-allowed': 'Email sign-in isn\'t switched on yet. The organiser needs to enable it in Firebase (BUILD_GUIDE Step 31).',
    'auth/unauthorized-continue-uri': 'This site isn\'t in Firebase\'s authorized domains (BUILD_GUIDE Step 3.3).',
  }
  return map[code] || e?.message || String(e)
}

export const signInGoogle = () => signInWithPopup(auth, googleProvider)

export async function signUpEmail({ name, email, password }) {
  if (password.length < MIN_PASSWORD) throw Object.assign(new Error(), { code: 'auth/weak-password' })
  const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password)
  await updateProfile(user, { displayName: name.trim() })
  await sendEmailVerification(user, backToApp()).catch(() => {}) // they can resend from the banner
  return user
}

export const signInEmail = (email, password) => signInWithEmailAndPassword(auth, email.trim(), password)

/** Sends a reset link. (Firebase doesn't reveal whether the email has an account.) */
export const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim(), backToApp())

export const resendVerification = (user) => sendEmailVerification(user, backToApp())

/** After clicking the link in the email: refresh the account and its token so the rules see it. */
export async function refreshVerified(user) {
  await user.reload()
  await user.getIdToken(true)
  return auth.currentUser?.emailVerified
}

// ---------- who is this account ----------
export const providersOf = (user) => (user?.providerData || []).map((p) => p.providerId)
export const hasPassword = (user) => providersOf(user).includes('password')
export const hasGoogle = (user) => providersOf(user).includes('google.com')
/** Google accounts are verified by Google; email accounts need the link. */
export const isVerified = (user) => Boolean(user?.emailVerified) || hasGoogle(user)

// Some changes need a recent sign-in. Re-confirm with the password if the
// account has one, otherwise with Google.
async function reauth(user, currentPassword) {
  if (hasPassword(user) && currentPassword) {
    return reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword))
  }
  return reauthenticateWithPopup(user, googleProvider)
}

// ---------- changes ----------
/** New display name, also copied to your profile and to each group you're in. */
export async function changeName(user, name, groupIds = []) {
  const clean = name.trim()
  if (!clean) return
  await updateProfile(user, { displayName: clean })
  await setDoc(doc(db, 'users', user.uid), { name: clean }, { merge: true })
  for (const id of groupIds) {
    await updateDoc(doc(db, 'groups', id, 'members', user.uid), { name: clean }).catch(() => {})
  }
}

export async function changePassword(user, currentPassword, newPassword) {
  if (newPassword.length < MIN_PASSWORD) throw Object.assign(new Error(), { code: 'auth/weak-password' })
  await reauth(user, currentPassword)
  await updatePassword(user, newPassword)
}

/** Google users: add a password so you can also sign in with email + password. */
export async function addPassword(user, newPassword) {
  if (newPassword.length < MIN_PASSWORD) throw Object.assign(new Error(), { code: 'auth/weak-password' })
  const cred = EmailAuthProvider.credential(user.email, newPassword)
  try {
    await linkWithCredential(user, cred)
  } catch (e) {
    if (e.code !== 'auth/requires-recent-login') throw e
    await reauthenticateWithPopup(user, googleProvider)
    await linkWithCredential(user, cred)
  }
  await user.reload()
}

export const logOut = () => signOut(auth)

// ---------- delete ----------
const PRIVATE = ['meals', 'foods', 'weights', 'measurements', 'workouts', 'exercises', 'routines', 'progress', 'settings']

/**
 * Delete my account:
 *   1. confirm it's you (password or Google)
 *   2. delete everything under private/{you} (food, training, weight, …)
 *   3. in every group: leave (if you hadn't), and show your name as "Former member"
 *      — past check-ins stay, so friends' balances don't change
 *   4. delete your profile, then your login
 * Progress photos in your own Google Drive are not touched (they're your files).
 */
export async function deleteAccount(user, { currentPassword, groupIds = [] }) {
  await reauth(user, currentPassword)
  const uid = user.uid

  for (const name of PRIVATE) {
    const snap = await getDocs(collection(db, 'private', uid, name))
    for (const d of snap.docs) await deleteDoc(d.ref)
  }

  for (const id of groupIds) {
    try {
      const ref = doc(db, 'groups', id, 'members', uid)
      const me = await getDoc(ref)
      if (!me.exists()) continue
      const batch = writeBatch(db)
      batch.update(ref, {
        name: 'Former member', photoURL: '',
        ...(me.data().leftAt ? {} : { leftAt: serverTimestamp() }),
      })
      await batch.commit()
    } catch { /* group gone or unreadable: nothing to update */ }
  }

  await deleteDoc(doc(db, 'users', uid)).catch(() => {})
  await deleteUser(user)
}
