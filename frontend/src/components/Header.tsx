import type { AppView, Customer } from '../types'

interface Props {
  view: AppView
  customerUser: Customer | null
  onToggleView: () => void
  onLogout: () => void
}

export default function Header({ view, customerUser, onToggleView, onLogout }: Props) {
  const isKitchen = view === 'kitchen'
  return (
    <header className="header">
      <span className="logo">🍔 BurgerHuset</span>
      <div className="header-right">
        {!isKitchen && customerUser && (
          <>
            <span className="user-tag">Hej, {customerUser.username}!</span>
            <button className="btn btn-ghost btn-sm" onClick={onLogout}>
              Logga ut
            </button>
          </>
        )}
        <button
          className={`btn btn-sm ${isKitchen ? 'btn-kitchen' : 'btn-outline'}`}
          onClick={onToggleView}
        >
          {isKitchen ? '👤 Kundvy' : '👨‍🍳 Köksvy'}
        </button>
      </div>
    </header>
  )
}
