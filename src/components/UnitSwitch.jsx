// Small two-way switch, e.g. kg | lb or km | mi.
export default function UnitSwitch({ label, value, options, onChange }) {
  return (
    <span className="unit-switch" role="group" aria-label={`${label} unit`}>
      {label && <span className="muted small">{label}</span>}
      {options.map((o) => (
        <button key={o} type="button" className={value === o ? 'on' : ''} aria-pressed={value === o} onClick={() => onChange(o)}>{o}</button>
      ))}
    </span>
  )
}
