import { useState } from 'react'
import { formatPrice } from '../../utils'
import { withMeta } from '../../productMeta'
import type { Product } from '../../types'

interface Props {
  product: Product
  onAdd: (product: Product) => void
}

// A single premium product card: 16:9 image with hover-zoom, optional rating
// and prep-time badges, name, description, price and an add-to-cart action.
export default function ProductCard({ product, onAdd }: Props) {
  const { imageUrl, rating, prepTimeMinutes } = withMeta(product)
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-card shadow-card transition-all duration-300 ease-out hover:-translate-y-1 hover:border-brand/40 hover:bg-card-hover hover:shadow-card-hover focus-within:-translate-y-1 focus-within:border-brand/40"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        {imgFailed ? (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/30 via-card to-canvas text-4xl"
          >
            🍔
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={product.name}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        )}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10"
        />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          {typeof rating === 'number' && (
            <span
              className="inline-flex items-center gap-1 rounded-pill bg-black/55 px-2.5 py-1 text-xs font-semibold text-ink backdrop-blur-sm"
              aria-label={`Betyg ${rating} av 5`}
            >
              <span aria-hidden="true" className="text-brand">
                ★
              </span>
              {rating.toFixed(1)}
            </span>
          )}
          {typeof prepTimeMinutes === 'number' && (
            <span
              className="inline-flex items-center gap-1 rounded-pill bg-black/55 px-2.5 py-1 text-xs font-medium text-muted backdrop-blur-sm"
              aria-label={`Tillagningstid cirka ${prepTimeMinutes} minuter`}
            >
              <span aria-hidden="true">⏱</span>
              {prepTimeMinutes} min
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="text-base font-semibold leading-tight text-ink">
          {product.name}
        </h3>
        {product.description && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted">
            {product.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-lg font-bold tracking-tight text-ink">
            {formatPrice(product.price)}
          </span>
          <button
            type="button"
            onClick={() => onAdd(product)}
            aria-label={`Lägg till ${product.name} i beställningen`}
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-black transition-all duration-200 hover:bg-brand-hover hover:shadow-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-95"
          >
            <span aria-hidden="true" className="text-base leading-none">
              +
            </span>
            Lägg till
          </button>
        </div>
      </div>
    </article>
  )
}
