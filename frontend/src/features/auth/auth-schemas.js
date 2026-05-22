import { z } from 'zod'

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'El nombre debe tener al menos 3 caracteres.')
  .max(50, 'El nombre no puede superar los 50 caracteres.')
  .regex(
    /^[A-Za-z0-9_ñÑ]+$/u,
    'Solo puedes usar letras, numeros, ñ y guiones bajos.'
  )

const passwordSchema = z
  .string()
  .min(10, 'La contrasena debe tener al menos 10 caracteres.')
  .max(100, 'La contrasena es demasiado larga.')

export const loginSchema = z.object({
  nombreUsuario: usernameSchema,
  contrasena: z.string().min(1, 'Introduce tu contrasena.'),
  mantenerSesion: z.boolean().optional(),
})

export const registerSchema = z
  .object({
    nombreUsuario: usernameSchema,
    contrasena: passwordSchema,
    confirmarContrasena: z.string().min(1, 'Confirma tu contrasena.'),
    claveRegistro: z
      .string()
      .trim()
      .min(1, 'Necesitas la clave secreta de registro.'),
    mantenerSesion: z.boolean().optional(),
  })
  .refine((value) => value.contrasena === value.confirmarContrasena, {
    message: 'Las contrasenas no coinciden.',
    path: ['confirmarContrasena'],
  })
