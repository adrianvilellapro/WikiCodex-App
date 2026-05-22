import { Crown, Sparkles, Swords, WandSparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

function ToolCard({ to, icon, eyebrow, title, description, items, gradient }) {
  const content = (
    <article
      className="group relative flex min-h-[22rem] overflow-hidden rounded-[2rem] border border-stroke bg-ink p-6 text-white shadow-card transition hover:-translate-y-1 hover:border-brand/50 max-sm:min-h-[17rem] max-sm:rounded-2xl max-sm:p-5"
      style={{ background: gradient }}
    >
      <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-white/15 blur-2xl transition group-hover:scale-125" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/42 to-transparent" />
      <div className="relative z-10 flex h-full w-full flex-col justify-between">
        <div>
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/15 backdrop-blur">
            {icon}
          </div>
          <p className="mt-5 font-label text-[10px] font-black uppercase tracking-[0.22em] text-white/75">
            {eyebrow}
          </p>
          <h2 className="mt-3 max-w-xl font-display text-4xl font-bold tracking-[-0.06em] max-sm:text-3xl">
            {title}
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/78">
            {description}
          </p>
        </div>

        <div className="mt-8 grid gap-2">
          {items.map((item) => (
            <div
              key={item}
              className="rounded-xl border border-white/15 bg-white/12 px-4 py-3 text-sm font-semibold text-white/85 backdrop-blur"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </article>
  )

  return (
    <Link
      to={to}
      className="block focus:outline-none focus:ring-2 focus:ring-brand"
    >
      {content}
    </Link>
  )
}

export function GameToolsPage() {
  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-stroke bg-white p-6 shadow-card">
        <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
          Herramientas de Juego
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.06em] text-ink max-sm:text-3xl">
          Mesa de herramientas
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
          Accesos de apoyo para dirigir, consultar reglas y preparar encuentros
          sin salir del archivo de campaña.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <ToolCard
          to="/app/herramientas/combate"
          icon={<Swords className="h-6 w-6" />}
          eyebrow="Mesa activa"
          title="Gestor de Combate"
          description="Control de iniciativas, turnos, participantes y combates vinculados a partidas."
          items={[
            'Combates activos',
            'Historial terminado',
            'Vinculación con partidas',
          ]}
          gradient="linear-gradient(145deg, #111827 0%, #36515f 50%, #9ed7df 100%)"
        />
        <ToolCard
          to="/app/herramientas/hechizos"
          icon={<WandSparkles className="h-6 w-6" />}
          eyebrow="Recursos mágicos"
          title="Gestor de Hechizos"
          description="Control temporal de slots, lanzadores e inventarios de hechizos visibles durante una partida."
          items={[
            'Slots actuales',
            'Hechizos por lanzador',
            'Entradas manuales',
          ]}
          gradient="linear-gradient(145deg, #132316 0%, #2f6b57 52%, #d9f99d 100%)"
        />
        <ToolCard
          to="/app/herramientas/bossrush"
          icon={<Crown className="h-6 w-6" />}
          eyebrow="Desafíos"
          title="BossRush"
          description="Zona reservada para jefes, oleadas y recompensas especiales."
          items={['Jefes', 'Oleadas', 'Recompensas']}
          gradient="linear-gradient(145deg, #170c18 0%, #62306d 50%, #e9a4ff 100%)"
        />
      </div>

      <div className="rounded-2xl border border-brand/20 bg-brand/10 p-4 text-sm leading-6 text-ink-soft">
        <Sparkles className="mr-2 inline h-4 w-4 text-brand" />
        Las herramientas pueden abrirse también desde el menú lateral izquierdo.
      </div>
    </section>
  )
}
