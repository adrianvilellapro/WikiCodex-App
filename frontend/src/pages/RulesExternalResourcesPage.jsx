import {
  ChevronDown,
  ChevronLeft,
  Download,
  ExternalLink,
  FolderOpen,
  Link2,
  ScrollText,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../services/http'
import { recordRecentActivity } from '../services/recent-activity'

const resourceSections = [
  {
    title: 'DnD 5e',
    description:
      'Material de consulta para clases, bestiario y utilidades de mesa.',
    groups: [
      {
        title: 'Información de Clases, Bestiario...',
        items: [
          {
            title: 'Dnd wikidot',
            type: 'link',
            href: 'https://dnd5e.wikidot.com/',
          },
          {
            title: '5e Tools',
            type: 'link',
            href: 'https://5e.tools/',
          },
          {
            title: 'Clases épicas (Nv 20 - 30)',
            type: 'pdf',
            fileName: 'epic-characters-v3-1.pdf',
          },
        ],
      },
      {
        title: 'Utilidades',
        items: [
          {
            title: 'Calculadora Stats',
            type: 'link',
            href: 'https://chicken-dinner.com/5e/5e-point-buy.html',
          },
          {
            title: 'Ficha Clásica Editable',
            type: 'pdf',
            fileName: 'ficha-clasica-editable.pdf',
          },
        ],
      },
    ],
  },
  {
    title: 'Pathfinder',
    description: 'Referencias y herramientas rápidas para Pathfinder.',
    groups: [
      {
        title: 'Información de Clases, Bestiario...',
        items: [
          {
            title: 'd20PFSRD',
            type: 'link',
            href: 'https://www.d20pfsrd.com/',
          },
        ],
      },
      {
        title: 'Utilidades',
        items: [
          {
            title: 'Calculadora stats',
            type: 'link',
            href: 'https://pittsburghpfs.com/resources/point-buy-calculator/',
          },
        ],
      },
    ],
  },
  {
    title: 'Vieja Escuela',
    description:
      'Sistema base, expansión y ficha para partidas de Vieja Escuela.',
    groups: [
      {
        title: 'Sistema',
        items: [
          {
            title: 'Sistema base',
            type: 'pdf',
            fileName: 'vieja-escuela-base.pdf',
          },
          {
            title: 'Expansión del sistema',
            type: 'pdf',
            fileName: 'vieja-escuela-avanzado.pdf',
          },
        ],
      },
      {
        title: 'Utilidades',
        items: [
          {
            title: 'Ficha de Personaje',
            type: 'pdf',
            fileName: 'vieja-escuela-ficha-personaje.pdf',
          },
        ],
      },
    ],
  },
  {
    title: 'Miscelánea',
    description: 'Herramientas externas para mapas y miniaturas.',
    groups: [
      {
        title: 'Mapas',
        items: [
          {
            title: 'Inkarnate',
            type: 'link',
            href: 'https://inkarnate.com/',
          },
          {
            title: 'Azgaar Fantasy Map Generator',
            type: 'link',
            href: 'https://azgaar.github.io/Fantasy-Map-Generator/',
          },
        ],
      },
      {
        title: 'Miniaturas',
        items: [
          {
            title: 'Hero Forge',
            type: 'link',
            href: 'https://www.heroforge.com/',
          },
        ],
      },
    ],
  },
]

async function downloadResourcePdf(item) {
  const { data } = await api.get(`/resources/external/${item.fileName}`)

  if (data.source === 'backend') {
    const response = await api.get(data.downloadPath, {
      responseType: 'blob',
    })
    const blobUrl = window.URL.createObjectURL(response.data)
    const link = document.createElement('a')

    link.href = blobUrl
    link.download = item.fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(blobUrl)
    return
  }

  const link = document.createElement('a')

  link.href = data.downloadUrl || data.viewUrl
  link.download = item.fileName
  link.rel = 'noreferrer noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function ResourceAction({ item }) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const isPdf = item.type === 'pdf'
  const Icon = isPdf ? Download : ExternalLink
  const sharedClassName =
    'group/item flex min-w-0 items-center justify-between gap-3 border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-brand/50 hover:bg-brand/5'
  const inner = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-brand/20 bg-brand/10 text-brand">
          {isPdf ? (
            <ScrollText className="h-4 w-4" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-ink">
            {item.title}
          </span>
          <span className="mt-0.5 block truncate text-xs font-semibold text-ink-muted">
            {isPdf
              ? isDownloading
                ? 'Preparando descarga...'
                : 'PDF descargable'
              : item.href.replace(/^https?:\/\//, '')}
          </span>
          {downloadError ? (
            <span className="mt-1 block text-xs font-semibold text-danger">
              {downloadError}
            </span>
          ) : null}
        </span>
      </span>
      <Icon className="h-4 w-4 shrink-0 text-slate-400 transition group-hover/item:text-brand" />
    </>
  )

  if (isPdf) {
    return (
      <button
        type="button"
        disabled={isDownloading}
        onClick={async () => {
          setIsDownloading(true)
          setDownloadError('')

          try {
            await downloadResourcePdf(item)
          } catch {
            setDownloadError('No se pudo descargar el PDF.')
          } finally {
            setIsDownloading(false)
          }
        }}
        className={`${sharedClassName} disabled:cursor-wait disabled:opacity-70`}
      >
        {inner}
      </button>
    )
  }

  return (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer noopener"
      referrerPolicy="no-referrer"
      className={sharedClassName}
    >
      {inner}
    </a>
  )
}

function ResourceGroup({ group }) {
  return (
    <div className="grid gap-2 border-t border-brand/10 pt-4 first:border-t-0 first:pt-0">
      <h3 className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
        {group.title}
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {group.items.map((item) => (
          <ResourceAction key={`${group.title}-${item.title}`} item={item} />
        ))}
      </div>
    </div>
  )
}

export function RulesExternalResourcesPage() {
  useEffect(() => {
    recordRecentActivity({
      entityType: 'rule',
      entityId: 'rules-external-resources',
      nombre: 'Recursos Externos',
      subtitulo: 'Biblioteca de recursos',
      urlDestino: '/app/reglamento/recursos',
    })
  }, [])

  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-stroke bg-white p-6 shadow-card">
        <Link
          to="/app/reglamento"
          className="inline-flex items-center gap-2 rounded-lg border border-stroke px-3 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          <ChevronLeft className="h-4 w-4" />
          Reglamento y Recursos
        </Link>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.06em] text-ink max-sm:text-3xl">
          Recursos Externos
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
          Enlaces y documentos de apoyo organizados por sistema. Los PDFs se
          sirven desde Cloudinary cuando están disponibles y solo se solicitan
          cuando se pulsan.
        </p>
      </div>

      <div className="grid gap-4">
        {resourceSections.map((section, index) => (
          <details
            key={section.title}
            open={index === 0}
            className="group rounded-3xl border border-stroke bg-white shadow-card"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:hidden sm:px-6">
              <span className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand/20 bg-brand/10 text-brand">
                  <FolderOpen className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-headline text-xl font-black text-ink">
                    {section.title}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-ink-soft">
                    {section.description}
                  </span>
                </span>
              </span>
              <ChevronDown className="h-5 w-5 shrink-0 text-brand transition group-open:rotate-180" />
            </summary>
            <div className="grid gap-5 border-t border-brand/10 px-5 py-5 sm:px-6">
              {section.groups.map((group) => (
                <ResourceGroup key={group.title} group={group} />
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
