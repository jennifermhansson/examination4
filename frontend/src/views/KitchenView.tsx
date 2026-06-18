import { useState, useEffect, useCallback } from 'react'
import StatusBadge from '../components/StatusBadge'
import { apiCall } from '../api'
import { formatPrice, formatDate } from '../utils'
import type { KitchenOrder, OrderStatus } from '../types'

// Kitchen screen (no auth): polls the open kitchen endpoints every 5 seconds and
// lets staff advance each active ticket one step. NEXT_STATUS/NEXT_LABEL map a
// ticket's current status to the next status and the action button's label.
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'completed',
}

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: 'Start tillagning',
  preparing: 'Markera klar',
  ready: 'Markera levererad',
}

export default function KitchenView() {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await apiCall<{ orders: KitchenOrder[] }>(
        'GET',
        '/kitchen/orders',
      )
      setOrders(data.orders)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [load])

  async function updateStatus(orderId: string, status: OrderStatus) {
    try {
      await apiCall('PATCH', `/kitchen/orders/${orderId}`, { status })
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="container">
      <div className="kitchen-header">
        <h2>Köksvyn</h2>
        <span className="count-badge">{orders.length} aktiva</span>
        <span className="auto-refresh">Uppdateras var 5:e sekund</span>
      </div>

      {error && <div className="error">{error}</div>}

      {orders.length === 0 ? (
        <p className="empty">Inga aktiva ordrar. Vilsamt! ☕</p>
      ) : (
        <div className="kitchen-grid">
          {orders.map((o) => {
            const nextStatus = NEXT_STATUS[o.status]
            const nextLabel = NEXT_LABEL[o.status]
            return (
              <div key={o.id} className={`kitchen-card status-${o.status}`}>
                <div className="kitchen-card-head">
                  <span className="order-id">#{o.id.slice(0, 8)}</span>
                  <StatusBadge status={o.status} />
                </div>
                <ul className="kitchen-items">
                  {o.items.map((item, idx) => (
                    <li key={idx}>
                      {item.name} × {item.quantity}
                    </li>
                  ))}
                </ul>
                <div className="kitchen-total">{formatPrice(o.total_price)}</div>
                <div className="kitchen-time">{formatDate(o.created_at)}</div>
                {nextStatus && nextLabel && (
                  <button
                    className="btn btn-primary btn-full"
                    onClick={() => updateStatus(o.id, nextStatus)}
                  >
                    {nextLabel}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
