import { useState, type FormEvent } from 'react'

interface SiteSettings {
  site_name: string
  default_interest_rate: number
  default_penalty_interest_rate: number
  default_cd_penalty_rate: number
  service_fee_amount: number
  service_fee_is_percentage: boolean
  overdraft_fee_amount: number
  overdraft_fee_is_percentage: boolean
  overdraft_fee_daily: boolean
  currency_symbol: string
}

interface Props {
  settings: SiteSettings
  token: string
  apiUrl: string
  onClose: () => void
  onSaved: () => void
}

export default function EditSiteSettingsModal({ settings, token, apiUrl, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    site_name: settings.site_name,
    default_interest_rate: (settings.default_interest_rate * 100).toString(),
    default_penalty_interest_rate: (settings.default_penalty_interest_rate * 100).toString(),
    default_cd_penalty_rate: (settings.default_cd_penalty_rate * 100).toString(),
    service_fee_amount: settings.service_fee_amount.toString(),
    service_fee_is_percentage: settings.service_fee_is_percentage,
    overdraft_fee_amount: settings.overdraft_fee_amount.toString(),
    overdraft_fee_is_percentage: settings.overdraft_fee_is_percentage,
    overdraft_fee_daily: settings.overdraft_fee_daily,
    currency_symbol: settings.currency_symbol,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, value, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await fetch(`${apiUrl}/settings/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        site_name: form.site_name,
        default_interest_rate: Number(form.default_interest_rate) / 100,
        default_penalty_interest_rate: Number(form.default_penalty_interest_rate) / 100,
        default_cd_penalty_rate: Number(form.default_cd_penalty_rate) / 100,
        service_fee_amount: Number(form.service_fee_amount),
        service_fee_is_percentage: form.service_fee_is_percentage,
        overdraft_fee_amount: Number(form.overdraft_fee_amount),
        overdraft_fee_is_percentage: form.overdraft_fee_is_percentage,
        overdraft_fee_daily: form.overdraft_fee_daily,
        currency_symbol: form.currency_symbol,
      })
    })
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Edit Site Settings</h3>
        <form onSubmit={handleSubmit} className="form">
          <label>
            Site Name
            <input name="site_name" value={form.site_name} onChange={handleChange} required />
          </label>
          <label>
            Currency Symbol
            <input name="currency_symbol" value={form.currency_symbol} onChange={handleChange} required />
          </label>
          <label>
            Default Interest Rate (%)
            <input name="default_interest_rate" type="number" step="0.01" value={form.default_interest_rate} onChange={handleChange} required />
          </label>
          <label>
            Penalty Interest Rate (%)
            <input name="default_penalty_interest_rate" type="number" step="0.01" value={form.default_penalty_interest_rate} onChange={handleChange} required />
          </label>
          <label>
            CD Penalty Rate (%)
            <input name="default_cd_penalty_rate" type="number" step="0.01" value={form.default_cd_penalty_rate} onChange={handleChange} required />
          </label>
          <label>
            Service Fee Amount
            <input name="service_fee_amount" type="number" step="0.01" value={form.service_fee_amount} onChange={handleChange} required />
          </label>
          <label>
            <input name="service_fee_is_percentage" type="checkbox" checked={form.service_fee_is_percentage} onChange={handleChange} /> Percentage?
          </label>
          <label>
            Overdraft Fee Amount
            <input name="overdraft_fee_amount" type="number" step="0.01" value={form.overdraft_fee_amount} onChange={handleChange} required />
          </label>
          <label>
            <input name="overdraft_fee_is_percentage" type="checkbox" checked={form.overdraft_fee_is_percentage} onChange={handleChange} /> Percentage?
          </label>
          <label>
            <input name="overdraft_fee_daily" type="checkbox" checked={form.overdraft_fee_daily} onChange={handleChange} /> Charge daily?
          </label>
          <div className="modal-actions">
            <button type="submit">Save</button>
            <button type="button" className="ml-1" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
