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

// Docs in any group subcollection with date between from and to (phase 5.13: sessions).
export function useRangeDocs(groupId, name, from, to) {
  const [docs, setDocs] = useState(undefined)
  useEffect(() => {
    if (!groupId || !from || !to) return
    const q = query(collection(db, 'groups', groupId, name), where('date', '>=', from), where('date', '<=', to))
    return onSnapshot(q, (s) => setDocs(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setDocs([]))
  }, [groupId, name, from, to])
  return docs
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

// Docs in a group subcollection for a single day (e.g. photos).
export function useDayDocs(groupId, name, day) {
  const [docs, setDocs] = useState(undefined)
  useEffect(() => {
    if (!groupId || !day) return
    const q = query(collection(db, 'groups', groupId, name), where('date', '==', day))
    return onSnapshot(q, (s) => setDocs(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [groupId, name, day])
  return docs
}

// Names and settings of all your groups, for the switcher (one listener each).
// Returns { [groupId]: { id, name, photoRequired, ... } | null } once loaded.
export function useGroupsMeta(groupIds) {
  const key = groupIds.join(',')
  const [meta, setMeta] = useState({})
  useEffect(() => {
    if (!key) return
    const ids = key.split(',')
    const unsubs = ids.map((id) => onSnapshot(
      doc(db, 'groups', id),
      (s) => setMeta((m) => ({ ...m, [id]: s.exists() ? { id, ...s.data() } : null })),
      () => setMeta((m) => ({ ...m, [id]: null })),
    ))
    return () => unsubs.forEach((u) => u())
  }, [key])
  return meta
}

// Your own docs in one subcollection (check-ins, or extra sessions since
// phase 5.13) across every group you're in or were in, for your private
// calendar on Me. Groups that can't be read are skipped quietly.
export function useMineEverywhere(groupIds, uid, name = 'checkins') {
  const [byGroup, setByGroup] = useState({})
  const key = [...new Set(groupIds || [])].sort().join(',')
  useEffect(() => {
    if (!uid) return
    const ids = key ? key.split(',') : []
    setByGroup({})
    const offs = ids.map((gid) => onSnapshot(
      query(collection(db, 'groups', gid, name), where('uid', '==', uid)),
      (s) => setByGroup((b) => ({ ...b, [gid]: s.docs.map((d) => ({ gid, ...d.data() })) })),
      () => setByGroup((b) => ({ ...b, [gid]: [] })),
    ))
    return () => offs.forEach((off) => off())
  }, [key, uid, name])
  return Object.values(byGroup).flat()
}
export const useMyCheckinsEverywhere = (groupIds, uid) => useMineEverywhere(groupIds, uid, 'checkins')

/** Every group you're in or have been in. Older accounts only have groupId. */
export const allMyGroupIds = (profile) => [...new Set([...(profile?.groupIds || []), profile?.groupId, ...(profile?.leftGroupIds || [])].filter(Boolean))]
