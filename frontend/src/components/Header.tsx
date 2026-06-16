import type { AppView } from "../types";

interface Props {
  view: AppView;
  onToggleView: () => void;
}

// Top bar with the logo and a button to switch between the customer and kitchen
// views. The old "Hej, <user>" greeting and logout button are gone with auth.
export default function Header({ view, onToggleView }: Props) {
  const isKitchen = view === "kitchen";
  return (
    <header className="header">
      <span className="logo">🍔 Foodie</span>
      <div className="header-right">
        <button
          className={`btn btn-sm ${isKitchen ? "btn-kitchen" : "btn-outline"}`}
          onClick={onToggleView}
        >
          {isKitchen ? "👤 Kundvy" : "👨‍🍳 Köksvy"}
        </button>
      </div>
    </header>
  );
}
