import {
  ArrowLeft,
  ChevronUp,
  Pencil,
  RotateCcw,
  RotateCw,
  Save,
  Trash2,
  UserCircle2,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { useState } from 'react'

import { CloudinaryImage } from '../../components/ui/CloudinaryImage'
import { MAX_ABILITY_SCORE, MAX_SAVING_THROW } from './constants'
import {
  formatSheetModifier,
  formatSheetNumber,
  getAbilityModifier,
  sanitizeIntegerInput,
} from './utils'

export function EditableField({
  label,
  value,
  onChange,
  type = 'text',
  textarea = false,
  placeholder,
  min,
  max,
  step,
  maxLength,
  inputMode,
  pattern,
  inputClassName,
}) {
  const sharedProps = {
    value: value ?? '',
    onChange,
    placeholder,
    maxLength,
    inputMode,
    pattern,
    className: clsx(
      'mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand',
      inputClassName
    ),
  }

  return (
    <label className="block">
      <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      {textarea ? (
        <textarea {...sharedProps} rows={5} />
      ) : (
        <input {...sharedProps} type={type} min={min} max={max} step={step} />
      )}
    </label>
  )
}

export function AbilityScoreBlock({
  label,
  score,
  savingThrow,
  editMode,
  saveProficient = false,
  onChange,
  onToggleProficiency,
}) {
  const modifier = getAbilityModifier(score)

  return (
    <div className="flex min-w-0 flex-col text-center">
      <span className="mb-1 font-headline text-[8px] font-black uppercase tracking-[0.08em] text-slate-400 sm:text-[10px] sm:tracking-[0.18em]">
        {label}
      </span>
      {editMode ? (
        <>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={score ?? ''}
            onChange={(event) =>
              onChange(
                'score',
                sanitizeIntegerInput(event.target.value, MAX_ABILITY_SCORE)
              )
            }
            className="mx-auto w-10 border border-slate-200 bg-white px-1 py-1 text-center text-sm font-bold text-[#111827] outline-none focus:border-brand sm:w-24 sm:px-2 sm:text-[1.35rem]"
          />
          <span className="mt-1 text-xs font-semibold text-brand sm:text-base">
            {formatSheetModifier(modifier)}
          </span>
          <div className="mx-auto my-1 h-px w-5 bg-slate-200 sm:my-2 sm:w-8" />
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={savingThrow ?? 0}
            onChange={(event) =>
              onChange(
                'savingThrow',
                sanitizeIntegerInput(event.target.value, MAX_SAVING_THROW) ?? 0
              )
            }
            className="mx-auto w-9 border border-slate-200 bg-white px-1 py-1 text-center text-xs font-bold text-brand outline-none focus:border-brand sm:w-20 sm:px-2 sm:text-sm"
          />
          <label className="mt-2 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            <input
              type="checkbox"
              checked={saveProficient}
              onChange={(event) => onToggleProficiency?.(event.target.checked)}
              className="h-3.5 w-3.5 border-slate-300 text-brand focus:ring-brand"
            />
            <span className="hidden sm:inline">Sumar competencia</span>
          </label>
        </>
      ) : (
        <>
          <span className="text-[0.95rem] font-bold leading-tight text-[#111827] sm:text-[1.75rem]">
            {formatSheetNumber(score)}{' '}
            <span className="block text-[0.7rem] text-brand sm:inline sm:text-[1.75rem]">
              ({formatSheetModifier(modifier)})
            </span>
          </span>
          <div className="mx-auto my-1 h-px w-5 bg-slate-200 sm:my-2 sm:w-8" />
          <span className="text-[0.7rem] font-bold text-brand sm:text-sm">
            {savingThrow === null || savingThrow === undefined
              ? '+0'
              : formatSheetModifier(savingThrow)}
          </span>
        </>
      )}
    </div>
  )
}

export function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  rememberChoice,
  onRememberChoiceChange,
}) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-md border border-slate-200 bg-white p-6 shadow-2xl">
        <h3 className="font-headline text-xl font-bold text-slate-900">
          Eliminar rasgo
        </h3>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Este rasgo se quitará del personaje. Si además no esta enlazado a
          nadie más, también se limpiará del sistema. ¿Quieres continuar?
        </p>

        <label className="mt-4 flex items-center gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(event) => onRememberChoiceChange(event.target.checked)}
            className="h-4 w-4 border-slate-300 text-brand focus:ring-brand"
          />
          No volver a preguntarme hoy
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="border border-slate-200 bg-slate-100 px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em] text-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="bg-red-700 px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em] text-white"
          >
            Eliminar rasgo
          </button>
        </div>
      </div>
    </div>
  )
}

