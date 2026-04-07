import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import Header from '../Header'

describe('Header', () => {
  it('renders child navigation links when child account is active', () => {
    render(
      <MemoryRouter>
        <Header
          onLogout={vi.fn()}
          isAdmin={false}
          isChild={true}
          siteName="Uncle Jon's Bank"
          onToggleTheme={vi.fn()}
          theme="dark"
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Ledger' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Bank 101' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
  })

  it('renders parent/admin links when admin parent account is active', () => {
    render(
      <MemoryRouter>
        <Header
          onLogout={vi.fn()}
          isAdmin={true}
          isChild={false}
          siteName="Uncle Jon's Bank"
          onToggleTheme={vi.fn()}
          theme="light"
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Admin Coupons' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
  })
})
