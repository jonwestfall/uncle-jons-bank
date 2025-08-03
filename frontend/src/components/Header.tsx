import { Link } from 'react-router-dom'
import './Header.css'

interface Props {
  onLogout: () => void
  isAdmin: boolean
  isChild: boolean
  siteName: string
  onToggleTheme: () => void
  theme: 'light' | 'dark'
}

export default function Header({ onLogout, isAdmin, isChild, siteName, onToggleTheme, theme }: Props) {
  return (
    <header className="header">
      <img src="/unclejon.jpg" alt={`${siteName} Logo`} className="logo" />
      <nav>
        <ul>
          {isChild ? (
              <>
                <li><Link to="/child">Ledger</Link></li>
                <li><Link to="/child/profile">Profile</Link></li>
              </>
            ) : (
              <li><Link to="/">Dashboard</Link></li>
            )}
          {isAdmin && <li><Link to="/admin">Admin</Link></li>}
          <li><button onClick={onToggleTheme}>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</button></li>
          <li><button onClick={onLogout}>Logout</button></li>
        </ul>
      </nav>
    </header>
  )
}
