interface Props {
  // Number of items on the menu, shown as a small live stat in the hero.
  itemCount: number
}

// Full-bleed hero at the top of the catalog. Sets the premium, app-like tone
// before the product grid.
export default function Hero({ itemCount }: Props) {
  return (
    <section className="relative overflow-hidden rounded-card border border-line bg-gradient-to-br from-card via-canvas to-canvas px-6 py-12 sm:px-10 sm:py-16">
      {/* Soft accent glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-brand/10 blur-3xl"
      />

      <div className="relative max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-pill border border-line bg-black/30 px-3 py-1 text-xs font-medium text-muted backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          Öppet nu · levereras varmt
        </span>

        <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl">
          Hungrig?{' '}
          <span className="bg-gradient-to-r from-brand to-brand-hover bg-clip-text text-transparent">
            Beställ på sekunder.
          </span>
        </h1>

        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          Handgjorda burgare, krispig pommes och iskalla drycker – lagat på
          beställning och redo när du är det. Lägg till i din beställning och
          hämta varmt i disken.
        </p>

        <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">
              På menyn
            </dt>
            <dd className="text-2xl font-bold text-ink">{itemCount} rätter</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">
              Snittbetyg
            </dt>
            <dd className="flex items-center gap-1 text-2xl font-bold text-ink">
              <span aria-hidden="true" className="text-brand">
                ★
              </span>
              4.8
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">
              Tillagning
            </dt>
            <dd className="text-2xl font-bold text-ink">~10 min</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
