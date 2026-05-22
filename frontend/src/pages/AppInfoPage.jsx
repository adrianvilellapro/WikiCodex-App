import {
  BookOpen,
  Eye,
  FileText,
  Info,
  Link as LinkIcon,
  Lock,
  MessageSquare,
  ScrollText,
  Shield,
  Sparkles,
  Sword,
  UserRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const ENTITY_GUIDES = [
  {
    title: 'Personajes',
    icon: UserRound,
    minimum: 'Nombre, campaña, propietario y privacidad.',
    details:
      'Después puedes completar descripción, lore, estadísticas, habilidades, clases, rasgos, ataques, daños, CD, hechizos, objetos, música, aparición, defunción y galería.',
  },
  {
    title: 'Objetos',
    icon: Sparkles,
    minimum: 'Nombre y, si procede, campaña.',
    details:
      'Admiten propietario editable, tipo, tier, magia, modificadores, rasgos, hechizos vinculados, imagen completa, versiones y privacidad granular.',
  },
  {
    title: 'Lugares',
    icon: BookOpen,
    minimum: 'Nombre y, si procede, campaña.',
    details:
      'Pueden organizarse en jerarquías, tener versiones, tipo, imagen, galería, descripción wiki y permisos por usuario o campaña.',
  },
  {
    title: 'Campañas',
    icon: Shield,
    minimum: 'Nombre único y privacidad.',
    details:
      'Desde su ficha se gestionan jugadores, aventuras, arcos, partidas, contenido asociado, tierlists y despliegues por tipo.',
  },
  {
    title: 'Aventuras, arcos y partidas',
    icon: FileText,
    minimum: 'Nombre; las partidas también necesitan fecha.',
    details:
      'Sirven para ordenar la narración. Las partidas pueden incluir personajes, objetos, lugares, música, galería, combates y descripción wiki.',
  },
  {
    title: 'Hechizos y otros poderes',
    icon: Sparkles,
    minimum: 'Nombre y descripción.',
    details:
      'Los hechizos tienen biblioteca base de sistema, filtros avanzados por campaña y clase, y texto enriquecido. Otros poderes son más libres y pueden vincularse a campañas.',
  },
]

const PRIVACY_GUIDES = [
  {
    title: 'Privado',
    text: 'Solo lo ven quien lo creó o posee, masters de las campañas vinculadas cuando corresponde y administradores. Puedes conceder permisos concretos.',
  },
  {
    title: 'Usuarios seleccionados',
    text: 'El elemento solo aparece para usuarios con permiso explícito, masters autorizados y administradores.',
  },
  {
    title: 'Campaña completa',
    text: 'Jugadores con acceso a la campaña pueden ver la ficha completa cuando el modo de privacidad lo permite.',
  },
  {
    title: 'Vista previa de campaña',
    text: 'Permite revelar información limitada, como nombre, imagen o resumen, sin exponer toda la ficha.',
  },
  {
    title: 'Texto wiki y búsquedas',
    text: 'El autocompletado y los enlaces solo muestran destinos visibles para tu usuario. Si no tienes acceso, no se filtra información privada.',
  },
  {
    title: 'Administradores',
    text: 'Pueden ver y editar todo, pero su cuenta se oculta en listados normales y la zona de administración exige desbloqueo adicional.',
  },
]

const CHARACTER_GUIDES = [
  {
    title: 'Ataques, Daños y CD',
    text: 'En el tipo de rasgo Acción puedes definir cantidad de ataques, ataques, daños, ataques mágicos, daños mágicos y CD. Los valores vacíos no se muestran.',
  },
  {
    title: 'Valores múltiples',
    text: 'Ataque, daño, ataque mágico, daño mágico y CD pueden tener varias versiones. En la ficha se agrupan y en el selector puedes insertar una versión concreta.',
  },
  {
    title: 'Rasgos dinámicos',
    text: 'Al escribir { en un rasgo puedes insertar datos vivos de la ficha: características, PG, CA, movimiento, competencia, salvaciones, pasivas, habilidades y ataques.',
  },
  {
    title: 'Habilidades',
    text: 'La tabla calcula competencia, pericia y modificadores, permite totales manuales y mantiene una vista compacta en detalle, móvil y tablet.',
  },
  {
    title: 'Objetos en ficha',
    text: 'Los rasgos de objetos pueden mostrarse dentro del personaje y editarse para esa ficha sin modificar los rasgos originales del objeto.',
  },
  {
    title: 'Formato de rasgos',
    text: 'Los saltos de línea iniciales se respetan, así que puedes hacer que la descripción empiece debajo del nombre del rasgo cuando la ficha lo necesite.',
  },
]

const WIKI_GUIDES = [
  [
    '[[personaje:Ariadna]]',
    'Crea un enlace wiki al elemento visible llamado Ariadna.',
  ],
  [
    '[[objeto:Llave|la llave antigua]]',
    'Enlaza al objeto, pero muestra otro texto visible.',
  ],
  [
    '{Fue}',
    'Inserta el modificador actual de Fuerza en un rasgo de personaje.',
  ],
  ['{Atletismo}', 'Inserta el total actual de una habilidad de la ficha.'],
  [
    '{accion.ataque.1}',
    'Inserta una versión concreta de un ataque definido en Ataques, Daños y CD.',
  ],
  ['**negrita**', 'Marca texto importante con peso visual.'],
  ['*cursiva*', 'Útil para voces, pensamientos o énfasis suave.'],
  ['==destacado==', 'Resalta conceptos clave con el color de la aplicación.'],
]

const WORKFLOW_TIPS = [
  'Escribe [[ en un campo largo para abrir el autocompletado wiki.',
  'Escribe { en rasgos de personaje para insertar datos vivos de la ficha.',
  'Si un dato de ataque tiene varias versiones, el selector muestra cada valor por separado.',
  'El autocompletado solo devuelve elementos que tu usuario puede ver.',
  'Los comentarios aceptan negrita, cursiva y destacado, pero no enlaces wiki.',
  'Si una referencia no es visible para alguien, esa persona verá contenido restringido sin enlace útil.',
  'Si hay dos elementos visibles con el mismo tipo y nombre, la referencia se marca como ambigua.',
]

const RULES_GUIDES = [
  {
    title: 'Reglamento y Recursos',
    text: 'La sección Reglamento y Recursos está separada de Herramientas de juego y contiene accesos a Reglamento General, Referencia Rápida, sets de reglas y recursos externos.',
  },
  {
    title: 'Reglamento General',
    text: 'Funciona como libro unificado: puedes leerlo seguido, plegar el índice, saltar a entradas concretas y ver una entrada aislada con el icono del ojo.',
  },
  {
    title: 'Referencia Rápida',
    text: 'Muestra acciones, estados, entorno y condiciones en tarjetas desplegadas de base, con buscador y detalle emergente al pulsar cada entrada.',
  },
  {
    title: 'Recursos Externos',
    text: 'Agrupa enlaces y PDFs descargables por sistema, con acceso protegido para usuarios registrados y vuelta al selector de reglamento.',
  },
]

function InfoCard({ title, children, icon }) {
  const CardIcon = icon

  return (
    <article className="panel min-w-0 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
          <CardIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="break-words font-display text-2xl font-bold tracking-[-0.04em] text-ink [overflow-wrap:anywhere]">
            {title}
          </h2>
          <div className="mt-3 text-sm leading-7 text-ink-soft">{children}</div>
        </div>
      </div>
    </article>
  )
}

export function AppInfoPage() {
  return (
    <section className="grid min-w-0 gap-5 pb-10">
      <article className="panel relative min-w-0 overflow-hidden px-4 py-6 sm:px-7 sm:py-8">
        <div className="relative max-w-4xl">
          <p className="font-label text-[10px] font-black uppercase tracking-[0.26em] text-brand">
            Guía de uso
          </p>
          <h1 className="mt-3 break-words font-display text-4xl font-black tracking-[-0.06em] text-ink [overflow-wrap:anywhere] sm:text-5xl">
            Información de WikiCodex
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-soft">
            Esta página resume cómo crear contenido, cómo funciona la
            privacidad, cómo escribir texto wiki, cómo usar los datos dinámicos
            de las fichas y dónde consultar reglas o herramientas de juego.
          </p>
        </div>
      </article>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-5">
          <InfoCard title="Crear contenido" icon={BookOpen}>
            <div className="grid gap-3 md:grid-cols-2">
              {ENTITY_GUIDES.map((item) => (
                <div
                  key={item.title}
                  className="min-w-0 rounded-xl border border-stroke bg-white p-4"
                >
                  <div className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-brand" />
                    <h3 className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink">
                      {item.title}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm font-bold text-ink">
                    Mínimo: {item.minimum}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">
                    {item.details}
                  </p>
                </div>
              ))}
            </div>
          </InfoCard>

          <InfoCard title="Privacidad y permisos" icon={Lock}>
            <div className="grid gap-3 md:grid-cols-2">
              {PRIVACY_GUIDES.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-stroke bg-white p-4"
                >
                  <h3 className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </InfoCard>

          <InfoCard title="Fichas de personaje" icon={UserRound}>
            <div className="grid gap-3 md:grid-cols-2">
              {CHARACTER_GUIDES.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-stroke bg-white p-4"
                >
                  <h3 className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </InfoCard>

          <InfoCard title="Texto wiki y datos dinámicos" icon={LinkIcon}>
            <div className="grid gap-3">
              {WIKI_GUIDES.map(([syntax, description]) => (
                <div
                  key={syntax}
                  className="grid gap-2 rounded-xl border border-stroke bg-white p-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center"
                >
                  <code className="break-words rounded-lg bg-brand/10 px-3 py-2 font-mono text-sm font-bold text-brand [overflow-wrap:anywhere]">
                    {syntax}
                  </code>
                  <p className="text-sm leading-6 text-ink-soft">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </InfoCard>

          <InfoCard title="Reglamento y Recursos" icon={ScrollText}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {RULES_GUIDES.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-stroke bg-white p-4"
                >
                  <h3 className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
            <Link
              to="/app/reglamento"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/10 px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-brand transition hover:border-brand/60"
            >
              <ScrollText className="h-4 w-4" />
              Abrir reglamento y recursos
            </Link>
          </InfoCard>
        </div>

        <aside className="grid h-fit min-w-0 gap-5">
          <InfoCard title="Flujo de escritura" icon={Info}>
            <ul className="grid gap-3">
              {WORKFLOW_TIPS.map((tip) => (
                <li key={tip} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </InfoCard>

          <InfoCard title="Comentarios y avisos" icon={MessageSquare}>
            <p>
              Las fichas de personajes, objetos, lugares, partidas, perfiles
              públicos y otros poderes tienen comentarios plegados de base. Cada
              usuario puede dejar uno, editarlo o borrarlo; el dueño del
              elemento puede borrarlo y recibe notificación cuando comentan en
              su ficha.
            </p>
          </InfoCard>

          <InfoCard title="Herramientas de juego" icon={Sword}>
            <p>
              Herramientas de juego reúne el gestor de combate y BossRush. El
              rail derecho permite saltar directamente a esas páginas y también
              a las secciones de reglamento.
            </p>
          </InfoCard>

          <InfoCard title="Masters y administración" icon={Eye}>
            <p>
              El master de una campaña puede gestionar el contenido de su mesa
              según las reglas de campaña. Las cuentas administradoras tienen
              acceso global, sesión reforzada y entrada protegida a la zona de
              administración.
            </p>
          </InfoCard>
        </aside>
      </div>
    </section>
  )
}
