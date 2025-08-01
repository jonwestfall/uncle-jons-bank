import { Link } from 'react-router-dom'
import './Header.css'

interface Props {
  onLogout: () => void
  isAdmin: boolean
  isChild: boolean
}

export default function Header({ onLogout, isAdmin, isChild }: Props) {
  return (
    <header className="header">
      <img src="/unclejon.jpg" alt="Uncle Jon's Bank Logo" className="logo" />
      <nav>
        <ul>
          {isChild ? (
            <li><Link to="/child">Ledger</Link></li>
          ) : (
            <li><Link to="/">Dashboard</Link></li>
          )}
          {isAdmin && <li><Link to="/admin">Admin</Link></li>}
          <li><button onClick={onLogout}>Logout</button></li>
        </ul>
      </nav>
    </header>
  )
}
