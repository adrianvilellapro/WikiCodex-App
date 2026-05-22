import { Fragment, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  MessageCircle,
  Pencil,
  Save,
  Send,
  Trash2,
  UserCircle2,
  X,
} from 'lucide-react'

import { useAuth } from '../../features/auth/auth-context'
import { CloudinaryImage } from '../ui/CloudinaryImage'
import {
  createComment,
  deleteComment,
  fetchComments,
  updateComment,
} from './api'

const COMMENT_MAX_LENGTH = 250

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    'No se pudo completar la acción.'
  )
}

function getCommentQueryKey(targetType, targetId) {
  return ['comments', targetType, targetId]
}

function clampComment(value) {
  return String(value || '').slice(0, COMMENT_MAX_LENGTH)
}

function formatDate(value) {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function splitCommentText(text) {
  const parts = []
  const pattern = /(\*\*[^*]+\*\*|==[^=]+==|\*[^*\n]+\*)/g
  let lastIndex = 0
  let match

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }

    const value = match[0]

    if (value.startsWith('**')) {
      parts.push({ type: 'bold', value: value.slice(2, -2) })
    } else if (value.startsWith('==')) {
      parts.push({ type: 'highlight', value: value.slice(2, -2) })
    } else {
      parts.push({ type: 'italic', value: value.slice(1, -1) })
    }

    lastIndex = match.index + value.length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return parts
}

function CommentText({ text }) {
  return splitCommentText(String(text || '')).map((part, index) => {
    const key = `${part.type}-${index}`

    if (part.type === 'bold') {
      return (
        <strong key={key} className="font-bold text-ink">
          {part.value}
        </strong>
      )
    }

    if (part.type === 'italic') {
      return (
        <em key={key} className="italic">
          {part.value}
        </em>
      )
    }

    if (part.type === 'highlight') {
      return (
        <mark
          key={key}
          className="rounded bg-brand/15 px-1 font-semibold text-brand"
        >
          {part.value}
        </mark>
      )
    }

    return <Fragment key={key}>{part.value}</Fragment>
  })
}

function CommentAuthor({ author, isMine }) {
  const label = isMine ? 'Tú' : author?.nombreUsuario || 'Usuario oculto'

  return (
    <div className="flex min-w-0 items-center gap-3">
      {author?.imagenPerfilUrl ? (
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-surface-strong">
          <CloudinaryImage
            src={author.imagenPerfilUrl}
            alt={label}
            variant="avatar"
            sizes="36px"
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-strong text-brand">
          <UserCircle2 className="h-4 w-4" />
        </div>
      )}

      <div className="min-w-0">
        <p className="truncate font-headline text-sm font-bold text-ink">
          {label}
        </p>
        <p className="text-[11px] font-semibold text-ink-soft">
          {author ? 'Comentario' : 'Identidad no visible'}
        </p>
      </div>
    </div>
  )
}

