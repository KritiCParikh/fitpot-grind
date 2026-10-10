import { useState } from 'react'
import { onItsDay } from '../lib/clock'
import { fmt, currencyInfo } from '../lib/money'
import { useCheckins } from '../hooks'
import { addDays, prettyDay, currentStreak, bestStreak } from '../lib/dates'
import { settleUp } from '../lib/ledger'
import { useLedgerInputs, runLedger } from '../lib/useLedger'
import Avatar from '../components/Avatar'

function monthBounds(y, m) {
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const end = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10)
  return { start, end }
}

export default function Board({ user, group, members }) {
  const { clock, money } = group
  const today = clock.today()
  const cur = money.current()
  const $ = (x, opts) => fmt(x, cur, opts)
  // Settled through the last day that has ended for everyone in the group.
  const closed = clock.closedThrough()
  const [offset, setOffset] = useState(0) // 0 = this month, -1 = last month
  const d = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1 + offset, 1))
  const { start, end } = monthBounds(d.getUTCFullYear(), d.getUTCMonth())
  const settledTo = end < closed ? end : closed
  const monthLabel = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })

  const inputs = useLedgerInputs(group, start, end)
  // Streaks look back 60 days (keeps database reads low).
  const recent = useCheckins(group.id, addDays(today, -60), clock.latestDay())

  const byUid = Object.fromEntries(members.map((m) => [m.uid, m]))
  const name = (uid) => byUid[uid]?.name || 'Someone'

  let body = <p className="muted">Loading...</p>
  if (inputs && recent) {
    const hasDays = settledTo >= start
    const ledger = hasDays ? runLedger(group, members, inputs, start, settledTo) : { days: [], weeks: [], totals: {} }
    const totals = Object.fromEntries(members.map((m) => [m.uid, ledger.totals[m.uid] || 0]))
    const ranked = [...members].sort((a, b) => totals[b.uid] - totals[a.uid])
    const transfers = settleUp(totals)
    const potTotal = ledger.days.reduce((s, x) => s + x.pot, 0)
    const restDays = ledger.days.filter((x) => x.rest).length

    const daysByUid = {}
    for (const c of recent) if (onItsDay(c, clock)) (daysByUid[c.uid] ||= new Set()).add(c.date)
    const streaks = members
      .map((m) => ({ m, cur: currentStreak(daysByUid[m.uid] || new Set(), clock.todayOf(m.uid)), best: bestStreak(daysByUid[m.uid] || new Set()) }))
      .sort((a, b) => b.cur - a.cur || b.best - a.best)

    body = (
      <>
        <div className="stats-row">
          <div className="card stat">
            <p className="muted small">Pot moved</p>
            <p className="stat-num orange">{$(potTotal, { digits: 0 })}</p>
          </div>
          <div className="card stat">
            <p className="muted small">{ledger.weeks.length ? 'Weeks settled' : 'Days settled'}</p>
            <p className="stat-num">{ledger.weeks.length || ledger.days.filter((x) => x.mode === 'daily').length}</p>
          </div>
          <div className="card stat">
            <p className="muted small">Rest days</p>
            <p className="stat-num">{restDays}</p>
          </div>
        </div>

        <h3 className="section-title">Balances</h3>
        <ul className="member-list">
          {ranked.map((m, i) => (
            <li key={m.uid} className={totals[m.uid] > 0 ? 'in' : totals[m.uid] < 0 ? 'out' : ''}>
              <span className="rank">{i + 1}</span>
              <Avatar member={m} size={32} />
              <span className="grow">{m.name}{m.uid === user.uid ? ' (you)' : ''}{i === ranked.length - 1 && totals[m.uid] < 0 ? ' (last place)' : ''}</span>
              <span className="pill">{$(totals[m.uid], { plus: true })}</span>
            </li>
          ))}
        </ul>

        <h3 className="section-title">Settle up</h3>
        {transfers.length ? (
          <ul className="member-list">
            {transfers.map((t, i) => (
              <li key={i}>
                <span className="grow"><strong>{name(t.from)}</strong> pays <strong>{name(t.to)}</strong></span>
                <span className="pill">{$(t.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="card"><p className="muted">All square. Nobody owes anything{hasDays ? '' : ' yet'}.</p></div>
        )}
        <p className="muted small">
          {offset === 0 ? `Settled through ${prettyDay(closed)}: a day settles once it has ended for everyone (weekly groups: Sunday). A week counts in the month it ends.` : 'Final for the month.'} Pay each other however you like; FitPot doesn't move money.
        </p>
        {money.applied().length > 0 && (
          <p className="muted small">
            All amounts in {currencyInfo(cur).name}s. {money.applied().map((c) => `From ${prettyDay(c.effectiveDate).split(', ').slice(1).join(', ')}: 1 ${currencyInfo(c.from).symbol} = ${c.rate} ${currencyInfo(c.currency).symbol}`).join(' · ')}. Earlier amounts are converted at these rates.
          </p>
        )}

        {ledger.weeks?.length > 0 && (
          <>
            <h3 className="section-title">Weeks</h3>
            <ul className="member-list week-list">
              {[...ledger.weeks].reverse().map((w) => (
                <li key={w.mon}>
                  <span className="grow">
                    <strong>{new Date(w.mon + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })} week</strong>
                    <span className="muted small"> · target {w.needed}{w.restDays ? ` (${w.restDays} rest)` : ''} · pot {$(w.pot, { digits: 0 })}</span>
                  </span>
                  <span className="muted small week-counts">
                    {Object.entries(w.counts).map(([uid, c]) => `${name(uid).split(' ')[0]} ${c}${w.short[uid] ? '✗' : '✓'}`).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className="section-title">Streaks</h3>
        <ul className="member-list">
          {streaks.map(({ m, cur, best }) => (
            <li key={m.uid}>
              <Avatar member={m} size={32} />
              <span className="grow">{m.name}</span>
              <span className="muted small">best {best}</span>
              <span className="pill">{cur} day{cur === 1 ? '' : 's'}</span>
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <section>
      <h2>Board</h2>
      <div className="cal-head">
        <button className="btn-ghost" onClick={() => setOffset((o) => o - 1)} aria-label="Previous month">‹</button>
        <strong>{monthLabel}</strong>
        <button className="btn-ghost" onClick={() => setOffset((o) => o + 1)} disabled={offset === 0} aria-label="Next month">›</button>
      </div>
      {body}
    </section>
  )
}
