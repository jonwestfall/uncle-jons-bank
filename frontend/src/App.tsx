// Root React component responsible for routing and global state.
// It handles authentication, theme switching and basic layout.
import { useState, useEffect, useCallback } from 'react'
import { lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header'
import './App.css'
import { ToastProvider } from './components/ToastProvider'
import RouteBoundary from './components/RouteBoundary'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ParentDashboard = lazy(() => import('./pages/ParentDashboard'))
const ParentProfile = lazy(() => import('./pages/ParentProfile'))
const ChildDashboard = lazy(() => import('./pages/ChildDashboard'))
const ChildProfile = lazy(() => import('./pages/ChildProfile'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))
const ChildLoans = lazy(() => import('./pages/ChildLoans'))
const ParentLoans = lazy(() => import('./pages/ParentLoans'))
const ParentCoupons = lazy(() => import('./pages/ParentCoupons'))
const ChildCoupons = lazy(() => import('./pages/ChildCoupons'))
const AdminCoupons = lazy(() => import('./pages/AdminCoupons'))
const MessagesPage = lazy(() => import('./pages/Messages'))
const ChildBank101 = lazy(() => import('./pages/ChildBank101'))
const ParentChores = lazy(() => import('./pages/ParentChores'))
const ChildChores = lazy(() => import('./pages/ChildChores'))

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
  const [registrationDisabled, setRegistrationDisabled] = useState(false)
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
      const params = new URLSearchParams(window.location.search)
      const codeParam = params.get('code')
      if (codeParam) {
        window.location.replace(`/child/coupons?code=${codeParam}`)
        return
      }
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
      setRegistrationDisabled(data.public_registration_disabled || false)
      document.title = data.site_name
    }
  }, [apiUrl])

  useEffect(() => {
    fetchMe()
    fetchSettings()
  }, [fetchMe, fetchSettings])

  if (!token) {
    return (
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <RouteBoundary>
                <LoginPage onLogin={handleLogin} siteName={siteName} allowRegister={!registrationDisabled} />
              </RouteBoundary>
            }
          />
          {!registrationDisabled && (
            <Route
              path="/register"
              element={
                <RouteBoundary>
                  <RegisterPage apiUrl={apiUrl} siteName={siteName} />
                </RouteBoundary>
              }
            />
          )}
          <Route path="*" element={<Navigate to={`/login${window.location.search}`} replace />} />
        </Routes>
      </BrowserRouter>
    )
  }

  return (
    <ToastProvider>
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
                element={
                  <RouteBoundary>
                    <ChildDashboard token={token} childId={childId} apiUrl={apiUrl} onLogout={handleLogout} currencySymbol={currencySymbol} />
                  </RouteBoundary>
                }
              />
              <Route
                path="/child/loans"
                element={
                  <RouteBoundary>
                    <ChildLoans token={token} childId={childId} apiUrl={apiUrl} currencySymbol={currencySymbol} />
                  </RouteBoundary>
                }
              />
              <Route
                path="/child/chores"
                element={
                  <RouteBoundary>
                    <ChildChores token={token} apiUrl={apiUrl} currencySymbol={currencySymbol} />
                  </RouteBoundary>
                }
              />
              <Route
                path="/child/coupons"
                element={
                  <RouteBoundary>
                    <ChildCoupons token={token} apiUrl={apiUrl} currencySymbol={currencySymbol} />
                  </RouteBoundary>
                }
              />
              <Route
                path="/child/bank101"
                element={
                  <RouteBoundary>
                    <ChildBank101 token={token} apiUrl={apiUrl} />
                  </RouteBoundary>
                }
              />
              <Route
                path="/child/messages"
                element={
                  <RouteBoundary>
                    <MessagesPage token={token} apiUrl={apiUrl} isChild={true} isAdmin={false} />
                  </RouteBoundary>
                }
              />
              <Route
                path="/child/profile"
                element={
                  <RouteBoundary>
                    <ChildProfile token={token} apiUrl={apiUrl} currencySymbol={currencySymbol} />
                  </RouteBoundary>
                }
              />
            </>
          )}
        {!isChildAccount && (
          <>
            <Route
              path="/"
              element={
                <RouteBoundary>
                  <ParentDashboard token={token} apiUrl={apiUrl} permissions={permissions} onLogout={handleLogout} currencySymbol={currencySymbol} />
                </RouteBoundary>
              }
            />
            <Route
              path="/parent/chores"
              element={
                <RouteBoundary>
                  <ParentChores token={token} apiUrl={apiUrl} currencySymbol={currencySymbol} />
                </RouteBoundary>
              }
            />
            <Route
              path="/parent/loans"
              element={
                <RouteBoundary>
                  <ParentLoans token={token} apiUrl={apiUrl} currencySymbol={currencySymbol} />
                </RouteBoundary>
              }
            />
            <Route
              path="/parent/coupons"
              element={
                <RouteBoundary>
                  <ParentCoupons token={token} apiUrl={apiUrl} isAdmin={isAdmin} currencySymbol={currencySymbol} />
                </RouteBoundary>
              }
            />
            <Route
              path="/messages"
              element={
                <RouteBoundary>
                  <MessagesPage token={token} apiUrl={apiUrl} isChild={false} isAdmin={isAdmin} />
                </RouteBoundary>
              }
            />
            <Route
              path="/parent/profile"
              element={
                <RouteBoundary>
                  <ParentProfile token={token} apiUrl={apiUrl} />
                </RouteBoundary>
              }
            />
          </>
        )}
        {isAdmin && (
          <>
            <Route
              path="/admin"
              element={
                <RouteBoundary>
                  <AdminPanel token={token} apiUrl={apiUrl} onLogout={handleLogout} siteName={siteName} currencySymbol={currencySymbol} onSettingsChange={fetchSettings} />
                </RouteBoundary>
              }
            />
            <Route
              path="/admin/coupons"
              element={
                <RouteBoundary>
                  <AdminCoupons token={token} apiUrl={apiUrl} currencySymbol={currencySymbol} />
                </RouteBoundary>
              }
            />
          </>
        )}
        <Route path="*" element={<Navigate to={isChildAccount ? '/child' : '/'} replace />} />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  )
}

export default App
