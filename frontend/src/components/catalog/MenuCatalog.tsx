import Hero from './Hero'
import ProductCard from './ProductCard'
import CartPanel from './CartPanel'
import type { Product, CartItem } from '../../types'

interface Props {
  products: Product[]
  cart: CartItem[]
  cartTotal: number
  onAdd: (product: Product) => void
  onRemove: (productId: string) => void
  onPlaceOrder: (name: string, email: string) => void
}

// The redesigned product catalog ("dark island"): a self-contained dark,
// mobile-first surface that sits inside the otherwise light app. Responsive
// grid is 1 col (mobile) / 2 (tablet) / 3 (desktop) with a sticky cart that
// drops below the grid on smaller screens.
export default function MenuCatalog({
  products,
  cart,
  cartTotal,
  onAdd,
  onRemove,
  onPlaceOrder,
}: Props) {
  return (
    <div className="catalog-root rounded-card bg-canvas p-4 font-sans text-ink sm:p-6 lg:p-8">
      <Hero itemCount={products.length} />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="menu-heading">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2
                id="menu-heading"
                className="text-2xl font-bold tracking-tight text-ink"
              >
                Meny
              </h2>
              <p className="mt-1 text-sm text-muted">
                Lagat på beställning – välj dina favoriter
              </p>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-card border border-line bg-card"
                >
                  <div className="aspect-[16/9] animate-pulse bg-line/40" />
                  <div className="space-y-3 p-5">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-line/40" />
                    <div className="h-3 w-full animate-pulse rounded bg-line/30" />
                    <div className="h-8 w-1/3 animate-pulse rounded bg-line/30" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p, i) => (
                <div
                  key={p.id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${Math.min(i * 60, 360)}ms` }}
                >
                  <ProductCard product={p} onAdd={onAdd} />
                </div>
              ))}
            </div>
          )}
        </section>

        <CartPanel
          items={cart}
          total={cartTotal}
          onRemove={onRemove}
          onSubmit={onPlaceOrder}
        />
      </div>
    </div>
  )
}
