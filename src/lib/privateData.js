// Private, per-person data: food log, own foods, targets, weight, progress
// photos. Everything lives under private/{uid}/... and the Firestore rules let
// ONLY that person read or write it. Nobody in the group can see it.

import { useEffect, useState } from 'react'
import {
  collection, doc, onSnapshot, query, where, orderBy, limit,
  addDoc, setDoc, deleteDoc, serverTimestamp, getDocs,
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
export const CM_PER_IN = 2.54

// ---------- Training (phase 5.2) ----------
// settings/training: goal, daysPerWeek, sessionMin, experience, restSec, limitations, equipment [keys], customEquipment [names]
// workouts/{id}:     date, title, notes, exercises [{ key, name, muscle, sets [{ reps, kg }] }]  (kg always)
// exercises/{id}:    your own exercises: name, muscle, eq [equipment keys]
// routines/{id}:     name, items [{ key, name, muscle, sets, reps }]
// measurements/{date}: date, cm { waist, chest, hips, arm, thigh, neck }, bodyFat
export const useTraining = (uid) => useLive(() => doc(db, 'private', uid, 'settings', 'training'), [uid])
export const saveTraining = (uid, patch) => setDoc(doc(db, 'private', uid, 'settings', 'training'), patch, { merge: true })

export const useWorkouts = (uid) => useLive(() => col(uid, 'workouts'), [uid])
export function saveWorkout(uid, w) {
  const { id, createdMs: _c, ...data } = w
  return id
    ? setDoc(doc(db, 'private', uid, 'workouts', id), { ...data, updatedAt: serverTimestamp() }, { merge: true })
    : addDoc(col(uid, 'workouts'), { ...data, createdAt: serverTimestamp() })
}
export const deleteWorkout = (uid, id) => deleteDoc(doc(db, 'private', uid, 'workouts', id))

export const useCustomExercises = (uid) => useLive(() => col(uid, 'exercises'), [uid])
export const addCustomExercise = (uid, ex) => addDoc(col(uid, 'exercises'), { ...ex, createdAt: serverTimestamp() })
export const deleteCustomExercise = (uid, id) => deleteDoc(doc(db, 'private', uid, 'exercises', id))

export const useRoutines = (uid) => useLive(() => col(uid, 'routines'), [uid])
export function saveRoutine(uid, r) {
  const { id, ...data } = r
  return id
    ? setDoc(doc(db, 'private', uid, 'routines', id), { ...data, updatedAt: serverTimestamp() })
    : addDoc(col(uid, 'routines'), { ...data, createdAt: serverTimestamp() })
}
export const deleteRoutine = (uid, id) => deleteDoc(doc(db, 'private', uid, 'routines', id))

export const useMeasurements = (uid) => useLive(() => col(uid, 'measurements'), [uid])
export const logMeasurements = (uid, date, data) =>
  setDoc(doc(db, 'private', uid, 'measurements', date), { ...data, date, at: serverTimestamp() })
export const deleteMeasurements = (uid, date) => deleteDoc(doc(db, 'private', uid, 'measurements', date))

/** Everything private, read once (for "Export my data"). */
export async function readAllPrivate(uid) {
  const names = ['meals', 'foods', 'weights', 'measurements', 'workouts', 'exercises', 'routines', 'progress', 'settings']
  const out = {}
  for (const n of names) {
    const snap = await getDocs(col(uid, n))
    out[n] = snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) }))
  }
  return out
}
// Firestore timestamps → ISO strings so the export is plain JSON.
function plain(v) {
  if (v && typeof v.toDate === 'function') return v.toDate().toISOString()
  if (Array.isArray(v)) return v.map(plain)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]))
  return v
}
