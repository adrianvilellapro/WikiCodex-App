import { BookOpen, FolderOpen, Layers3, ListChecks } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { recordRecentActivity } from '../services/recent-activity'

const BRAND_HUB_GRADIENT =
  'radial-gradient(circle at top right, rgb(255 255 255 / 0.2), transparent 34%), linear-gradient(145deg, rgb(var(--theme-brand-deep)) 0%, rgb(var(--color-brand-strong)) 52%, rgb(var(--color-accent)) 100%)'

function RuleHubCard({
  to,
  icon,
  eyebrow,
  title,
  description,
  highlights,
  disabled = false,
  className = '',
}) {
  const content = (
    <article
      className={`group relative flex min-h-[24rem] overflow-hidden rounded-[2rem] border border-stroke bg-ink p-7 text-white shadow-card transition max-sm:min-h-[18rem] max-sm:rounded-2xl max-sm:p-5 ${
        disabled
          ? 'opacity-75'
          : 'hover:-translate-y-1 hover:border-brand/50 hover:shadow-glow'
      } ${className}`}
      style={{ background: BRAND_HUB_GRADIENT }}
    >
      <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-white/15 blur-2xl transition group-hover:scale-125" />
      <div className="absolute bottom-0 left-0 h-40 w-full bg-gradient-to-t from-black/45 to-transparent" />
      <div className="relative z-10 flex h-full w-full flex-col justify-between">
        <div>
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-white backdrop-blur">
            {icon}
          </div>
          <p className="mt-6 font-label text-[10px] font-black uppercase tracking-[0.24em] text-white/75">
            {eyebrow}
          </p>
          <h2 className="mt-3 max-w-xl break-words font-display text-5xl font-bold tracking-[-0.07em] text-white max-sm:text-3xl max-sm:tracking-[-0.05em]">
            {title}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-8 text-white/78 max-sm:mt-4 max-sm:text-sm max-sm:leading-6">
            {description}
          </p>
        </div>

        <div className="mt-10 grid gap-3 max-sm:mt-6 max-sm:gap-2">
          {highlights.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/15 bg-white/12 px-4 py-3 text-sm font-semibold text-white/85 backdrop-blur"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </article>
  )

  if (disabled || !to) {
    return content
  }

  return (
    <Link
      to={to}
      className="block focus:outline-none focus:ring-2 focus:ring-brand"
    >
      {content}
    </Link>
  )
}

export function RulesPage() {
  useEffect(() => {
    recordRecentActivity({
      entityType: 'rule',
      entityId: 'rules-hub',
      nombre: 'Reglamento y Recursos',
      subtitulo: 'Centro de reglas',
      urlDestino: '/app/reglamento',
    })
  }, [])

  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-stroke bg-white p-6 shadow-card">
        <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
          Reglamento y Recursos
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.06em] text-ink max-sm:text-3xl">
          Centro de reglas y recursos
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
          Consulta reglamento general, accesos rápidos de mesa, paquetes de
          reglas y recursos externos preparados para campañas.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <RuleHubCard
          to="/app/reglamento/general"
          icon={<BookOpen className="h-6 w-6" />}
          eyebrow="Base"
          title="Reglamento General"
          description="Reglamento SRD 5e estructurado para consulta, sin clases, razas, conjuros concretos ni monstruos individuales."
          highlights={[
            'Índice navegable',
            'Buscador por secciones',
            'Reglas integradas en la app',
          ]}
        />
        <RuleHubCard
          to="/app/reglamento/referencia-rapida"
          icon={<ListChecks className="h-6 w-6" />}
          eyebrow="Consulta"
          title="Referencia Rápida"
          description="Pantalla de apoyo para acciones, movimiento, estados, entorno y descanso en D&D 5e 2014."
          highlights={[
            'Iconos originales',
            'Detalles al pulsar',
            'Adaptada a móvil y ordenador',
          ]}
        />
        <RuleHubCard
          to="/app/reglamento/sets"
          icon={<Layers3 className="h-6 w-6" />}
          eyebrow="Campañas"
          title="Sets de Reglamento"
          description="Área preparada para futuros paquetes de reglas aplicables a campañas concretas."
          highlights={[
            'Pendiente de activación',
            'Paquetes por campaña',
            'Reglas configurables',
          ]}
        />
        <RuleHubCard
          to="/app/reglamento/recursos"
          icon={<FolderOpen className="h-6 w-6" />}
          eyebrow="Biblioteca"
          title="Recursos Externos"
          description="Enlaces y PDFs de apoyo para D&D 5e, Pathfinder, Vieja Escuela, mapas y miniaturas."
          highlights={[
            'Enlaces organizados',
            'PDFs descargables',
            'Desplegables por sistema',
          ]}
        />
      </div>
    </section>
  )
}
