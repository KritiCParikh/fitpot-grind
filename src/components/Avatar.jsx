export default function Avatar({ member, size = 36 }) {
  const initials = (member.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  return member.photoURL ? (
    <img className="avatar" src={member.photoURL} alt="" width={size} height={size} referrerPolicy="no-referrer" />
  ) : (
    <span className="avatar avatar-fallback" style={{ width: size, height: size }}>{initials}</span>
  )
}
