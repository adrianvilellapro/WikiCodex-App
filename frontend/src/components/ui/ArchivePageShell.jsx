import { cn } from '../../lib/cn'

function PlaceholderCard({ item }) {
  return (
    <article className="rounded-lg bg-white p-4 shadow-card">
      <div className="h-36 rounded-md" style={{ background: item.gradient }} />
      <div className="mt-4 space-y-2">
        <h3 className="font-display text-xl font-bold tracking-[-0.05em] text-ink">
          {item.title}
        </h3>
        <p className="text-sm leading-6 text-ink-soft">{item.subtitle}</p>
        <span className="archive-chip">{item.badge}</span>
      </div>
    </article>
  )
}

export function ArchivePageShell({
  eyebrow,
  title,
  description,
  highlight,
  sections,
  className,
}) {
  return (
    <section className={cn('grid gap-6', className)}>
      <article className="panel px-6 py-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="font-label text-[10px] font-bold uppercase tracking-[0.24em] text-brand">
              {eyebrow}
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.06em] text-ink">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-soft sm:text-base">
              {description}
            </p>
          </div>

          {highlight ? (
            <div className="rounded-lg bg-white px-4 py-4 shadow-card xl:max-w-sm">
              <p className="font-label text-[10px] font-bold uppercase tracking-[0.22em] text-ink-muted">
                En foco
              </p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                {highlight}
              </p>
            </div>
          ) : null}
        </div>
      </article>

      {sections.map((section) => (
        <article key={section.title} className="panel px-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-label text-[10px] font-bold uppercase tracking-[0.22em] text-ink-muted">
                {section.eyebrow}
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.05em] text-ink">
                {section.title}
              </h2>
            </div>
            {section.note ? (
              <p className="text-sm text-ink-soft">{section.note}</p>
            ) : null}
          </div>

          <div
            className={cn(
              'mt-5 grid gap-4',
              section.columns || 'grid-cols-1 lg:grid-cols-3'
            )}
          >
            {section.items.map((item) => (
              <PlaceholderCard key={item.title} item={item} />
            ))}
          </div>
        </article>
      ))}
    </section>
  )
}
