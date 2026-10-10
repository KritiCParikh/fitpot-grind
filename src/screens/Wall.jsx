import { useEffect, useRef, useState } from 'react'
import { useDayDocs } from '../hooks'
import { addDays, prettyDay } from '../lib/dates'
import { tzLabel } from '../lib/clock'
import { photosEnabled, photoUrl, isValidPhoto } from '../lib/photos'
import { photoRequiredFor } from '../lib/group'
import { MAX_PHOTOS, deletePhotoEverywhere } from '../lib/everywhere'
import CameraCapture from '../components/CameraCapture'
import Avatar from '../components/Avatar'
import { useOnline } from '../lib/device'

const ms = (p) => p.createdAt?.toMillis?.() ?? Infinity // pending writes count as newest

// Photo wall: one tile per person per day. Someone with several photos
// (gym in the morning, tennis at night) gets a tile you can swipe through.
export default function Wall({ user, group, members, groupIds }) {
  const { clock } = group
  const today = clock.today() // your own day
  const [day, setDay] = useState(today)
  const [camera, setCamera] = useState(false)
  const photos = useDayDocs(group.id, 'photos', day)
  const todaysCheckins = useDayDocs(group.id, 'checkins', today)
  const byUid = Object.fromEntries(members.map((m) => [m.uid, m]))
  const online = useOnline()

  if (!photosEnabled) {
    return (
      <section>
        <h2>Photo wall</h2>
        <div className="card"><p className="muted">Photos aren't switched on yet. The group organiser needs to deploy the Drive script (docs/BUILD_GUIDE.md, Phase 4).</p></div>
      </section>
    )
  }

  // Group by person: oldest photo first inside a tile, newest tile first.
  const valid = (photos || []).filter((p) => isValidPhoto(p, clock))
  const tiles = Object.values(valid.reduce((acc, p) => { (acc[p.uid] ||= []).push(p); return acc }, {}))
    .map((list) => list.sort((a, b) => ms(a) - ms(b)))
    .sort((a, b) => ms(b[b.length - 1]) - ms(a[a.length - 1]))
  const mine = valid.filter((p) => p.uid === user.uid).length
  const checkedIn = (todaysCheckins || []).some((c) => c.uid === user.uid)
  // If the group requires a photo and you haven't checked in, posting IS your check-in.
  const alsoCheckIn = photoRequiredFor(group) && !checkedIn
  const canPost = day === today && todaysCheckins && online && mine < MAX_PHOTOS && (alsoCheckIn || checkedIn || !photoRequiredFor(group))

  return (
    <section>
      <h2>Photo wall</h2>
      <div className="cal-head">
        <button className="btn-ghost" onClick={() => setDay((d) => addDays(d, -1))} aria-label="Previous day">‹</button>
        <strong>{day === today ? 'Today' : prettyDay(day)}</strong>
        <button className="btn-ghost" onClick={() => setDay((d) => addDays(d, 1))} disabled={day >= today} aria-label="Next day">›</button>
      </div>

      {canPost && (
        <button className="btn-primary wide" onClick={() => setCamera(true)}>
          {alsoCheckIn ? 'Check in with a photo' : mine ? `+ Add another photo (${mine}/${MAX_PHOTOS})` : 'Post today\'s workout photo'}
        </button>
      )}

      {photos === undefined ? <p className="muted">Loading...</p>
        : tiles.length === 0 ? <div className="card"><p className="muted">No photos {day === today ? 'yet today' : 'this day'}.</p></div>
        : (
          <div className="photo-grid">
            {tiles.map((list) => (
              <PhotoTile key={list[0].uid} photos={list} member={byUid[list[0].uid]} user={user} group={group} groupIds={groupIds}
                canDelete={list[0].uid === user.uid && day === today && online}
                keepOne={list[0].uid === user.uid && photoRequiredFor(group) && checkedIn} />
            ))}
          </div>
        )}

      {camera && <CameraCapture user={user} group={group} groupIds={groupIds} checkIn={alsoCheckIn} onClose={() => setCamera(false)} />}
    </section>
  )
}

function PhotoTile({ photos, member, user, group, groupIds, canDelete, keepOne }) {
  const [i, setI] = useState(0)
  const [busy, setBusy] = useState(false)
  const strip = useRef(null)
  const n = photos.length
  const at = Math.min(i, n - 1)
  const photo = photos[at]

  // Keep the dots in step with swiping.
  function onScroll() {
    const el = strip.current
    if (el) setI(Math.round(el.scrollLeft / el.clientWidth))
  }
  function go(k) {
    const el = strip.current
    if (el) el.scrollTo({ left: k * el.clientWidth, behavior: 'smooth' })
    setI(k)
  }
  async function remove() {
    if (keepOne && n === 1) return alert('This photo is your check-in for a group that requires one. Use "Undo check-in" on Today to remove both.')
    if (!confirm('Delete this photo from all your groups? Your check-in stays.')) return
    setBusy(true)
    try { await deletePhotoEverywhere(user, groupIds, photo, group.id); setI(Math.max(0, at - 1)) } finally { setBusy(false) }
  }

  // Shown in the poster's own local time, with their zone if it isn't yours.
  const theirTz = group.clock.tzOn(photo.uid, photo.date)
  const when = photo.createdAt?.toDate()
  const time = when && `${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: theirTz })}${theirTz !== group.clock.myTz() ? ` ${tzLabel(theirTz, when)}` : ''}`

  return (
    <figure className="photo-card">
      <div className="photo-strip" ref={strip} onScroll={onScroll}>
        {photos.map((p) => <PhotoImage key={p.id} photo={p} member={member} user={user} group={group} />)}
      </div>
      {photo.activity && <span className="photo-tag">{photo.activity}</span>}
      {n > 1 && (
        <>
          <span className="photo-count">{at + 1}/{n}</span>
          {at > 0 && <button className="photo-nav prev" onClick={() => go(at - 1)} aria-label="Previous photo">‹</button>}
          {at < n - 1 && <button className="photo-nav next" onClick={() => go(at + 1)} aria-label="Next photo">›</button>}
          <span className="photo-dots" aria-hidden="true">{photos.map((p, k) => <i key={p.id} className={k === at ? 'on' : ''} />)}</span>
        </>
      )}
      {canDelete && <button className="photo-delete" onClick={remove} disabled={busy} aria-label="Delete this photo">✕</button>}
      <figcaption>
        {member && <Avatar member={member} size={24} />}
        <span className="grow">{member?.name || 'Member'}</span>
        <span className="muted small">{time || 'now'}</span>
      </figcaption>
    </figure>
  )
}

function PhotoImage({ photo, member, user, group }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    photoUrl(user, group, photo.fileId).then((u) => alive && setUrl(u)).catch(() => alive && setFailed(true))
    return () => { alive = false }
  }, [user, group, photo.fileId])
  return (
    <div className="photo-slide">
      {url ? <img src={url} alt={`${member?.name || 'Member'}'s workout${photo.activity ? `: ${photo.activity}` : ''}`} loading="lazy" />
        : <div className="photo-placeholder">{failed ? 'Couldn\'t load' : 'Loading...'}</div>}
    </div>
  )
}
