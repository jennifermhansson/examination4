import { useState } from 'react'
import { formatPrice } from '../../utils'
import type { CartItem } from '../../types'

interface Props {
  items: CartItem[]
  total: number
  onRemove: (productId: string) => void
  // Places the order with the customer's name + email (find-or-creates them).
  onSubmit: (name: string, email: string) => void
}

// Sticky order summary for the catalog. Dark-themed to match the island and
// carries the name/email form that places the order.
export default function CartPanel({ items, total, onRemove, onSubmit }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const isEmpty = items.length === 0
  const count = items.reduce((sum, i) => sum + i.quantity, 0)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    onSubmit(name.trim(), email.trim())
  }

  return (
    <aside className="rounded-card border border-line bg-card p-5 shadow-card lg:sticky lg:top-20">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Din beställning</h2>
        {count > 0 && (
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-pill bg-brand px-2 text-xs font-bold text-black">
            {count}
          </span>
        )}
      </div>

      {isEmpty ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-10 text-center">
          <span aria-hidden="true" className="text-3xl">
            🛒
          </span>
          <p className="text-sm text-muted">Inga varor valda ännu</p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-line">
          {items.map((i) => (
            <li
              key={i.product.id}
              className="flex items-center gap-3 py-3 text-sm"
            >
              <span className="flex-1 text-ink">
                <span className="font-medium">{i.product.name}</span>
                <span className="text-muted"> × {i.quantity}</span>
              </span>
              <span className="font-semibold text-ink">
                {formatPrice(i.product.price * i.quantity)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(i.product.id)}
                aria-label={`Ta bort ${i.product.name} från beställningen`}
                className="grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:bg-line hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!isEmpty && (
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
          <span className="text-sm text-muted">Totalt</span>
          <span className="text-xl font-bold text-ink">
            {formatPrice(total)}
          </span>
        </div>
      )}

      <form className="mt-5 flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cart-name" className="text-xs font-medium text-muted">
            Namn
          </label>
          <input
            id="cart-name"
            name="name"
            type="text"
            required
            placeholder="Ditt namn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cart-email" className="text-xs font-medium text-muted">
            E-post
          </label>
          <input
            id="cart-email"
            name="email"
            type="email"
            required
            placeholder="din@epost.se"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <button
          type="submit"
          disabled={isEmpty}
          className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-pill bg-brand px-4 py-3 text-sm font-bold text-black transition-all duration-200 hover:bg-brand-hover hover:shadow-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
        >
          Beställ nu
          {!isEmpty && <span aria-hidden="true">· {formatPrice(total)}</span>}
        </button>
      </form>
    </aside>
  )
}
