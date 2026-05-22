import { ChevronLeft, Layers3, SlidersHorizontal } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { recordRecentActivity } from '../services/recent-activity'

export function RulesSetsPage() {
  useEffect(() => {
    recordRecentActivity({
      entityType: 'rule',
      entityId: 'rules-sets',
      nombre: 'Sets de Reglamento',
      subtitulo: 'Paquetes de reglas',
      urlDestino: '/app/reglamento/sets',
    })
  }, [])

  return (
    <section className="grid min-h-[calc(100vh-9rem)] place-items-center px-1">
      <div className="panel relative w-full max-w-4xl overflow-hidden p-8 text-center sm:p-12">
        <div className="absolute inset-x-0 top-0 h-1 bg-brand" />
        <Link
          to="/app/reglamento"
          className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-lg border border-stroke px-3 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          <ChevronLeft className="h-4 w-4" />
          Reglamento y Recursos
        </Link>

        <div className="mx-auto mt-12 flex h-20 w-20 items-center justify-center rounded-2xl border border-brand/25 bg-brand/10 text-brand shadow-glow sm:mt-0">
          <Layers3 className="h-10 w-10" />
        </div>

        <p className="mt-8 font-label text-[10px] font-black uppercase text-brand">
          Sets de Reglamento
        </p>
        <h1 className="mt-3 font-display text-5xl font-bold text-ink max-sm:text-4xl">
          Paquetes de reglas
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-ink-soft">
          Esta sección queda preparada para aplicar paquetes de reglas a
          campañas. Todavía no ejecuta cambios sobre campañas ni fichas.
        </p>

        <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
          {['Reglas de campaña', 'Variantes', 'Activación futura'].map(
            (item) => (
              <div
                key={item}
                className="rounded-lg border border-stroke bg-surface-strong px-4 py-4 text-sm font-semibold text-ink-soft"
              >
                <SlidersHorizontal className="mx-auto mb-2 h-4 w-4 text-brand" />
                {item}
              </div>
            )
          )}
        </div>
      </div>
    </section>
  )
}
