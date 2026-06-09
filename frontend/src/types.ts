export interface Product {
  id: string
  name: string
  description?: string
  price: number
}

export interface CartItem {
  product: Product
  quantity: number
}

export interface Order {
  id: string
  customer_id: string
  status: OrderStatus
  total_price: number
  created_at: string
}

export interface KitchenOrderItem {
  productId: string
  name: string
  quantity: number
  unitPrice: number
}

export interface KitchenOrder {
  id: string
  customer_id: string
  status: OrderStatus
  total_price: number
  items: KitchenOrderItem[]
  created_at: string
}

export interface Notification {
  id: string
  customer_id: string
  order_id?: string
  message: string
  read: boolean
  created_at: string
}

export interface Customer {
  id: string
  username: string
  email: string
  role: string
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed'
export type AppView = 'customer' | 'kitchen'
export type CustomerTab = 'menu' | 'orders' | 'notifications'
