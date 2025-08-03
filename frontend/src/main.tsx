// Entry point that mounts the React application and handles theme init.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Detect system color scheme preference and keep UI in sync.
const media = window.matchMedia('(prefers-color-scheme: dark)')

// Toggle the appropriate CSS class to apply the chosen theme.
const applyTheme = (theme: 'light' | 'dark') => {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
if (storedTheme) {
  applyTheme(storedTheme)
} else {
  applyTheme(media.matches ? 'dark' : 'light')
}

media.addEventListener('change', e => {
  const override = localStorage.getItem('theme')
  if (override) return
  applyTheme(e.matches ? 'dark' : 'light')
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