export function CreatorBadge({ creator, label = 'Creado por' }) {
  if (!creator) {
    return null
  }

  return (
    <Link
      to={`/app/perfiles/${creator.id}`}
      className="ml-auto flex min-w-[14rem] items-center justify-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-glow lg:max-w-[19rem]"
    >
      <div className="flex min-w-0 flex-col text-right">
        <span className="font-label text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
          {label}
        </span>
        <span className="truncate font-headline text-base font-bold text-slate-900">
          {creator.nombreUsuario}
        </span>
      </div>

      {creator.imagenPerfilUrl ? (
        <div className="h-11 w-11 overflow-hidden rounded-xl bg-slate-100">
          <CloudinaryImage
            src={creator.imagenPerfilUrl}
            alt={creator.nombreUsuario}
            variant="avatar"
            sizes="44px"
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-brand">
          <UserCircle2 className="h-5 w-5" />
        </div>
      )}
    </Link>
  )
}

export function CharacterDetailLoading() {
  return (
    <section className="grid gap-6">
      <div className="overflow-hidden bg-white shadow-card">
        <div className="theme-header-surface h-16" />
        <div className="mx-auto max-w-5xl px-8 py-10">
          <div className="h-10 w-80 bg-slate-200" />
          <div className="mt-5 h-[760px] bg-slate-100" />
        </div>
      </div>
    </section>
  )
}

export function CharacterDetailError() {
  return (
    <section className="grid gap-6">
      <article className="bg-white px-6 py-8 text-sm text-danger shadow-card">
        No se pudo cargar la ficha del personaje.
      </article>
    </section>
  )
}

