import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '../../lib/cn'

const WIKICODEX_CAMPAIGN_FILTER_ID = '__wikicodex'

function buildCampaignFilterOptions(campaigns = []) {
  return [
    { id: WIKICODEX_CAMPAIGN_FILTER_ID, nombre: 'WikiCodex' },
    ...campaigns,
  ]
}

export function CampaignCheckboxFilter({
  campaigns = [],
  selectedIds = null,
  onChange,
  limit = 10,
}) {
  const [expanded, setExpanded] = useState(false)
  const options = buildCampaignFilterOptions(campaigns)
  const optionIds = options.map((campaign) => campaign.id)
  const visibleOptions = expanded ? options : options.slice(0, limit)
  const normalizedSelectedIds = Array.isArray(selectedIds) ? selectedIds : null
  const selectedSet = new Set(normalizedSelectedIds ?? optionIds)

  function toggleCampaign(campaignId) {
    const currentSelectedIds = normalizedSelectedIds ?? optionIds
    const nextSelectedIds = selectedSet.has(campaignId)
      ? currentSelectedIds.filter((id) => id !== campaignId)
      : [...currentSelectedIds, campaignId]
    const uniqueSelectedIds = optionIds.filter((id) =>
      nextSelectedIds.includes(id)
    )

    onChange(
      uniqueSelectedIds.length === optionIds.length ? null : uniqueSelectedIds
    )
  }

  return (
    <div className="grid gap-2">
      {visibleOptions.map((campaign) => {
        const checked = selectedSet.has(campaign.id)

        return (
          <label
            key={campaign.id}
            className={cn(
              'flex min-w-0 max-w-full cursor-pointer items-start gap-3 overflow-hidden rounded-xl border px-3 py-2 text-sm font-semibold transition',
              checked
                ? 'border-brand/50 bg-brand/10 text-brand'
                : 'border-stroke bg-white text-ink-soft hover:border-brand/40 hover:text-ink'
            )}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggleCampaign(campaign.id)}
              className="h-4 w-4 shrink-0 rounded border-stroke text-brand focus:ring-brand"
            />
            <span className="min-w-0 flex-1 break-words leading-5 [overflow-wrap:anywhere]">
              {campaign.nombre}
            </span>
          </label>
        )
      })}

      {options.length > limit ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex items-center gap-2 justify-self-start font-label text-[9px] font-black uppercase tracking-[0.16em] text-ink-muted transition hover:text-brand"
        >
          {expanded ? 'Ver menos' : `Ver ${options.length - limit} más`}
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition', expanded && 'rotate-180')}
          />
        </button>
      ) : null}
    </div>
  )
}
