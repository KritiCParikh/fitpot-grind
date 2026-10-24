import { Link } from 'react-router-dom'
import Icon from "../nav/Icon";

export default function Tile({ to, label, icon, live }) {
  return (
    <Link to={to} className="tile">
      <Icon name={icon} size={24} />
      <h4>{label}</h4>
      {live && <p className="live-line">{live}</p>}
    </Link>
  )
}
