import { useState, useCallback } from 'react'
import Header from './components/Header'
import CustomerView from './views/CustomerView'
import KitchenView from './views/KitchenView'
import { apiCall } from './api'
import type { AppView, Customer } from './types'

const LS_TOKEN = 'bh_customer_token'
const LS_USER = 'bh_customer_user'
const LS_KITCHEN = 'bh_kitchen_token'

export default function App() {
  const [view, setView] = useState<AppView>('customer')

  const [customerToken, setCustomerToken] = useState<string | null>(() =>
    localStorage.getItem(LS_TOKEN),
  )
  const [customerUser, setCustomerUser] = useState<Customer | null>(() => {
    const raw = localStorage.getItem(LS_USER)
    return raw ? (JSON.parse(raw) as Customer) : null
  })
  const [kitchenToken, setKitchenToken] = useState<string | null>(() =>
    localStorage.getItem(LS_KITCHEN),
  )

  const handleLogin = useCallback((token: string, user: Customer) => {
    setCustomerToken(token)
    setCustomerUser(user)
    localStorage.setItem(LS_TOKEN, token)
    localStorage.setItem(LS_USER, JSON.stringify(user))
  }, [])

  const handleLogout = useCallback(() => {
    setCustomerToken(null)
    setCustomerUser(null)
    localStorage.removeItem(LS_TOKEN)
    localStorage.removeItem(LS_USER)
  }, [])

  const toggleView = useCallback(async () => {
    const next: AppView = view === 'customer' ? 'kitchen' : 'customer'

    if (next === 'kitchen' && !kitchenToken) {
      try {
        const data = await apiCall<{ token: string }>(
          'POST',
          '/api/auth/login',
          { email: 'kitchen@restaurant.se', password: 'kitchen123' },
        )
        setKitchenToken(data.token)
        localStorage.setItem(LS_KITCHEN, data.token)
      } catch {
        alert('Kunde inte ansluta som kökspersonal. Är systemet igång?')
        return
      }
    }

    setView(next)
  }, [view, kitchenToken])

  return (
    <>
      <Header
        view={view}
        customerUser={customerUser}
        onToggleView={toggleView}
        onLogout={handleLogout}
      />
      {view === 'customer' ? (
        <CustomerView
          customerToken={customerToken}
          onLogin={handleLogin}
        />
      ) : (
        <KitchenView kitchenToken={kitchenToken!} />
      )}
    </>
  )
}
