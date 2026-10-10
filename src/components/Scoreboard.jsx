import { useState } from 'react'

// Stadium-style scoreboard at the top of Wall and Board: the key numbers in
// big lit digits. Tap or pull the handle to unroll more detail.
export default function Scoreboard({ title, right, cells, children }) {
  const [open, setOpen] = useState(false)
  const [startY, setStartY] = useState(null)
  return (
    <div className={`scoreboard ${open ? 'open' : ''}`}
      onTouchStart={(e) => setStartY(e.touches[0].clientY)}
      onTouchEnd={(e) => {
        if (startY == null) return
        const dy = e.changedTouches[0].clientY - startY
        if (dy > 30) setOpen(true)
        if (dy < -30) setOpen(false)
        setStartY(null)
      }}>
      <div className="sb-top"><span>{title}</span><span>{right}</span></div>
      <div className="sb-cells">
        {cells.map((c) => (
          <div key={c.label} className={`sb-cell ${c.tone || ''}`}>
            <b>{c.value}</b>
            <span>{c.label}</span>
          </div>
        ))}
      </div>
      {children && (
        <>
          {open && <div className="sb-more">{children}</div>}
          <button className="sb-handle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? 'Show less' : 'Show more'}>
            <i />
          </button>
        </>
      )}
    </div>
  )
}
