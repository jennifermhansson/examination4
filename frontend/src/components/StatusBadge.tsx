// Renders an order status as a coloured Swedish-labelled badge (shared by the
// customer and kitchen views); unknown statuses fall back to the raw value.
import type { OrderStatus } from '../types'

const LABELS: Record<OrderStatus, string> = {
  pending: 'Väntande',
  preparing: 'Tillagas',
  ready: 'Klar!',
  completed: 'Hämtad',
}

export default function StatusBadge({ status }: { status: string }) {
  const label = LABELS[status as OrderStatus] ?? status
  return <span className={`badge badge-${status}`}>{label}</span>
}
