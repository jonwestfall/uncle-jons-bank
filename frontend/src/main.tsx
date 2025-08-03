import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const media = window.matchMedia('(prefers-color-scheme: dark)')

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
