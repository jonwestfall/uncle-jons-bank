// Root React component responsible for routing and global state.
// It handles authentication, theme switching and basic layout.
import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import ParentDashboard from './pages/ParentDashboard'
import ParentProfile from './pages/ParentProfile'
import ChildDashboard from './pages/ChildDashboard'
import ChildProfile from './pages/ChildProfile'
import AdminPanel from './pages/AdminPanel'
import ChildLoans from './pages/ChildLoans'
import ParentLoans from './pages/ParentLoans'
import Header from './components/Header'
import './App.css'

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [isChildAccount, setIsChildAccount] = useState<boolean>(() => localStorage.getItem('isChild') === 'true')
  const [childId, setChildId] = useState<number | null>(() => {
    const stored = localStorage.getItem('childId')
    return stored ? Number(stored) : null
  })
  const [isAdmin, setIsAdmin] = useState(false)
  const [permissions, setPermissions] = useState<string[]>([])
  const [siteName, setSiteName] = useState("Uncle Jon's Bank")
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  // Store authentication token and account type when a user logs in.
  const handleLogin = (tok: string, child: boolean) => {
    setToken(tok)
    setIsChildAccount(child)
    localStorage.setItem('token', tok)
    localStorage.setItem('isChild', String(child))
    if (child) {
      const payload = JSON.parse(atob(tok.split('.')[1]))
      const cid = parseInt(payload.sub.split(':')[1])
      setChildId(cid)
      localStorage.setItem('childId', String(cid))
    } else {
      setChildId(null)
    }
  }

  // Clear authentication information and any cached role data when logging out.
  const handleLogout = () => {
    setToken(null)
    setIsChildAccount(false)
    setChildId(null)
    setIsAdmin(false)
    setPermissions([])
    localStorage.removeItem('token')
    localStorage.removeItem('isChild')
    localStorage.removeItem('childId')
  }

  // Simple light/dark theme toggle stored in localStorage.
  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('theme', next)
    if (next === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // Load user metadata such as permissions after login.
  const fetchMe = useCallback(async () => {
    if (!token) return
    const resp = await fetch(`${apiUrl}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) {
      const data = await resp.json()
      setIsAdmin(data.role === 'admin')
      setPermissions(data.permissions || [])
    }
  }, [token, apiUrl])

  // Retrieve site-wide settings like bank name and currency symbol.
  const fetchSettings = useCallback(async () => {
    const resp = await fetch(`${apiUrl}/settings/`)
    if (resp.ok) {
      const data = await resp.json()
      setSiteName(data.site_name)
      setCurrencySymbol(data.currency_symbol || '$')
      document.title = data.site_name
    }
  }, [apiUrl])

  useEffect(() => {
    fetchMe()
    fetchSettings()
  }, [fetchMe, fetchSettings])

  if (!token) {
    return <LoginPage onLogin={handleLogin} siteName={siteName} />
  }

  return (
    <BrowserRouter>
      <Header
        onLogout={handleLogout}
        isAdmin={isAdmin}
        isChild={isChildAccount}
        siteName={siteName}
        onToggleTheme={toggleTheme}
        theme={theme}
      />
      <Routes>
          {isChildAccount && childId !== null && (
            <>
              <Route
                path="/child"
                element={<ChildDashboard token={token} childId={childId} apiUrl={apiUrl} onLogout={handleLogout} currencySymbol={currencySymbol} />}
              />
              <Route
                path="/child/loans"
                element={<ChildLoans token={token} childId={childId} apiUrl={apiUrl} currencySymbol={currencySymbol} />}
              />
              <Route
                path="/child/profile"
                element={<ChildProfile token={token} apiUrl={apiUrl} currencySymbol={currencySymbol} />}
              />
            </>
          )}
        {!isChildAccount && (
          <>
            <Route
              path="/"
              element={<ParentDashboard token={token} apiUrl={apiUrl} permissions={permissions} onLogout={handleLogout} currencySymbol={currencySymbol} />}
            />
            <Route
              path="/parent/loans"
              element={<ParentLoans token={token} apiUrl={apiUrl} currencySymbol={currencySymbol} />}
            />
            <Route
              path="/parent/profile"
              element={<ParentProfile token={token} apiUrl={apiUrl} />}
            />
          </>
        )}
        {isAdmin && (
          <Route
            path="/admin"
            element={<AdminPanel token={token} apiUrl={apiUrl} onLogout={handleLogout} siteName={siteName} currencySymbol={currencySymbol} onSettingsChange={fetchSettings} />}
          />
        )}
        <Route path="*" element={<Navigate to={isChildAccount ? '/child' : '/'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
