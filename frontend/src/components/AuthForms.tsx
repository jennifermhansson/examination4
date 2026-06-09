import { useState } from 'react'
import { apiCall } from '../api'
import type { Customer } from '../types'

interface Props {
  onLogin: (token: string, user: Customer) => void
}

export default function AuthForms({ onLogin }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const f = new FormData(e.currentTarget)
    try {
      const data = await apiCall<{ token: string; customer: Customer }>(
        'POST',
        '/api/auth/login',
        { email: f.get('email'), password: f.get('password') },
      )
      onLogin(data.token, data.customer)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const f = new FormData(e.currentTarget)
    try {
      await apiCall('POST', '/api/auth/register', {
        username: f.get('username'),
        email: f.get('email'),
        phone: f.get('phone'),
        birthdate: f.get('birthdate'),
        password: f.get('password'),
      })
      const data = await apiCall<{ token: string; customer: Customer }>(
        'POST',
        '/api/auth/login',
        { email: f.get('email'), password: f.get('password') },
      )
      onLogin(data.token, data.customer)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  function switchTab(t: 'login' | 'register') {
    setTab(t)
    setError('')
  }

  return (
    <div className="auth-wrap">
      <h2>Välkommen till BurgerHuset</h2>
      <p>Logga in eller skapa ett konto för att beställa mat.</p>

      <div className="auth-tabs">
        <button
          className={`btn btn-sm ${tab === 'login' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => switchTab('login')}
        >
          Logga in
        </button>
        <button
          className={`btn btn-sm ${tab === 'register' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => switchTab('register')}
        >
          Registrera
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {tab === 'login' ? (
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>E-post</label>
            <input name="email" type="email" required placeholder="din@epost.se" />
          </div>
          <div className="form-group">
            <label>Lösenord</label>
            <input name="password" type="password" required placeholder="••••••••" />
          </div>
          <button type="submit" className="btn btn-primary btn-full">
            Logga in
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label>Användarnamn</label>
            <input name="username" required placeholder="johndoe" />
          </div>
          <div className="form-group">
            <label>E-post</label>
            <input name="email" type="email" required placeholder="din@epost.se" />
          </div>
          <div className="form-group">
            <label>Telefon</label>
            <input name="phone" required placeholder="+46701234567" />
          </div>
          <div className="form-group">
            <label>Födelsedatum</label>
            <input name="birthdate" type="date" required />
          </div>
          <div className="form-group">
            <label>Lösenord</label>
            <input name="password" type="password" required placeholder="••••••••" />
          </div>
          <button type="submit" className="btn btn-primary btn-full">
            Skapa konto
          </button>
        </form>
      )}
    </div>
  )
}
