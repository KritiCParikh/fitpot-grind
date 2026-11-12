// Settling up (phase 5.16). FitPot never moves money: this only remembers
// that two friends squared up, and how, so the Board can show what's left.
//
//   groups/{gid}/settlements/{id}   { from, to, amount, currency, month 'YYYY-MM', method, note?, by, createdAt }
//
// Either of the two can record it. Only the person who'd receive can choose
// "Let it go". The chat line never shows the amount.

import { useEffect, useState } from 'react'
import { collection, doc, addDoc, deleteDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export const SETTLE_METHODS = [
  { key: 'upi', label: 'UPI or bank', chat: 'by UPI' },
  { key: 'cash', label: 'Cash', chat: 'in cash' },
  { key: 'splitwise', label: 'Splitwise', chat: 'on Splitwise' },
  { key: 'treat', label: 'A treat', sub: 'a meal, chai, coffee', chat: 'over a treat' },
  { key: 'other', label: 'Something else', chat: '' },
  { key: 'letgo', label: 'Let it go', sub: 'call it even, with love', chat: 'with a kind let it go', receiverOnly: true },
]
export const methodLabel = (k) => SETTLE_METHODS.find((m) => m.key === k)?.label || 'Settled'

/** This month's settlements in a group. Live. */
export function useSettlements(gid, month) {
  const [docs, setDocs] = useState(undefined)
  useEffect(() => {
    if (!gid || !month) return
    setDocs(undefined)
    return onSnapshot(query(collection(db, 'groups', gid, 'settlements'), where('month', '==', month)),
      (s) => setDocs(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setDocs([]))
  }, [gid, month])
  return docs
}

export function recordSettlement(user, gid, { from, to, amount, currency, month, method, note = '' }) {
  return addDoc(collection(db, 'groups', gid, 'settlements'), {
    from, to, amount: Math.round(Number(amount) * 100) / 100, currency, month, method,
    ...(note.trim() ? { note: note.trim().slice(0, 80) } : {}),
    by: user.uid, createdAt: serverTimestamp(),
  })
}

export const undoSettlement = (gid, id) => deleteDoc(doc(db, 'groups', gid, 'settlements', id))

/**
 * Balances after what's already been squared up. A payer who settled is
 * closer to zero, and so is the person they paid. Pure.
 */
export function afterSettlements(totals, settlements = []) {
  const out = { ...totals }
  for (const s of settlements) {
    out[s.from] = (out[s.from] || 0) + s.amount
    out[s.to] = (out[s.to] || 0) - s.amount
  }
  return out
}
