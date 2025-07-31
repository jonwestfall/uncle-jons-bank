import { useState } from 'react'
import LoginPage from './LoginPage'
import './App.css'

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))

  const handleLogin = (tok: string) => {
    setToken(tok)
  }

  const handleLogout = () => {
    setToken(null)
    localStorage.removeItem('token')
  }

  if (!token) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div id="app">
      <h1>Uncle Jon's Bank</h1>
      <p>You are logged in.</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  )
}

export default App
