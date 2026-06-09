import { useState, useEffect, useCallback } from 'react'
import AuthForms from '../components/AuthForms'
import StatusBadge from '../components/StatusBadge'
import { apiCall } from '../api'
import { formatPrice, formatDate } from '../utils'
import type { Customer, CustomerTab, Product, CartItem, Order, Notification } from '../types'

interface Props {
  customerToken: string | null
  onLogin: (token: string, user: Customer) => void
}

export default function CustomerView({ customerToken, onLogin }: Props) {
  const [tab, setTab] = useState<CustomerTab>('menu')
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [error, setError] = useState('')

  const loadProducts = useCallback(async () => {
    const data = await apiCall<{ products: Product[] }>('GET', '/api/products')
    setProducts(data.products)
  }, [])

  const loadOrders = useCallback(async () => {
    if (!customerToken) return
    const data = await apiCall<{ orders: Order[] }>('GET', '/api/orders', undefined, customerToken)
    setOrders(data.orders)
  }, [customerToken])

  const loadNotifications = useCallback(async () => {
    if (!customerToken) return
    const data = await apiCall<{ notifications: Notification[] }>(
      'GET',
      '/api/notifications',
      undefined,
      customerToken,
    )
    setNotifications(data.notifications)
  }, [customerToken])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    if (!customerToken) return
    loadOrders()
    loadNotifications()
    const id = setInterval(() => {
      loadOrders()
      loadNotifications()
    }, 5000)
    return () => clearInterval(id)
  }, [customerToken, loadOrders, loadNotifications])

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

  async function placeOrder() {
    if (!cart.length || !customerToken) return
    setError('')
    try {
      await apiCall(
        'POST',
        '/api/orders',
        { items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })) },
        customerToken,
      )
      setCart([])
      await loadOrders()
      setTab('orders')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (!customerToken) {
    return (
      <div className="container">
        <AuthForms onLogin={onLogin} />
      </div>
    )
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
        <div className="menu-layout">
          <div className="menu-grid">
            {products.map((p) => (
              <div key={p.id} className="product-card">
                <div className="product-name">{p.name}</div>
                <div className="product-desc">{p.description}</div>
                <div className="product-footer">
                  <span className="price">{formatPrice(p.price)}</span>
                  <button className="btn btn-primary btn-sm" onClick={() => addToCart(p)}>
                    + Lägg till
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="cart">
            <h3>Din beställning</h3>
            {cart.length === 0 ? (
              <p className="cart-empty">Inga varor valda ännu</p>
            ) : (
              <>
                {cart.map((i) => (
                  <div key={i.product.id} className="cart-item">
                    <span className="cart-item-name">
                      {i.product.name} × {i.quantity}
                    </span>
                    <span className="price">{formatPrice(i.product.price * i.quantity)}</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeFromCart(i.product.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="cart-total">Totalt: {formatPrice(cartTotal)}</div>
                <button className="btn btn-primary btn-full" onClick={placeOrder}>
                  Beställ nu
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div className="orders-list">
          {orders.length === 0 ? (
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
          {notifications.length === 0 ? (
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
