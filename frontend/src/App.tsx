import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import ParentDashboard from './pages/ParentDashboard'
import ChildDashboard from './pages/ChildDashboard'
import AdminPanel from './pages/AdminPanel'
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
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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

  const handleLogout = () => {
    setToken(null)
    setIsChildAccount(false)
    setChildId(null)
    localStorage.removeItem('token')
    localStorage.removeItem('isChild')
    localStorage.removeItem('childId')
  }

  const fetchMe = useCallback(async () => {
    if (!token) return
    const resp = await fetch(`${apiUrl}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) {
      const data = await resp.json()
      setIsAdmin(data.role === 'admin')
    }
  }, [token, apiUrl])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  if (!token) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <BrowserRouter>
      <Header onLogout={handleLogout} isAdmin={isAdmin} isChild={isChildAccount} />
      <Routes>
        {isChildAccount && childId !== null && (
          <Route path="/child" element={<ChildDashboard token={token} childId={childId} apiUrl={apiUrl} onLogout={handleLogout} />} />
        )}
        {!isChildAccount && (
          <Route path="/" element={<ParentDashboard token={token} apiUrl={apiUrl} onLogout={handleLogout} />} />
        )}
        {isAdmin && <Route path="/admin" element={<AdminPanel token={token} apiUrl={apiUrl} onLogout={handleLogout} />} />}
        <Route path="*" element={<Navigate to={isChildAccount ? '/child' : '/'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
