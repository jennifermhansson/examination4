import { useState, useCallback } from 'react'
import Header from './components/Header'
import CustomerView from './views/CustomerView'
import KitchenView from './views/KitchenView'
import type { AppView } from './types'

// Root component. Switches between the customer ordering UI and the open kitchen
// UI, and holds the customer's id, which is persisted in localStorage so it
// survives reloads. There is no login: the id is set the first time the customer
// places an order and then used to fetch their orders and notifications.
const LS_CUSTOMER_ID = 'bh_customer_id'

export default function App() {
  const [view, setView] = useState<AppView>('customer')

  const [customerId, setCustomerId] = useState<string | null>(() =>
    localStorage.getItem(LS_CUSTOMER_ID),
  )

  const handleCustomerId = useCallback((id: string) => {
    setCustomerId(id)
    localStorage.setItem(LS_CUSTOMER_ID, id)
  }, [])

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
