// Private, per-person data: food log, own foods, targets, weight, progress
// photos. Everything lives under private/{uid}/… and the Firestore rules let
// ONLY that person read or write it. Nobody in the group can see it.

import { useEffect, useState } from 'react'
import {
  collection, doc, onSnapshot, query, where, orderBy, limit,
  addDoc, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

const col = (uid, name) => collection(db, 'private', uid, name)

// ---------- live hooks ----------
function useLive(makeRef, deps) {
  const [data, setData] = useState(undefined)
  useEffect(() => {
    const ref = makeRef()
    if (!ref) return
    return onSnapshot(ref, (s) => setData(s.docs ? s.docs.map((d) => ({ id: d.id, ...d.data() })) : (s.exists() ? s.data() : null)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return data
}

export const useSettings = (uid) => useLive(() => doc(db, 'private', uid, 'settings', 'main'), [uid])
export const useMealsOn = (uid, day) => useLive(() => query(col(uid, 'meals'), where('date', '==', day)), [uid, day])
export const useRecentMeals = (uid) => useLive(() => query(col(uid, 'meals'), orderBy('createdAt', 'desc'), limit(60)), [uid])
export const useMyFoods = (uid) => useLive(() => col(uid, 'foods'), [uid])
export const useWeights = (uid) => useLive(() => col(uid, 'weights'), [uid])
export const useProgressPhotos = (uid) => useLive(() => col(uid, 'progress'), [uid])

// ---------- writes ----------
export const saveSettings = (uid, patch) => setDoc(doc(db, 'private', uid, 'settings', 'main'), patch, { merge: true })

export function logMeal(uid, { date, meal, food, qty, unit, nutrients }) {
  return addDoc(col(uid, 'meals'), {
    date, meal, qty, unit: unit.label,
    name: food.name, brand: food.brand || '', source: food.source,
    // enough to re-log it from "Recent" without searching again
    food: { key: food.key, name: food.name, brand: food.brand || '', source: food.source, base: food.base, units: food.units },
    nutrients,
    createdAt: serverTimestamp(),
  })
}
export const deleteMeal = (uid, id) => deleteDoc(doc(db, 'private', uid, 'meals', id))

// Own food or recipe, stored per serving.
export function saveMyFood(uid, food) {
  const { id, ...data } = food
  return id
    ? setDoc(doc(db, 'private', uid, 'foods', id), { ...data, updatedAt: serverTimestamp() })
    : addDoc(col(uid, 'foods'), { ...data, createdAt: serverTimestamp() })
}
export const deleteMyFood = (uid, id) => deleteDoc(doc(db, 'private', uid, 'foods', id))

// Weight is always stored in kg; one entry per date (re-logging replaces it).
export const logWeight = (uid, date, kg) =>
  setDoc(doc(db, 'private', uid, 'weights', date), { kg, date, at: serverTimestamp() })
export const deleteWeight = (uid, date) => deleteDoc(doc(db, 'private', uid, 'weights', date))

export const addProgressPhoto = (uid, { date, fileId, note }) =>
  addDoc(col(uid, 'progress'), { date, fileId, note: note || '', createdAt: serverTimestamp() })
export const deleteProgressPhoto = (uid, id) => deleteDoc(doc(db, 'private', uid, 'progress', id))

export const LB_PER_KG = 2.20462
