import { useEffect, useState } from 'react'
import { doc, collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from './firebase'

// Live Firestore subscriptions. Each returns undefined while loading.

export function useUserDoc(uid) {
  const [data, setData] = useState(undefined)
  useEffect(() => {
    if (!uid) return
    return onSnapshot(doc(db, 'users', uid), (s) => setData(s.exists() ? s.data() : null), () => setData(null))
  }, [uid])
  return data
}

export function useGroup(groupId) {
  const [group, setGroup] = useState(undefined)
  const [error, setError] = useState(null)
  useEffect(() => {
    if (!groupId) return
    return onSnapshot(
      doc(db, 'groups', groupId),
      (s) => setGroup(s.exists() ? { id: s.id, ...s.data() } : null),
      (e) => { setError(e); setGroup(null) },
    )
  }, [groupId])
  return { group, error }
}

export function useMembers(groupId) {
  const [members, setMembers] = useState(undefined)
  useEffect(() => {
    if (!groupId) return
    return onSnapshot(collection(db, 'groups', groupId, 'members'), (s) =>
      setMembers(s.docs.map((d) => ({ uid: d.id, ...d.data() }))
        .sort((a, b) => a.name.localeCompare(b.name))),
    )
  }, [groupId])
  return members
}

// Check-ins with date between from and to (inclusive, YYYY-MM-DD strings).
export function useCheckins(groupId, from, to) {
  const [checkins, setCheckins] = useState(undefined)
  useEffect(() => {
    if (!groupId || !from || !to) return
    const q = query(
      collection(db, 'groups', groupId, 'checkins'),
      where('date', '>=', from),
      where('date', '<=', to),
    )
    return onSnapshot(q, (s) => setCheckins(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [groupId, from, to])
  return checkins
}

// All of one member's check-ins (for streaks).
export function useMyCheckins(groupId, uid) {
  const [checkins, setCheckins] = useState(undefined)
  useEffect(() => {
    if (!groupId || !uid) return
    const q = query(collection(db, 'groups', groupId, 'checkins'), where('uid', '==', uid))
    return onSnapshot(q, (s) => setCheckins(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [groupId, uid])
  return checkins
}

// Every doc in a small group subcollection (rest-day votes, penalty changes).
export function useSubcollection(groupId, name) {
  const [docs, setDocs] = useState(undefined)
  useEffect(() => {
    if (!groupId) return
    return onSnapshot(collection(db, 'groups', groupId, name), (s) =>
      setDocs(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [groupId, name])
  return docs
}
