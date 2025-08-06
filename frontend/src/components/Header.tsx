import { NavLink } from 'react-router-dom'
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
                <li><NavLink to="/child" className={({isActive}) => isActive ? 'active' : undefined}>Ledger</NavLink></li>
                <li><NavLink to="/child/loans" className={({isActive}) => isActive ? 'active' : undefined}>Loans</NavLink></li>
                <li><NavLink to="/child/coupons" className={({isActive}) => isActive ? 'active' : undefined}>Coupons</NavLink></li>
                <li><NavLink to="/child/messages" className={({isActive}) => isActive ? 'active' : undefined}>Messages</NavLink></li>
                <li><NavLink to="/child/profile" className={({isActive}) => isActive ? 'active' : undefined}>Profile</NavLink></li>
              </>
            ) : (
              <>
                <li><NavLink to="/" className={({isActive}) => isActive ? 'active' : undefined}>Dashboard</NavLink></li>
                <li><NavLink to="/parent/loans" className={({isActive}) => isActive ? 'active' : undefined}>Loans</NavLink></li>
                <li><NavLink to="/parent/coupons" className={({isActive}) => isActive ? 'active' : undefined}>Coupons</NavLink></li>
                <li><NavLink to="/messages" className={({isActive}) => isActive ? 'active' : undefined}>Messages</NavLink></li>
                <li><NavLink to="/parent/profile" className={({isActive}) => isActive ? 'active' : undefined}>Profile</NavLink></li>
              </>
            )}
          {isAdmin && <li><NavLink to="/admin" className={({isActive}) => isActive ? 'active' : undefined}>Admin</NavLink></li>}
          <li><button onClick={onToggleTheme}>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</button></li>
          <li><button onClick={onLogout}>Logout</button></li>
        </ul>
      </nav>
    </header>
  )
}