function CommentEditor({
  value,
  onChange,
  onSubmit,
  onCancel,
  isSaving,
  submitLabel,
  textareaLabel,
}) {
  const safeValue = clampComment(value)
  const remaining = COMMENT_MAX_LENGTH - safeValue.length
  const canSubmit = safeValue.trim().length > 0 && !isSaving

  return (
    <div className="grid gap-3">
      <label className="block">
        <span className="sr-only">{textareaLabel}</span>
        <textarea
          value={safeValue}
          maxLength={COMMENT_MAX_LENGTH}
          rows={3}
          onChange={(event) => onChange(clampComment(event.target.value))}
          placeholder="Escribe un comentario breve..."
          className="archive-input min-h-24 resize-y rounded-lg"
        />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
          {remaining} caracteres restantes
        </span>
        <div className="flex flex-wrap gap-2">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-stroke bg-surface-strong px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="theme-solid-button inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submitLabel === 'Guardar' ? (
              <Save className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isSaving ? 'Guardando...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function CommentItem({
  comment,
  isEditing,
  editValue,
  onEditValueChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  isSaving,
  isDeleting,
}) {
  return (
    <article className="theme-sheet-card border border-stroke p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <CommentAuthor author={comment.autor} isMine={comment.esMio} />
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {comment.puedeEditar && !isEditing ? (
            <button
              type="button"
              onClick={() => onStartEdit(comment)}
              className="inline-flex items-center gap-2 rounded-md border border-stroke bg-surface-strong px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-soft transition hover:border-brand hover:text-brand"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
          ) : null}
          {comment.puedeEliminar ? (
            <button
              type="button"
              onClick={() => onDelete(comment)}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 rounded-md border border-danger/40 px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] text-danger transition hover:border-danger/60 hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isDeleting ? 'Borrando...' : 'Borrar'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        {isEditing ? (
          <CommentEditor
            value={editValue}
            onChange={onEditValueChange}
            onSubmit={() => onSaveEdit(comment)}
            onCancel={onCancelEdit}
            isSaving={isSaving}
            submitLabel="Guardar"
            textareaLabel="Editar comentario"
          />
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft [overflow-wrap:anywhere]">
            <CommentText text={comment.contenido} />
          </p>
        )}
      </div>

      <p className="mt-3 text-[11px] font-semibold text-ink-muted">
        {formatDate(comment.creadoEn)}
        {comment.estaEditado ? ' · editado' : ''}
      </p>
    </article>
  )
}

export function CommentsSection({ targetType, targetId, className = '' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const queryKey = useMemo(
    () => getCommentQueryKey(targetType, targetId),
    [targetType, targetId]
  )

  const commentsQuery = useQuery({
    queryKey,
    queryFn: () => fetchComments(targetType, targetId),
    enabled: Boolean(targetType && targetId && user),
  })

  const createMutation = useMutation({
    mutationFn: () => createComment(targetType, targetId, draft.trim()),
    onSuccess: () => {
      setDraft('')
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ commentId, contenido }) =>
      updateComment(commentId, contenido),
    onSuccess: () => {
      setEditingId(null)
      setEditDraft('')
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId) => deleteComment(commentId),
    onSuccess: () => {
      setEditingId(null)
      setEditDraft('')
      queryClient.invalidateQueries({ queryKey })
    },
  })

  if (!targetType || !targetId) {
    return null
  }

  const comments = commentsQuery.data?.items || []
  const myComment = commentsQuery.data?.miComentario || null
  const total = commentsQuery.data?.meta?.total || 0
  const error =
    commentsQuery.error ||
    createMutation.error ||
    updateMutation.error ||
    deleteMutation.error

  return (
    <section
      className={`mx-auto w-full max-w-[84rem] px-4 sm:px-5 md:px-6 xl:px-6 ${className}`}
    >
      <div className="theme-sheet-soft overflow-hidden rounded-xl border border-stroke/80">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
        >
          <span className="inline-flex min-w-0 items-center gap-3">
            <MessageCircle className="h-4 w-4 shrink-0 text-brand" />
            <span className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-ink-soft">
              Comentarios
            </span>
            <span className="rounded-full border border-stroke bg-surface px-2 py-0.5 text-xs font-bold text-ink-muted">
              {commentsQuery.isLoading ? '...' : total}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-brand transition ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isOpen ? (
          <div className="grid gap-4 border-t border-stroke/70 px-4 py-4 sm:px-5">
            {commentsQuery.isLoading ? (
              <p className="text-sm font-semibold text-ink-soft">
                Cargando comentarios...
              </p>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
                {getErrorMessage(error)}
              </p>
            ) : null}

            {!myComment && !commentsQuery.isLoading ? (
              <CommentEditor
                value={draft}
                onChange={setDraft}
                onSubmit={() => createMutation.mutate()}
                isSaving={createMutation.isPending}
                submitLabel="Comentar"
                textareaLabel="Nuevo comentario"
              />
            ) : null}

            {myComment ? (
              <p className="rounded-lg border border-brand/20 bg-brand/10 px-4 py-3 text-xs font-bold text-ink-soft">
                Ya has dejado un comentario en este elemento. Puedes editarlo o
                borrarlo desde la lista.
              </p>
            ) : null}

            <div className="grid gap-3">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  isEditing={editingId === comment.id}
                  editValue={editDraft}
                  onEditValueChange={setEditDraft}
                  onStartEdit={(item) => {
                    setEditingId(item.id)
                    setEditDraft(item.contenido)
                  }}
                  onCancelEdit={() => {
                    setEditingId(null)
                    setEditDraft('')
                  }}
                  onSaveEdit={(item) =>
                    updateMutation.mutate({
                      commentId: item.id,
                      contenido: editDraft.trim(),
                    })
                  }
                  onDelete={(item) => deleteMutation.mutate(item.id)}
                  isSaving={
                    editingId === comment.id && updateMutation.isPending
                  }
                  isDeleting={deleteMutation.isPending}
                />
              ))}
            </div>

            {!commentsQuery.isLoading && !comments.length ? (
              <p className="rounded-lg border border-dashed border-stroke bg-surface px-4 py-5 text-sm font-semibold text-ink-soft">
                Todavía no hay comentarios.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
