import { BookOpen, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

const BRAND_HUB_GRADIENT =
  'radial-gradient(circle at top right, rgb(255 255 255 / 0.2), transparent 34%), linear-gradient(145deg, rgb(var(--theme-brand-deep)) 0%, rgb(var(--color-brand-strong)) 52%, rgb(var(--color-accent)) 100%)'

function PowerHubCard({
  to,
  icon,
  eyebrow,
  title,
  description,
  highlights,
  gradient = BRAND_HUB_GRADIENT,
}) {
  const CardContent = (
    <article
      className="group relative flex min-h-[30rem] overflow-hidden rounded-[2rem] border border-stroke bg-ink p-7 text-white shadow-card transition hover:-translate-y-1 hover:border-brand/50 max-sm:min-h-[18rem] max-sm:rounded-2xl max-sm:p-5"
      style={{ background: gradient }}
    >
      <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-white/15 blur-2xl transition group-hover:scale-125" />
      <div className="absolute bottom-0 left-0 h-48 w-full bg-gradient-to-t from-black/45 to-transparent" />
      <div className="relative z-10 flex h-full w-full flex-col justify-between">
        <div>
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/15 backdrop-blur">
            {icon}
          </div>
          <p className="mt-6 font-label text-[10px] font-black uppercase tracking-[0.24em] text-white/75">
            {eyebrow}
          </p>
          <h2 className="mt-3 max-w-xl font-display text-5xl font-bold tracking-[-0.07em] max-sm:text-3xl max-sm:tracking-[-0.05em]">
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

  if (!to) {
    return CardContent
  }

  return (
    <Link
      to={to}
      className="block focus:outline-none focus:ring-2 focus:ring-brand"
    >
      {CardContent}
    </Link>
  )
}

export function PowersPage() {
  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-stroke bg-white p-6 shadow-card">
        <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
          Poderes
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.06em] text-ink">
          Archivo general de poderes
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
          La biblioteca separa los hechizos funcionales del expositor de otros
          poderes. Entra pulsando cualquier punto de la ficha que quieras abrir.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <PowerHubCard
          to="/app/poderes/hechizos"
          icon={<BookOpen className="h-6 w-6" />}
          eyebrow="Biblioteca activa"
          title="Hechizos"
          description="Repositorio completo de hechizos visibles, con filtros avanzados, guardado personal y creación de hechizos públicos o privados."
          highlights={[
            'Asignables desde las fichas de personaje',
            'Organizados por nivel y escuela',
            'Clic completo para entrar en la biblioteca',
          ]}
        />
        <PowerHubCard
          to="/app/poderes/otros"
          icon={<Sparkles className="h-6 w-6" />}
          eyebrow="Expositor"
          title="Otros poderes"
          description="Bendiciones, maldiciones, mutaciones, dones y poderes narrativos con categorías propias, campañas y privacidad granular."
          highlights={[
            'Estructura independiente de hechizos',
            'Fichas con imagen opcional y detalle',
            'Ideal para efectos especiales de campaña',
          ]}
        />
      </div>
    </section>
  )
}
