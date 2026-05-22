import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { TextField } from '../components/ui/TextField'
import { useAuth } from '../features/auth/auth-context'
import { loginSchema, registerSchema } from '../features/auth/auth-schemas'
import { cn } from '../lib/cn'

function PasswordField({
  label,
  hint,
  error,
  className,
  inputClassName,
  visible,
  onToggleVisible,
  ...props
}) {
  const Icon = visible ? EyeOff : Eye

  return (
    <label
      className={cn(
        'flex flex-col gap-2 font-label text-sm text-ink-soft',
        className
      )}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">
        {label}
      </span>
      <span className="relative block">
        <input
          {...props}
          type={visible ? 'text' : 'password'}
          className={cn(
            'archive-input w-full pr-12 text-base',
            error && 'bg-danger/5 text-danger focus:bg-danger/5',
            inputClassName
          )}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface-strong hover:text-ink"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          <Icon className="h-4 w-4" />
        </button>
      </span>
      {error ? (
        <span className="font-body text-sm text-danger">{error}</span>
      ) : hint ? (
        <span className="font-body text-sm text-ink-muted">{hint}</span>
      ) : null}
    </label>
  )
}

function AuthPanel({ mode, onModeChange }) {
  const navigate = useNavigate()
  const { login, register, normalizeApiError } = useAuth()
  const [serverError, setServerError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [visibleFields, setVisibleFields] = useState({})

  const isRegisterMode = mode === 'register'
  const form = useForm({
    resolver: zodResolver(isRegisterMode ? registerSchema : loginSchema),
    shouldUnregister: true,
    defaultValues: {
      nombreUsuario: '',
      contrasena: '',
      confirmarContrasena: '',
      claveRegistro: '',
      mantenerSesion: false,
    },
  })

  function togglePasswordField(fieldName) {
    setVisibleFields((current) => ({
      ...current,
      [fieldName]: !current[fieldName],
    }))
  }

  async function onSubmit(values) {
    setServerError('')
    setIsSubmitting(true)

    try {
      if (isRegisterMode) {
        await register(
          {
            nombreUsuario: values.nombreUsuario.trim(),
            contrasena: values.contrasena,
            claveRegistro: values.claveRegistro.trim(),
          },
          {
            persist: Boolean(values.mantenerSesion),
          }
        )
      } else {
        await login(
          {
            nombreUsuario: values.nombreUsuario.trim(),
            contrasena: values.contrasena,
          },
          {
            persist: Boolean(values.mantenerSesion),
          }
        )
      }

      navigate('/app', { replace: true })
    } catch (error) {
      setServerError(
        normalizeApiError(
          error,
          isRegisterMode
            ? 'No se pudo crear la cuenta. Revisa los datos e inténtalo otra vez.'
            : 'No se pudo iniciar sesión. Revisa tus credenciales.'
        )
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="panel-strong relative overflow-hidden p-6 sm:p-8">
      <div className="absolute -right-16 top-0 h-40 w-40 bg-accent/10 blur-3xl" />

      <div className="relative flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-label text-[11px] font-bold uppercase tracking-[0.22em] text-brand">
              Acceso privado
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.04em] text-ink sm:text-5xl">
              Entra al archivo
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-lg border border-stroke bg-surface-strong p-1 text-sm">
            <button
              type="button"
              onClick={() => {
                form.reset({
                  nombreUsuario: '',
                  contrasena: '',
                  confirmarContrasena: '',
                  claveRegistro: '',
                  mantenerSesion: false,
                })
                setVisibleFields({})
                onModeChange('login')
              }}
              className={cn(
                'rounded-md px-4 py-2.5 font-label text-[11px] font-bold uppercase tracking-[0.14em] transition',
                !isRegisterMode
                  ? 'bg-brand text-black shadow-card'
                  : 'text-ink-soft hover:bg-white/70 hover:text-ink'
              )}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                form.reset({
                  nombreUsuario: '',
                  contrasena: '',
                  confirmarContrasena: '',
                  claveRegistro: '',
                  mantenerSesion: false,
                })
                setVisibleFields({})
                onModeChange('register')
              }}
              className={cn(
                'rounded-md px-4 py-2.5 font-label text-[11px] font-bold uppercase tracking-[0.14em] transition',
                isRegisterMode
                  ? 'bg-brand text-black shadow-card'
                  : 'text-ink-soft hover:bg-white/70 hover:text-ink'
              )}
            >
              Crear cuenta
            </button>
          </div>
        </div>

        <form
          key={mode}
          noValidate
          autoComplete="off"
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4 rounded-lg bg-white p-4 sm:p-5"
        >
          <TextField
            label="Nombre de usuario"
            placeholder="Tu nombre de usuario"
            autoComplete="off"
            spellCheck={false}
            error={form.formState.errors.nombreUsuario?.message}
            inputClassName="archive-input"
            {...form.register('nombreUsuario')}
          />

          <PasswordField
            label="Contraseña"
            placeholder={
              isRegisterMode ? 'Mínimo 10 caracteres' : 'Tu contraseña'
            }
            autoComplete="new-password"
            spellCheck={false}
            error={form.formState.errors.contrasena?.message}
            inputClassName="archive-input"
            visible={Boolean(visibleFields.contrasena)}
            onToggleVisible={() => togglePasswordField('contrasena')}
            {...form.register('contrasena')}
          />

          {isRegisterMode ? (
            <>
              <PasswordField
                label="Confirmar contraseña"
                placeholder="Repite la contraseña"
                autoComplete="new-password"
                spellCheck={false}
                error={form.formState.errors.confirmarContrasena?.message}
                inputClassName="archive-input"
                visible={Boolean(visibleFields.confirmarContrasena)}
                onToggleVisible={() =>
                  togglePasswordField('confirmarContrasena')
                }
                {...form.register('confirmarContrasena')}
              />

              <PasswordField
                label="Clave secreta de registro"
                placeholder="Necesaria para unirte a la aplicación"
                autoComplete="new-password"
                spellCheck={false}
                hint="Solo las personas con la clave pueden crear cuenta."
                error={form.formState.errors.claveRegistro?.message}
                inputClassName="archive-input"
                visible={Boolean(visibleFields.claveRegistro)}
                onToggleVisible={() => togglePasswordField('claveRegistro')}
                {...form.register('claveRegistro')}
              />
            </>
          ) : null}

          <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-surface-strong px-4 py-3 text-sm text-ink-soft">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
              {...form.register('mantenerSesion')}
            />
            <span className="block font-label text-[10px] font-bold uppercase tracking-[0.16em] text-ink">
              Mantener sesion iniciada
            </span>
          </label>

          {serverError ? (
            <div className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
              {serverError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="theme-brand-gradient-button mt-2 inline-flex items-center justify-center gap-2 rounded-md px-5 py-3.5 font-label text-[11px] font-bold uppercase tracking-[0.16em] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <KeyRound className="h-4 w-4" />
            {isSubmitting
              ? isRegisterMode
                ? 'Creando cuenta...'
                : 'Entrando...'
              : isRegisterMode
                ? 'Crear cuenta y entrar'
                : 'Entrar en WikiCodex'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function AuthPage() {
  const [mode, setMode] = useState('login')

  return (
    <div className="min-h-screen bg-surface px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden rounded-xl bg-surface-strong lg:grid-cols-[340px_1fr]">
        <aside className="relative hidden bg-[#121212] px-8 py-8 text-white lg:flex lg:flex-col">
          <Link to="/" className="inline-flex w-fit">
            <span className="font-display text-3xl font-bold tracking-[-0.06em] text-white">
              <span className="text-brand">W</span>iki
              <span className="text-brand">C</span>odex
            </span>
          </Link>

          <div className="mt-auto rounded-lg bg-white/6 px-4 py-4 backdrop-blur">
            <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
              Entrada segura
            </p>
            <p className="mt-2 text-sm leading-6 text-white/72">
              Solo necesitas tu nombre, tu contraseña y la clave de registro del
              grupo.
            </p>
          </div>
        </aside>

        <div className="flex items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-xl">
            <AuthPanel mode={mode} onModeChange={setMode} />
          </div>
        </div>
      </div>
    </div>
  )
}
