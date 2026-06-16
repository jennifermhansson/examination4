import { useState } from 'react'
import { apiCall } from '../api'
import type { Customer } from '../types'

interface Props {
  onLogin: (token: string, user: Customer) => void
}

export default function AuthForms({ onLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
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
      const data = await apiCall<{ token: string; customer: Customer }>(
        'POST',
        '/api/auth/register',
        {
          username: f.get('username'),
          email: f.get('email'),
          password: f.get('password'),
        },
      )
      onLogin(data.token, data.customer)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="auth-wrap">
      <h2>Välkommen till BurgerHuset</h2>
      <p>Kund: customer@test.se	customer123
        Kökspersonal: kitchen@restaurant.se	kitchen123	</p>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <button
          className={`btn ${mode === 'login' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setMode('login'); setError('') }}
        >
          Logga in
        </button>
        <button
          className={`btn ${mode === 'register' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setMode('register'); setError('') }}
        >
          Registrera
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {mode === 'login' ? (
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
            <input name="username" type="text" required placeholder="ditt namn" />
          </div>
          <div className="form-group">
            <label>E-post</label>
            <input name="email" type="email" required placeholder="din@epost.se" />
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
