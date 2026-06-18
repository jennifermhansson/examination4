// The API only returns id/name/description/price. To give the catalog its
// premium look, withMeta enriches each product with a curated image, rating and
// prep time matched by (normalised) product name, with any value the API already
// provides taking precedence. Unrecognised products fall back to a generic photo
// so the UI never looks broken.
import type { Product } from './types'

interface ProductMeta {
  imageUrl: string
  rating: number
  prepTimeMinutes: number
}

const IMG = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`

const META: Record<string, ProductMeta> = {
  cheeseburger: {
    imageUrl: IMG('photo-1568901346375-23c9450c58cd'),
    rating: 4.8,
    prepTimeMinutes: 12,
  },
  hamburger: {
    imageUrl: IMG('photo-1571091718767-18b5b1457add'),
    rating: 4.7,
    prepTimeMinutes: 12,
  },
  fries: {
    imageUrl: IMG('photo-1573080496219-bb080dd4f877'),
    rating: 4.6,
    prepTimeMinutes: 7,
  },
  cola: {
    imageUrl: IMG('photo-1554866585-cd94860890b7'),
    rating: 4.5,
    prepTimeMinutes: 2,
  },
  milkshake: {
    imageUrl: IMG('photo-1572490122747-3968b75cc699'),
    rating: 4.9,
    prepTimeMinutes: 6,
  },
}

const FALLBACK: ProductMeta = {
  imageUrl: IMG('photo-1504674900247-0877df9cc836'),
  rating: 4.5,
  prepTimeMinutes: 10,
}

export function withMeta(product: Product): Required<
  Pick<Product, 'imageUrl' | 'rating' | 'prepTimeMinutes'>
> &
  Product {
  const meta = META[product.name.trim().toLowerCase()] ?? FALLBACK
  return {
    ...product,
    imageUrl: product.imageUrl ?? meta.imageUrl,
    rating: product.rating ?? meta.rating,
    prepTimeMinutes: product.prepTimeMinutes ?? meta.prepTimeMinutes,
  }
}
