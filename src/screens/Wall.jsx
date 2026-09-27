import { useEffect, useState } from 'react'
import { useDayDocs } from '../hooks'
import { todayInTz, addDays, prettyDay } from '../lib/dates'
import { photosEnabled, photoUrl, isValidPhoto } from '../lib/photos'
import CameraCapture from '../components/CameraCapture'
import Avatar from '../components/Avatar'

export default function Wall({ user, group, members }) {
  const tz = group.timezone
  const today = todayInTz(tz)
  const [day, setDay] = useState(today)
  const [camera, setCamera] = useState(false)
  const photos = useDayDocs(group.id, 'photos', day)
  const byUid = Object.fromEntries(members.map((m) => [m.uid, m]))

  if (!photosEnabled) {
    return (
      <section>
        <h2>Photo wall</h2>
        <div className="card"><p className="muted">Photos aren't switched on yet. The group organiser needs to deploy the Drive script (docs/BUILD_GUIDE.md, Phase 4).</p></div>
      </section>
    )
  }

  const list = (photos || [])
    .filter((p) => isValidPhoto(p, tz))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? Infinity) - (a.createdAt?.toMillis?.() ?? Infinity))
  const posted = list.some((p) => p.uid === user.uid)

  return (
    <section>
      <h2>Photo wall</h2>
      <div className="cal-head">
        <button className="btn-ghost" onClick={() => setDay((d) => addDays(d, -1))} aria-label="Previous day">‹</button>
        <strong>{day === today ? 'Today' : prettyDay(day)}</strong>
        <button className="btn-ghost" onClick={() => setDay((d) => addDays(d, 1))} disabled={day >= today} aria-label="Next day">›</button>
      </div>

      {day === today && !posted && (
        <button className="btn-primary wide" onClick={() => setCamera(true)}>📸 Post today's workout photo</button>
      )}

      {photos === undefined ? <p className="muted">Loading…</p>
        : list.length === 0 ? <div className="card"><p className="muted">No photos {day === today ? 'yet today' : 'this day'}.</p></div>
        : (
          <div className="photo-grid">
            {list.map((p) => <PhotoCard key={p.id} photo={p} member={byUid[p.uid]} user={user} group={group} />)}
          </div>
        )}

      {camera && <CameraCapture user={user} group={group} onClose={() => setCamera(false)} />}
    </section>
  )
}

function PhotoCard({ photo, member, user, group }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    photoUrl(user, group, photo.fileId).then((u) => alive && setUrl(u)).catch(() => alive && setFailed(true))
    return () => { alive = false }
  }, [user, group, photo.fileId])

  const time = photo.createdAt?.toDate().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: group.timezone })
  return (
    <figure className="photo-card">
      {url ? <img src={url} alt={`${member?.name || 'Member'}'s workout`} loading="lazy" />
        : <div className="photo-placeholder">{failed ? 'Couldn\'t load' : 'Loading…'}</div>}
      <figcaption>
        {member && <Avatar member={member} size={24} />}
        <span className="grow">{member?.name || 'Member'}</span>
        <span className="muted small">{time || 'now'}</span>
      </figcaption>
    </figure>
  )
}
