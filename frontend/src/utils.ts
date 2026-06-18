// Small formatting helpers: price (minor units -> "<kr>") and ISO date -> sv-SE.
export function formatPrice(cents: number): string {
  return `${Math.round(cents / 100)} kr`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE')
}
