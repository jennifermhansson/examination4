import { useState, useEffect, useCallback } from 'react'
import MenuCatalog from '../components/catalog/MenuCatalog'
import StatusBadge from '../components/StatusBadge'
import { apiCall } from '../api'
import { formatPrice, formatDate } from '../utils'
import type { CustomerTab, Product, CartItem, Order, Notification } from '../types'

interface Props {
  // The current customer's id (null until they place their first order).
  customerId: string | null
  // Called with the new customer id returned after placing an order.
  onCustomerId: (id: string) => void
}

export default function CustomerView({ customerId, onCustomerId }: Props) {
  const [tab, setTab] = useState<CustomerTab>('menu')
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [error, setError] = useState('')

  // Load the menu (public endpoint, no customer needed).
  const loadProducts = useCallback(async () => {
    const data = await apiCall<{ products: Product[] }>('GET', '/api/products')
    setProducts(data.products)
  }, [])

  // Load this customer's orders, identified by customerId in the query string.
  const loadOrders = useCallback(async () => {
    if (!customerId) return
    const data = await apiCall<{ orders: Order[] }>(
      'GET',
      `/api/orders?customerId=${customerId}`,
    )
    setOrders(data.orders)
  }, [customerId])

  // Load this customer's notifications, identified by customerId in the query string.
  const loadNotifications = useCallback(async () => {
    if (!customerId) return
    const data = await apiCall<{ notifications: Notification[] }>(
      'GET',
      `/api/notifications?customerId=${customerId}`,
    )
    setNotifications(data.notifications)
  }, [customerId])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  // Once we know the customer, poll their orders + notifications every 5 seconds.
  useEffect(() => {
    if (!customerId) return
    loadOrders()
    loadNotifications()
    const id = setInterval(() => {
      loadOrders()
      loadNotifications()
    }, 5000)
    return () => clearInterval(id)
  }, [customerId, loadOrders, loadNotifications])

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId))
  }

  // Place the order: send the customer's name + email together with the cart.
  // The backend find-or-creates the customer (by email) and returns its id,
  // which we store so the customer can then see their orders and notifications.
  async function placeOrder(name: string, email: string) {
    if (!cart.length) return
    if (!name || !email) {
      setError('Fyll i namn och e-post.')
      return
    }
    setError('')
    try {
      const data = await apiCall<{ customerId: string }>('POST', '/api/orders', {
        name,
        email,
        items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
      })
      onCustomerId(data.customerId)
      setCart([])
      setTab('orders')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0)
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="container">
      <div className="tabs">
        <button
          className={`tab ${tab === 'menu' ? 'active' : ''}`}
          onClick={() => setTab('menu')}
        >
          🍔 Meny
        </button>
        <button
          className={`tab ${tab === 'orders' ? 'active' : ''}`}
          onClick={() => setTab('orders')}
        >
          📋 Mina beställningar
        </button>
        <button
          className={`tab ${tab === 'notifications' ? 'active' : ''}`}
          onClick={() => setTab('notifications')}
        >
          🔔 Notiser
          {unreadCount > 0 && <span className="tab-badge">{unreadCount}</span>}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {tab === 'menu' && (
        <MenuCatalog
          products={products}
          cart={cart}
          cartTotal={cartTotal}
          onAdd={addToCart}
          onRemove={removeFromCart}
          onPlaceOrder={placeOrder}
        />
      )}

      {tab === 'orders' && (
        <div className="orders-list">
          {!customerId ? (
            <p className="empty">Lägg en beställning för att se dina beställningar.</p>
          ) : orders.length === 0 ? (
            <p className="empty">Inga beställningar än. Gå till menyn och beställ!</p>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="order-card">
                <div className="order-head">
                  <span className="order-id">#{o.id.slice(0, 8)}</span>
                  <StatusBadge status={o.status} />
                </div>
                <div className="order-price">{formatPrice(o.total_price)}</div>
                <div className="order-meta">{formatDate(o.created_at)}</div>
                {o.status === 'ready' && (
                  <div className="order-ready">🎉 Din mat är klar! Gå och hämta den.</div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'notifications' && (
        <div className="notif-list">
          {!customerId ? (
            <p className="empty">Lägg en beställning för att se dina notiser.</p>
          ) : notifications.length === 0 ? (
            <p className="empty">Inga notiser ännu.</p>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className={`notif-card ${n.read ? '' : 'unread'}`}>
                <div className="notif-msg">{n.message}</div>
                <div className="notif-time">{formatDate(n.created_at)}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
