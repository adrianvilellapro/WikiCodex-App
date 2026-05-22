import { Crown, Sparkles } from 'lucide-react'

export function BossRushPage() {
  return (
    <section className="grid min-h-[calc(100vh-9rem)] place-items-center px-1">
      <div className="panel relative w-full max-w-4xl overflow-hidden p-8 text-center sm:p-12">
        <div className="absolute inset-x-0 top-0 h-1 bg-brand" />
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-brand/25 bg-brand/10 text-brand shadow-glow">
          <Crown className="h-10 w-10" />
        </div>

        <p className="mt-8 font-label text-[10px] font-black uppercase text-brand">
          Herramientas de Juego
        </p>
        <h1 className="mt-3 font-display text-5xl font-bold text-ink max-sm:text-4xl">
          BossRush
        </h1>
        <p className="mt-5 text-2xl font-semibold text-ink-soft">
          Proximamente!
        </p>

        <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
          {['Jefes', 'Oleadas', 'Recompensas'].map((item) => (
            <div
              key={item}
              className="rounded-lg border border-stroke bg-surface-strong px-4 py-4 text-sm font-semibold text-ink-soft"
            >
              <Sparkles className="mx-auto mb-2 h-4 w-4 text-brand" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