export function CharacterSheetHeader({
  tabs,
  activeTab,
  characterId,
  characterName,
  onTabChange,
  onBack,
}) {
  return (
    <div className="theme-header-surface w-full overflow-hidden border-b-2 border-brand">
      <div className="px-4 py-3 sm:px-5">
        <div
          className="grid gap-0 border-b border-white/10"
          style={{
            gridTemplateColumns: `repeat(${Math.max(tabs.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange({ characterId, tab: tab.id })}
                className={clsx(
                  'min-h-[44px] px-1 py-2 text-center font-label text-[8px] font-black uppercase tracking-[0.04em] transition sm:min-h-[54px] sm:px-3 sm:py-3 sm:text-[10px] sm:tracking-[0.14em] lg:min-h-[58px] lg:text-[11px] lg:tracking-[0.18em]',
                  isActive
                    ? 'bg-white/5 text-brand'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="mt-4 grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 lg:relative lg:flex lg:justify-center">
          <button
            type="button"
            onClick={onBack}
            className="theme-header-button inline-flex h-11 w-11 items-center justify-center rounded-full border transition lg:absolute lg:left-0"
            aria-label="Volver atras"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <h1 className="min-w-0 break-words py-1 text-center font-headline text-lg font-black uppercase tracking-[0.14em] text-brand [overflow-wrap:anywhere] sm:text-2xl sm:tracking-[0.3em] lg:mx-auto lg:max-w-[min(40rem,100%)]">
            {characterName}
          </h1>
          <span className="h-11 w-11 lg:hidden" />
        </div>
      </div>

      <div className="py-1" />
    </div>
  )
}

export function CharacterVersionButtons({
  versions,
  characterId,
  locationState,
  preserveEditor,
  onBeforeNavigate,
}) {
  if (versions.length <= 1) {
    return null
  }

  return (
    <div className="mb-4 flex flex-wrap gap-2 sm:mb-5 sm:gap-3">
      {versions.map((item) => {
        const isActive = item.id === characterId

        return (
          <Link
            key={item.id}
            to={`/app/personajes/${item.id}`}
            state={{
              ...(locationState || {}),
              preserveCharacterEditor: preserveEditor,
            }}
            onClick={onBeforeNavigate}
            className={clsx(
              'min-w-[11rem] flex-1 border px-4 py-3 text-center font-label text-[10px] font-black uppercase tracking-[0.18em] transition sm:min-w-[13rem] sm:text-[11px]',
              isActive
                ? 'theme-header-surface border-brand text-brand theme-brand-outline'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            )}
          >
            {item.nombre}
          </Link>
        )
      })}
    </div>
  )
}

export function CharacterSheetActions({
  canEdit,
  isPreviewMode,
  isEditing,
  isSaving,
  isDeleting,
  creator,
  creatorLabel,
  saveLabel = 'Confirmar edicion',
  savingLabel = 'Guardando...',
  cancelLabel = 'Cancelar edicion',
  editLabel = 'Editar',
  deleteLabel = 'Eliminar',
  onStartEditing,
  onSaveEditing,
  onCancelEditing,
  onDelete,
}) {
  if (isPreviewMode) {
    return (
      <div className="mt-4 flex justify-end px-1">
        <CreatorBadge creator={creator} label={creatorLabel} />
      </div>
    )
  }

  return (
    <div className="mt-4 flex flex-col gap-4 px-1 lg:flex-row lg:items-end lg:justify-between">
      {canEdit ? (
        <div className="flex flex-wrap gap-3">
          {!isEditing ? (
            <>
              <button
                type="button"
                onClick={onStartEditing}
                className="theme-solid-button inline-flex items-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em]"
              >
                <Pencil className="h-4 w-4" />
                {editLabel}
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-md border border-danger/40 px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-danger transition hover:border-danger/60 hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? 'Eliminando...' : deleteLabel}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onSaveEditing}
                disabled={isSaving}
                className="theme-solid-button inline-flex items-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Save className="h-4 w-4" />
                {isSaving ? savingLabel : saveLabel}
              </button>
              <button
                type="button"
                onClick={onCancelEditing}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-md border border-stroke bg-surface-strong px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
              >
                <X className="h-4 w-4" />
                {cancelLabel}
              </button>
            </>
          )}
        </div>
      ) : (
        <div />
      )}

      <CreatorBadge creator={creator} label={creatorLabel} />
    </div>
  )
}

export function CharacterDeleteModal({
  open,
  characterName,
  entityLabel = 'personaje',
  confirmationText,
  isDeleting,
  error,
  onConfirmationTextChange,
  onClose,
  onConfirm,
}) {
  const [step, setStep] = useState('warning')

  if (!open) {
    return null
  }

  const canConfirm =
    String(confirmationText || '')
      .trim()
      .toUpperCase() === 'ELIMINAR'
  const handleClose = () => {
    setStep('warning')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
      <div className="w-full max-w-lg border border-red-200 bg-white p-6 shadow-2xl">
        <h3 className="font-headline text-2xl font-black text-slate-950">
          Eliminar {entityLabel}
        </h3>

        {step === 'warning' ? (
          <>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Vas a eliminar{' '}
              <span className="font-bold text-slate-950">
                {characterName || `este ${entityLabel}`}
              </span>
              . Esta accion borrara su ficha y no se podra deshacer.
            </p>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isDeleting}
                className="border border-slate-200 bg-slate-100 px-5 py-2.5 font-label text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={isDeleting}
                className="bg-red-700 px-5 py-2.5 font-label text-[10px] font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Si, continuar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Para confirmar el borrado definitivo, escribe{' '}
              <span className="font-black text-red-700">ELIMINAR</span> en
              mayusculas.
            </p>

            <input
              type="text"
              value={confirmationText}
              onChange={(event) => onConfirmationTextChange(event.target.value)}
              disabled={isDeleting}
              autoFocus
              className="mt-4 w-full border border-slate-200 bg-white px-4 py-3 font-label text-sm font-black uppercase tracking-[0.18em] text-slate-950 outline-none transition focus:border-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="ELIMINAR"
            />

            {error ? (
              <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isDeleting}
                className="border border-slate-200 bg-slate-100 px-5 py-2.5 font-label text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={!canConfirm || isDeleting}
                className="bg-red-700 px-5 py-2.5 font-label text-[10px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isDeleting ? 'Eliminando...' : 'Eliminar definitivamente'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function EditorModeBanner({ canUndo, canRedo, onUndo, onRedo }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-brand/20 bg-brand/5 px-4 py-3">
      <div>
        <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-brand">
          Modo edicion
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Estas editando la ficha directamente. Los cambios no se guardaran
          hasta confirmar.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="inline-flex h-10 w-10 items-center justify-center border border-slate-200 bg-white text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Deshacer"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="inline-flex h-10 w-10 items-center justify-center border border-slate-200 bg-white text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Rehacer"
        >
          <RotateCw className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function PreviewModeNotice({ show }) {
  if (!show) {
    return null
  }

  return (
    <div className="border border-slate-100 bg-slate-50/50 px-6 py-6">
      <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-brand">
        Vista previa
      </p>
      <p className="mt-3 text-sm leading-8 text-slate-600">
        Este personaje solo esta visible para tu cuenta en modo vista previa.
        Puedes consultar la cabecera y sus datos principales, pero no el bloque
        completo de rasgos.
      </p>
    </div>
  )
}

export function ScrollTopButton({ show, onClick }) {
  if (!show) {
    return null
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-6 right-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand text-black shadow-card transition hover:brightness-95 xl:right-[calc(var(--right-rail-width)+2rem)]"
      aria-label="Volver arriba"
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  )
}
