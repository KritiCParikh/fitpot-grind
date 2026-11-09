import { useEffect, useMemo, useRef, useState } from 'react'
import Avatar from '../components/Avatar'
import ShareSheet from '../components/ShareSheet'
import { RoutineCard } from '../components/RoutineShare'
import { useChat, useCheers, useTogether, useFloor, sendText, sendCheer, toggleSpot, sendInvite, joinInvite, leaveInvite, sendRoutine, deleteMessage, markTogetherDone, CHEERS } from '../lib/chat'
import { useRoutines, useWorkouts, useSettings } from '../lib/privateData'
import { personalRecords, units } from '../lib/training'
import { drawCard, loadCardFonts } from '../lib/shareCard'
import { useMyDays } from '../lib/myDays'
import { PARTS, partOfDay } from '../lib/everywhere'
import { prettyDay, addDays } from '../lib/dates'

// Crew → Chat (phase 5.15). The crew's own room:
//   On the floor   who has a workout open right now, and on what
//   messages       text, cheers, Train together invites, workout cards, routines
//   Spot           one tap under any message; shows who, never how many
// Kind by design: quick cheers are one tap, nothing is counted or ranked.
export default function Chat({ user, group, members }) {
  const gid = group.id
  const msgs = useChat(gid)
  const cheers = useCheers(gid)
  const together = useTogether(gid)
  const floor = useFloor(gid)
  const { days } = useMyDays(user)
  const [text, setText] = useState('')
  const [tool, setTool] = useState(null) // null | 'invite' | 'routine' | 'card'
  const [error, setError] = useState('')
  const endRef = useRef(null)
  const byUid = useMemo(() => Object.fromEntries(members.map((m) => [m.uid, m])), [members])
  const today = group.clock.today()

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }) }, [msgs?.length])
  // Worked out today and said I'm in to a Train together? Tick yourself off.
  const workedToday = days.has(today)
  useEffect(() => {
    if (workedToday && together.some((t) => t.day === today && t.members?.includes(user.uid) && !t.done?.includes(user.uid))) {
      markTogetherDone(user, [gid], today)
    }
  }, [workedToday, together, today, gid, user])

  const run = async (fn) => { setError(''); try { await fn() } catch (e) { setError(e.message || String(e)) } }
  const send = (e) => { e.preventDefault(); const t = text; setText(''); run(() => sendText(user, gid, t)) }

  const spotsFor = (id) => cheers.filter((c) => c.msgId === id)
  const togetherFor = (id) => together.find((t) => t.id === id)

  return (
    <section className="chat">
      <div className="chat-head">
        <h2>Chat</h2>
        <span className="muted small">{group.name}</span>
      </div>

      <div className="floor" aria-live="polite">
        <span className="floor-label"><i className="floor-dot" aria-hidden="true" />On the floor</span>
        {floor.length ? (
          <div className="floor-list">
            {floor.map((f) => (
              <span key={f.uid} className="floor-chip">
                <strong>{f.uid === user.uid ? 'You' : f.name}</strong>
                <span className="muted small">{f.exercise ? `${f.exercise}${f.set ? `, set ${f.set}` : ''}` : 'warming up'}{f.startedAt ? ` · ${Math.max(1, Math.round((Date.now() - f.startedAt) / 60000))} min` : ''}</span>
              </span>
            ))}
          </div>
        ) : <span className="muted small">Nobody is training right now. Start a workout and your crew sees you here.</span>}
      </div>

      <div className="chat-list" role="log" aria-label={`${group.name} chat`}>
        {msgs === undefined && <p className="muted">Loading...</p>}
        {msgs?.length === 0 && (
          <div className="card chat-empty">
            <p><strong>Say hi to {group.name}.</strong></p>
            <p className="muted small">Cheer someone on, invite the crew to train together, or share a routine. Keep it kind: everyone is on their own journey.</p>
          </div>
        )}
        {(msgs || []).map((m, i) => {
          const prev = msgs[i - 1]
          const newDay = !prev || prev.day !== m.day
          const mine = m.uid === user.uid
          const who = byUid[m.uid] || { name: m.name }
          return (
            <div key={m.id}>
              {newDay && <p className="chat-day">{m.day === today ? 'Today' : m.day === addDays(today, -1) ? 'Yesterday' : prettyDay(m.day)}</p>}
              {m.kind === 'cheer' ? (
                <p className={`chat-cheer ${mine ? 'mine' : ''}`}>
                  <strong>{mine ? 'You' : m.name}</strong> <span className="cheer-text">{m.cheer}</span>{m.to && byUid[m.to] ? <> to <strong>{m.to === user.uid ? 'you' : byUid[m.to].name.split(' ')[0]}</strong></> : null}
                  {mine && <button type="button" className="link-btn" aria-label="Delete cheer" onClick={() => run(() => deleteMessage(gid, m.id))}>Undo</button>}
                </p>
              ) : (
                <div className={`chat-msg ${mine ? 'mine' : ''}`}>
                  <Avatar member={who} size={32} />
                  <div className="chat-body">
                    <p className="chat-meta"><strong>{mine ? 'You' : m.name}</strong> <span className="muted small">{timeOf(m)}</span></p>
                    {m.kind === 'text' && <p className="chat-text">{m.text}</p>}
                    {m.kind === 'invite' && <InviteCard m={m} t={togetherFor(m.id)} user={user} byUid={byUid} today={today} onJoin={() => run(() => joinInvite(user, gid, m.id))} onLeave={() => run(() => leaveInvite(user, gid, m.id))} />}
                    {m.kind === 'card' && <ChatCard card={m.card} />}
                    {m.kind === 'routine' && <RoutineCard user={user} routine={m.routine} />}
                    <Spots user={user} spots={spotsFor(m.id)} byUid={byUid} mine={mine} onSpot={() => run(() => toggleSpot(user, gid, m.id))} onDelete={mine ? () => confirm('Delete this message?') && run(() => deleteMessage(gid, m.id)) : null} />
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {error && <p className="error small">{error}</p>}
      {tool === 'invite' && <InviteForm today={today} onCancel={() => setTool(null)} onSend={(v) => run(async () => { await sendInvite(user, gid, v); setTool(null) })} />}
      {tool === 'routine' && <PickRoutine user={user} onCancel={() => setTool(null)} onPick={(r) => run(async () => { await sendRoutine(user, gid, r); setTool(null) })} />}
      {tool === 'card' && <PostWorkout user={user} gid={gid} onClose={() => setTool(null)} />}

      <div className="composer">
        <div className="chips cheer-chips" role="group" aria-label="Quick cheers">
          {CHEERS.map((c) => <button key={c} type="button" className="chip" onClick={() => run(() => sendCheer(user, gid, c))}>{c}</button>)}
        </div>
        <form className="composer-row" onSubmit={send}>
          <button type="button" className="icon-btn" aria-label="More: train together, share a routine or a workout" aria-expanded={tool === 'menu'} onClick={() => setTool(tool === 'menu' ? null : 'menu')}>+</button>
          <label className="sr-only" htmlFor="chat-input">Message</label>
          <input id="chat-input" className="text-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Say something kind" maxLength={600} autoComplete="off" />
          <button className="btn-primary" disabled={!text.trim()}>Send</button>
        </form>
        {tool === 'menu' && (
          <div className="composer-tools">
            <button type="button" className="btn-ghost" onClick={() => setTool('invite')}>Train together</button>
            <button type="button" className="btn-ghost" onClick={() => setTool('routine')}>Share a routine</button>
            <button type="button" className="btn-ghost" onClick={() => setTool('card')}>Share a workout</button>
          </div>
        )}
      </div>
    </section>
  )
}

function timeOf(m) {
  const d = m.createdAt?.toDate?.()
  return d ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'sending...'
}

function Spots({ user, spots, byUid, mine, onSpot, onDelete }) {
  const me = spots.some((s) => s.uid === user.uid)
  const names = spots.map((s) => (s.uid === user.uid ? 'you' : (byUid[s.uid]?.name || s.name || '').split(' ')[0]))
  return (
    <div className="spots">
      {!mine && <button type="button" className={`spot-btn ${me ? 'on' : ''}`} aria-pressed={me} onClick={onSpot}>{me ? 'Spotted' : 'Spot'}</button>}
      {names.length > 0 && <span className="muted small">Spotted by {names.join(', ')}</span>}
      {onDelete && <button type="button" className="link-btn" onClick={onDelete}>Delete</button>}
    </div>
  )
}

// Train together: day, part of the day, who's in, who showed up.
function InviteCard({ m, t, user, byUid, today, onJoin, onLeave }) {
  const inv = m.invite || {}
  const membersIn = t?.members || [m.uid]
  const done = t?.done || []
  const iIn = membersIn.includes(user.uid)
  const past = inv.day < today
  const together = done.length >= 2
  const nm = (u) => (u === user.uid ? 'You' : (byUid[u]?.name || '').split(' ')[0] || 'A friend')
  return (
    <div className="invite-card">
      <p className="invite-title">Train together</p>
      <p><strong>{inv.part} · {inv.day === today ? 'today' : inv.day === addDays(today, 1) ? 'tomorrow' : prettyDay(inv.day)}</strong></p>
      {inv.note && <p className="chat-text">{inv.note}</p>}
      <ul className="invite-who">
        {membersIn.map((u) => <li key={u} className={done.includes(u) ? 'done' : ''}><span aria-hidden="true">{done.includes(u) ? '✓' : '·'}</span> {nm(u)}{done.includes(u) ? ' showed up' : ''}</li>)}
      </ul>
      {together && <p className="together-line"><span className="boost-pill">+1</span> Trained together. That's a boost for {done.length === 2 ? 'both of you' : 'everyone who came'}.</p>}
      {!past && (iIn
        ? (m.uid !== user.uid && <button type="button" className="btn-ghost" onClick={onLeave}>I can't make it</button>)
        : <button type="button" className="btn-primary" onClick={onJoin}>I'm in</button>)}
      {!past && iIn && !done.includes(user.uid) && <p className="muted small">Check in or log a workout that day and you're ticked off.</p>}
    </div>
  )
}

function InviteForm({ today, onSend, onCancel }) {
  const [day, setDay] = useState(today)
  const [part, setPart] = useState(partOfDay())
  const [note, setNote] = useState('')
  return (
    <form className="card form chat-tool" onSubmit={(e) => { e.preventDefault(); onSend({ day, part, note }) }}>
      <p><strong>Train together</strong> <span className="muted small">Anyone who says I'm in and works out that day gets a shared +1 boost.</span></p>
      <div className="chips" role="group" aria-label="Day">
        {[[today, 'Today'], [addDays(today, 1), 'Tomorrow'], [addDays(today, 2), prettyDay(addDays(today, 2)).split(',')[0]]].map(([d, l]) => (
          <button key={d} type="button" className={`chip ${day === d ? 'on' : ''}`} aria-pressed={day === d} onClick={() => setDay(d)}>{l}</button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Part of the day">
        {PARTS.map((p) => <button key={p} type="button" className={`chip ${part === p ? 'on' : ''}`} aria-pressed={part === p} onClick={() => setPart(p)}>{p}</button>)}
      </div>
      <label>A line for your crew (optional)
        <input className="text-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Leg day at the park gym, 6 pm" maxLength={140} />
      </label>
      <div className="action-row">
        <button className="btn-primary">Send invite</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function PickRoutine({ user, onPick, onCancel }) {
  const routines = useRoutines(user.uid)
  return (
    <div className="card chat-tool">
      <p><strong>Share a routine</strong> <span className="muted small">Your crew can add it to their locker or try it once.</span></p>
      {routines === undefined ? <p className="muted">Loading...</p> : !routines.length ? <p className="muted small">No routines yet. Make one in Training, Routines.</p> : (
        <ul className="member-list">
          {routines.map((r) => (
            <li key={r.id}>
              <span className="grow">{r.name}<br /><span className="muted small">{r.items.length} exercise{r.items.length === 1 ? '' : 's'}{r.curatedByName && r.curatedBy !== user.uid ? ` · curated by ${r.curatedByName}` : ''}</span></span>
              <button type="button" className="btn-primary" onClick={() => onPick(r)}>Share</button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
    </div>
  )
}

// Share one of your recent workouts as a card, straight into this chat.
function PostWorkout({ user, gid, onClose }) {
  const workouts = useWorkouts(user.uid)
  const settings = useSettings(user.uid)
  const [pick, setPick] = useState(null)
  if (workouts === undefined || settings === undefined) return <div className="card chat-tool"><p className="muted">Loading...</p></div>
  const list = [...workouts].map((w) => ({ ...w, createdMs: w.createdAt?.toMillis?.() || 0 })).sort((a, b) => b.date.localeCompare(a.date) || b.createdMs - a.createdMs)
  const u = units(settings?.weightUnit || 'kg', settings?.distanceUnit || 'km')
  if (pick) return <ShareSheet user={user} workout={pick} prs={personalRecords(list).byWorkout[pick.id] || []} u={u} postTo={gid} onClose={onClose} />
  return (
    <div className="card chat-tool">
      <p><strong>Share a workout</strong> <span className="muted small">It shows as a card: minutes, muscles, days in the gullak. Not your weights.</span></p>
      {!list.length ? <p className="muted small">No workouts yet.</p> : (
        <ul className="member-list">
          {list.slice(0, 5).map((w) => (
            <li key={w.id}>
              <span className="grow">{w.title || 'Workout'}<br /><span className="muted small">{prettyDay(w.date)}</span></span>
              <button type="button" className="btn-primary" onClick={() => setPick(w)}>Pick</button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
    </div>
  )
}

/** A share card posted to chat, drawn again on this phone. */
function ChatCard({ card }) {
  const ref = useRef(null)
  const [ready, setReady] = useState(false)
  useEffect(() => { loadCardFonts().then(() => setReady(true)) }, [])
  useEffect(() => { if (ref.current && card) drawCard(ref.current, { ...card, format: 'post', background: 'dark', lines: undefined }) }, [card, ready])
  return <canvas ref={ref} className="chat-card" role="img" aria-label={`${card?.headline || ''} ${card?.subline || ''}. ${(card?.stats || []).map((s) => s.text).join(', ')}`} />
}
