import { useState, useCallback } from 'react'
import Header from './components/Header'
import CustomerView from './views/CustomerView'
import KitchenView from './views/KitchenView'
import type { AppView } from './types'

// Persists the customer's id between page reloads. It is set the first time the
// customer places an order and is used (instead of a login session) to fetch
// that customer's orders and notifications.
const LS_CUSTOMER_ID = 'bh_customer_id'

export default function App() {
  // Which view is shown: the customer ordering UI or the open kitchen UI.
  const [view, setView] = useState<AppView>('customer')

  const [customerId, setCustomerId] = useState<string | null>(() =>
    localStorage.getItem(LS_CUSTOMER_ID),
  )

  // Called after a successful order: remember the customer's id.
  const handleCustomerId = useCallback((id: string) => {
    setCustomerId(id)
    localStorage.setItem(LS_CUSTOMER_ID, id)
  }, [])

  // Toggle between the customer and kitchen views. The kitchen view no longer
  // requires logging in as staff.
  const toggleView = useCallback(() => {
    setView((current) => (current === 'customer' ? 'kitchen' : 'customer'))
  }, [])

  return (
    <>
      <Header view={view} onToggleView={toggleView} />
      {view === 'customer' ? (
        <CustomerView customerId={customerId} onCustomerId={handleCustomerId} />
      ) : (
        <KitchenView />
      )}
    </>
  )
}
