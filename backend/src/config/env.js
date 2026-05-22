const dotenv = require('dotenv')
const { z } = require('zod')

dotenv.config()

const DEVELOPMENT_DEFAULTS = {
  JWT_SECRET: 'change-this-in-development',
  ACCOUNT_REGISTRATION_CODE: 'change-this-code',
  ADMIN_ZONE_PASSWORD: 'change-this-admin-zone-key',
}

const envSchema = z
  .object({
    PORT: z.coerce.number().default(4000),
    FRONTEND_URL: z.string().url().default('http://localhost:5173'),
    DATABASE_URL: z.string().min(1),
    PRISMA_LOG_QUERIES: z.enum(['true', 'false']).optional().default('false'),
    JWT_SECRET: z.string().min(1).default(DEVELOPMENT_DEFAULTS.JWT_SECRET),
    JWT_EXPIRES_IN: z.string().min(1).default('7d'),
    JWT_ISSUER: z.string().min(1).default('wikicodex-backend'),
    JWT_AUDIENCE: z.string().min(1).default('wikicodex-app'),
    ACCOUNT_REGISTRATION_CODE: z
      .string()
      .min(1)
      .default(DEVELOPMENT_DEFAULTS.ACCOUNT_REGISTRATION_CODE),
    ADMIN_ZONE_PASSWORD: z
      .string()
      .min(10)
      .default(DEVELOPMENT_DEFAULTS.ADMIN_ZONE_PASSWORD),
    ADMIN_DESTRUCTIVE_PASSWORD: z
      .string()
      .min(10, 'ADMIN_DESTRUCTIVE_PASSWORD must be configured.'),
    CLOUDINARY_CLOUD_NAME: z.string().min(1),
    CLOUDINARY_API_KEY: z.string().min(1),
    CLOUDINARY_API_SECRET: z.string().min(1),
    CLOUDINARY_FOLDER_ROOT: z.string().min(1).default('wikicodex'),
    CLOUDINARY_ALLOWED_IMAGE_FORMATS: z
      .string()
      .min(1)
      .default('jpg,jpeg,png,webp,avif'),
    CLOUDINARY_IMAGE_MAX_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(768000),
  })
  .superRefine((value, ctx) => {
    if (process.env.NODE_ENV !== 'production') {
      return
    }

    for (const [key, defaultValue] of Object.entries(DEVELOPMENT_DEFAULTS)) {
      if (value[key] === defaultValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} must be changed before running in production.`,
        })
      }
    }
  })

const env = envSchema.parse(process.env)

module.exports = {
  env,
}
