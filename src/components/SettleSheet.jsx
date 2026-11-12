import { useState } from 'react'
import { SETTLE_METHODS, recordSettlement } from '../lib/settle'
import { sendSettle } from '../lib/chat'

// Settle up (phase 5.16): a kind little sheet to note how two friends squared
// up. FitPot never moves money; it just keeps the Board honest.
export default function SettleSheet({ user, group, transfer, names, cur, fmtMoney, month, onClose }) {
  const iPay = transfer.from === user.uid
  const other = iPay ? transfer.to : transfer.from
  const otherName = (names[other] || 'your friend').split(' ')[0]
  const [method, setMethod] = useState('')
  const [amount, setAmount] = useState(String(transfer.amount))
  const [note, setNote] = useState('')
  const [tell, setTell] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const methods = SETTLE_METHODS.filter((m) => !m.receiverOnly || !iPay)
  const amt = Number(amount)
  const ok = method && amt > 0 && amt <= transfer.amount + 0.001 && (method !== 'other' || note.trim())

  async function save() {
    setBusy(true); setError('')
    try {
      await recordSettlement(user, group.id, { from: transfer.from, to: transfer.to, amount: amt, currency: cur, month, method, note })
      if (tell) await sendSettle(user, group.id, { other, otherName: names[other], method }).catch(() => {})
      onClose(true)
    } catch (e) { setError(e.message || String(e)); setBusy(false) }
  }

  return (
    <div className="sheet settle-sheet">
      <div className="sheet-head">
        <h3>Settle up with {otherName}</h3>
        <button className="btn-ghost" onClick={() => onClose(false)}>Close</button>
      </div>
      <p className="settle-lead">{iPay ? `You owe ${otherName} ${fmtMoney(transfer.amount)} this month.` : `${otherName} owes you ${fmtMoney(transfer.amount)} this month.`}</p>
      <p className="muted small">However you square up is between friends. FitPot never moves money, it just remembers so the Board stays right.</p>

      <h3 className="section-title">How did you square up?</h3>
      <div className="settle-methods" role="radiogroup" aria-label="How you settled">
        {methods.map((m) => (
          <button key={m.key} type="button" role="radio" aria-checked={method === m.key} className={`settle-method ${method === m.key ? 'on' : ''} ${m.key === 'letgo' ? 'letgo' : ''}`} onClick={() => setMethod(m.key)}>
            <strong>{m.label}</strong>
            {m.sub && <span className="muted small">{m.sub}</span>}
          </button>
        ))}
      </div>
      {method === 'letgo' && <p className="muted small">That's generous. {otherName} will see it as all square, no strings.</p>}
      {method === 'treat' && <p className="muted small">The best kind of settling. Enjoy it together.</p>}

      <div className="card form">
        <label>Amount ({cur})
          <input className="text-input" type="number" inputMode="decimal" step="0.01" min="0" max={transfer.amount} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        {amt < transfer.amount - 0.001 && amt > 0 && <p className="muted small">Part of it is fine too. The rest stays on the Board.</p>}
        <label>{method === 'other' ? 'What did you do?' : 'A note (optional)'}
          <input className="text-input" value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} placeholder={method === 'treat' ? 'e.g. Dosa breakfast on Sunday' : 'e.g. Paid back at the gym'} />
        </label>
        <label className="check"><input type="checkbox" checked={tell} onChange={(e) => setTell(e.target.checked)} /> Tell the crew we're all square (no amount shown)</label>
      </div>
      {error && <p className="error small">{error}</p>}
      <button className="btn-primary wide" disabled={!ok || busy} onClick={save}>{busy ? 'Saving...' : method === 'letgo' ? 'Call it even' : 'Mark as settled'}</button>
    </div>
  )
}
