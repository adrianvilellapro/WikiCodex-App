const { Router } = require('express')
const { z } = require('zod')

const { prisma } = require('../lib/prisma')
const { asyncHandler } = require('../lib/async-handler')
const { requireAuth } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const {
  requireCampaignReadAccess,
  getCampaignRoleContext,
} = require('../services/campaign-access.service')
const {
  requireCharacterViewAccess,
  requireCharacterEditAccess,
  serializeCharacter,
  serializeCharacterDetail,
} = require('../services/character-access.service')
const {
  buildVisibleCharacterWhere,
  getCharacterArchiveMetadata,
  listCharacterArchivePage,
  listVisibleCharactersPage,
} = require('../services/character-list.service')
const {
  cloneCharacter,
  createCharacterVersion,
  listCharacterVersions,
} = require('../services/character-version.service')
const {
  getCharacterCreationEditorMetadata,
  getCharacterEditorMetadata,
  saveCharacterEditorDraft,
  searchLinkableCharacterObjects,
  searchLinkableCharacterPowers,
  setCharacterObjectTraitDisplay,
} = require('../services/character-editor.service')
const {
  notifyMastersOfCampaignEntryCreated,
} = require('../services/notification.service')
const { createHttpError } = require('../lib/errors')
const { logEntityChange } = require('../lib/audit')
const {
  assertManagedImageUrl,
  cleanupCloudinaryAssets,
} = require('../lib/media')

const charactersRouter = Router()

const visibilityCodes = [
  'privado',
  'usuarios_seleccionados',
  'campana_vista_previa',
  'campana_completo',
]

const longTextField = z.string().trim().nullable().optional()
const traitDescriptionField = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: 'La descripcion del rasgo no puede quedar vacia.',
  })
const CHARACTER_NAME_MAX_LENGTH = 250
const CHARACTER_TITLE_MAX_LENGTH = 400
const MAX_GENERAL_NUMBER = 9_999_999_999
const MAX_SPEED_NUMBER = 9_999_999_999_999
const MAX_COMPETENCE = 1000
const MAX_ABILITY_SCORE = 10_000
const MAX_SAVING_THROW = 100_000
const CLASS_NAME_MAX_LENGTH = 100
const SUBCLASS_NAME_MAX_LENGTH = 100
const MAX_CLASS_LEVEL = 1000

const listCampaignCharactersSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    campaignId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const listRecentCharactersSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(20).optional(),
  }),
})

const optionalQueryNumber = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) {
    return undefined
  }

  if (typeof value === 'string') {
    return Number(value.trim().replace(',', '.'))
  }

  return value
}, z.number().min(0).optional())

const listCharactersSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(500).optional(),
      cursor: z.string().min(1).optional(),
      view: z
        .enum(['characters', 'bestiary', 'tierlist'])
        .optional()
        .default('characters'),
      q: z.string().trim().max(120).optional().default(''),
      matchMode: z.enum(['all', 'any']).optional().default('all'),
      sort: z
        .enum([
          'created_desc',
          'created_asc',
          'name_asc',
          'name_desc',
          'age_asc',
          'age_desc',
          'height_asc',
          'height_desc',
          'weight_asc',
          'weight_desc',
        ])
        .optional()
        .default('created_desc'),
      categoryIds: z.string().trim().max(5000).optional().default(''),
      tierIds: z.string().trim().max(5000).optional().default(''),
      campaignIds: z.string().trim().max(5000).optional().default(''),
      estadoCodigos: z.string().trim().max(120).optional().default(''),
      ageMin: optionalQueryNumber,
      ageMax: optionalQueryNumber,
      heightMin: optionalQueryNumber,
      heightMax: optionalQueryNumber,
      weightMin: optionalQueryNumber,
      weightMax: optionalQueryNumber,
    })
    .strict(),
})

const characterArchiveOptionsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

const createCharacterSchema = z.object({
  body: z
    .object({
      nombre: z.string().trim().min(1).max(CHARACTER_NAME_MAX_LENGTH),
      titulo: z
        .string()
        .trim()
        .max(CHARACTER_TITLE_MAX_LENGTH)
        .nullable()
        .optional(),
      descripcion: longTextField,
      imagenPrincipalUrl: z.string().url().nullable().optional(),
      aventuraId: z.string().uuid().nullable().optional(),
      ambitoVisibilidadCodigo: z.enum(visibilityCodes).optional(),
      propietarioUsuarioId: z.string().uuid().nullable().optional(),
    })
    .strict(),
  params: z.object({
    campaignId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const characterIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    characterId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const savedTraitIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    traitId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const updateCharacterSchema = z.object({
  body: z
    .object({
      nombre: z
        .string()
        .trim()
        .min(1)
        .max(CHARACTER_NAME_MAX_LENGTH)
        .optional(),
      titulo: z
        .string()
        .trim()
        .max(CHARACTER_TITLE_MAX_LENGTH)
        .nullable()
        .optional(),
      descripcion: longTextField,
      imagenPrincipalUrl: z.string().url().nullable().optional(),
      lore: longTextField,
      edad: z.number().int().min(0).nullable().optional(),
      ambitoVisibilidadCodigo: z.enum(visibilityCodes).optional(),
    })
    .strict(),
  params: z.object({
    characterId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const createVersionSchema = z.object({
  body: z
    .object({
      campanaIdDestino: z.string().uuid().optional(),
      aventuraIdDestino: z.string().uuid().nullable().optional(),
      propietarioUsuarioIdDestino: z.string().uuid().nullable().optional(),
      ambitoVisibilidadCodigoDestino: z.enum(visibilityCodes).optional(),
      copiarRelaciones: z.boolean().optional(),
      nombre: z
        .string()
        .trim()
        .min(1)
        .max(CHARACTER_NAME_MAX_LENGTH)
        .optional(),
      titulo: z
        .string()
        .trim()
        .max(CHARACTER_TITLE_MAX_LENGTH)
        .nullable()
        .optional(),
      descripcion: longTextField,
      imagenPrincipalUrl: z.string().url().nullable().optional(),
      lore: longTextField,
    })
    .strict(),
  params: z.object({
    characterId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const cloneCharacterSchema = z.object({
  body: z
    .object({
      campanaIdDestino: z.string().uuid(),
      aventuraIdDestino: z.string().uuid().nullable().optional(),
      propietarioUsuarioIdDestino: z.string().uuid().nullable().optional(),
      ambitoVisibilidadCodigoDestino: z.enum(visibilityCodes).optional(),
      copiarRelaciones: z.boolean().optional(),
      vincularComoVersion: z.boolean().optional(),
      personajeBaseId: z.string().uuid().nullable().optional(),
      nombre: z
        .string()
        .trim()
        .min(1)
        .max(CHARACTER_NAME_MAX_LENGTH)
        .optional(),
      titulo: z
        .string()
        .trim()
        .max(CHARACTER_TITLE_MAX_LENGTH)
        .nullable()
        .optional(),
      descripcion: longTextField,
      imagenPrincipalUrl: z.string().url().nullable().optional(),
      lore: longTextField,
    })
    .strict(),
  params: z.object({
    characterId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const editorPayloadSchema = z.object({
  body: z
    .object({
      core: z
        .object({
          campanaId: z.string().uuid().optional(),
          aventuraId: z.string().uuid().nullable().optional(),
          partidaAparicionId: z.string().uuid().nullable().optional(),
          partidaDefuncionId: z.string().uuid().nullable().optional(),
          propietarioUsuarioId: z.string().uuid().optional(),
          personajeBaseId: z.string().uuid().nullable().optional(),
          tierId: z.string().uuid().nullable().optional(),
          estadoId: z.string().uuid().nullable().optional(),
          nombre: z
            .string()
            .trim()
            .min(1)
            .max(CHARACTER_NAME_MAX_LENGTH)
            .optional(),
          titulo: z
            .string()
            .trim()
            .max(CHARACTER_TITLE_MAX_LENGTH)
            .nullable()
            .optional(),
          imagenPrincipalUrl: z.string().url().nullable().optional(),
          descripcion: longTextField,
          lore: longTextField,
          edad: z
            .number()
            .int()
            .min(0)
            .max(MAX_SPEED_NUMBER)
            .nullable()
            .optional(),
          alturaMetros: z
            .number()
            .nonnegative()
            .max(MAX_GENERAL_NUMBER)
            .nullable()
            .optional(),
          pesoKg: z
            .number()
            .nonnegative()
            .max(MAX_GENERAL_NUMBER)
            .nullable()
            .optional(),
          esCriatura: z.boolean().optional(),
          puntosGolpe: z
            .number()
            .int()
            .nonnegative()
            .max(MAX_GENERAL_NUMBER)
            .nullable()
            .optional(),
          claseArmadura: z
            .number()
            .int()
            .nonnegative()
            .max(MAX_GENERAL_NUMBER)
            .nullable()
            .optional(),
          velocidadPies: z
            .number()
            .int()
            .nonnegative()
            .max(MAX_SPEED_NUMBER)
            .nullable()
            .optional(),
          velocidadMetros: z
            .number()
            .nonnegative()
            .max(MAX_SPEED_NUMBER)
            .nullable()
            .optional(),
          bonificadorCompetencia: z
            .number()
            .int()
            .min(0)
            .max(MAX_COMPETENCE)
            .nullable()
            .optional(),
          iniciativa: z
            .number()
            .int()
            .min(0)
            .max(MAX_GENERAL_NUMBER)
            .nullable()
            .optional(),
          percepcionPasiva: z
            .number()
            .int()
            .nonnegative()
            .max(MAX_GENERAL_NUMBER)
            .nullable()
            .optional(),
          investigacionPasiva: z
            .number()
            .int()
            .nonnegative()
            .max(MAX_GENERAL_NUMBER)
            .nullable()
            .optional(),
          puntosExperiencia: z
            .number()
            .int()
            .nonnegative()
            .max(MAX_GENERAL_NUMBER)
            .nullable()
            .optional(),
          fuerza: z
            .number()
            .int()
            .min(0)
            .max(MAX_ABILITY_SCORE)
            .nullable()
            .optional(),
          destreza: z
            .number()
            .int()
            .min(0)
            .max(MAX_ABILITY_SCORE)
            .nullable()
            .optional(),
          constitucion: z
            .number()
            .int()
            .min(0)
            .max(MAX_ABILITY_SCORE)
            .nullable()
            .optional(),
          inteligencia: z
            .number()
            .int()
            .min(0)
            .max(MAX_ABILITY_SCORE)
            .nullable()
            .optional(),
          sabiduria: z
            .number()
            .int()
            .min(0)
            .max(MAX_ABILITY_SCORE)
            .nullable()
            .optional(),
          carisma: z
            .number()
            .int()
            .min(0)
            .max(MAX_ABILITY_SCORE)
            .nullable()
            .optional(),
          salvacionFuerza: z
            .number()
            .int()
            .min(0)
            .max(MAX_SAVING_THROW)
            .nullable()
            .optional(),
          salvacionDestreza: z
            .number()
            .int()
            .min(0)
            .max(MAX_SAVING_THROW)
            .nullable()
            .optional(),
          salvacionConstitucion: z
            .number()
            .int()
            .min(0)
            .max(MAX_SAVING_THROW)
            .nullable()
            .optional(),
          salvacionInteligencia: z
            .number()
            .int()
            .min(0)
            .max(MAX_SAVING_THROW)
            .nullable()
            .optional(),
          salvacionSabiduria: z
            .number()
            .int()
            .min(0)
            .max(MAX_SAVING_THROW)
            .nullable()
            .optional(),
          salvacionCarisma: z
            .number()
            .int()
            .min(0)
            .max(MAX_SAVING_THROW)
            .nullable()
            .optional(),
          competenciaSalvacionFuerza: z.boolean().optional(),
          competenciaSalvacionDestreza: z.boolean().optional(),
          competenciaSalvacionConstitucion: z.boolean().optional(),
          competenciaSalvacionInteligencia: z.boolean().optional(),
          competenciaSalvacionSabiduria: z.boolean().optional(),
          competenciaSalvacionCarisma: z.boolean().optional(),
        })
        .partial()
        .optional(),
      categorias: z
        .array(
          z.object({
            id: z.string().uuid().nullable().optional(),
            nombre: z.string().trim().min(1).max(120),
          })
        )
        .optional(),
      clases: z
        .array(
          z.object({
            claseNombre: z.string().trim().min(1).max(CLASS_NAME_MAX_LENGTH),
            subclaseNombre: z
              .string()
              .trim()
              .max(SUBCLASS_NAME_MAX_LENGTH)
              .nullable()
              .optional(),
            nivelClase: z.number().int().min(1).max(MAX_CLASS_LEVEL),
          })
        )
        .optional(),
      rasgosAgrupados: z
        .array(
          z.object({
            tipoRasgoId: z.string().uuid(),
            rasgos: z.array(
              z.object({
                id: z.string().uuid().nullable().optional(),
                nombre: z.string().trim().min(1).max(200),
                descripcion: traitDescriptionField,
                esReutilizable: z.boolean().optional(),
                origenTipo: z.string().trim().max(40).nullable().optional(),
                origenEntidadId: z.string().uuid().nullable().optional(),
                origenEntidadNombre: z
                  .string()
                  .trim()
                  .max(200)
                  .nullable()
                  .optional(),
                origenGrupoId: z.string().trim().max(200).nullable().optional(),
                origenRasgoClave: z
                  .string()
                  .trim()
                  .max(200)
                  .nullable()
                  .optional(),
                origenRasgoNombre: z
                  .string()
                  .trim()
                  .max(200)
                  .nullable()
                  .optional(),
                origenDatos: z.record(z.string(), z.any()).optional(),
              })
            ),
          })
        )
        .optional(),
      hechizos: z
        .array(
          z.object({
            hechizoId: z.string().uuid(),
          })
        )
        .optional(),
      hechizosSlots: z
        .record(z.string(), z.number().int().min(0).max(999))
        .optional(),
      objetos: z
        .array(
          z.object({
            objetoId: z.string().uuid(),
            mostrarRasgosEnFicha: z.boolean().optional(),
          })
        )
        .optional(),
      poderes: z
        .array(
          z.object({
            poderId: z.string().uuid(),
          })
        )
        .optional(),
      temasMusicales: z
        .array(
          z.object({
            id: z.string().uuid().nullable().optional(),
            titulo: z.string().trim().max(200).nullable().optional(),
            musicaUrl: z.string().url(),
          })
        )
        .optional(),
      galeriaImagenes: z
        .array(
          z.object({
            id: z.string().uuid().nullable().optional(),
            imagenUrl: z.string().url(),
          })
        )
        .optional(),
      privacidad: z
        .object({
          mode: z.enum(['private', 'public', 'preview', 'custom']).optional(),
          userPermissions: z
            .array(
              z.object({
                usuarioId: z.string().uuid(),
                nivelAccesoCodigo: z.enum([
                  'sin_acceso',
                  'vista_previa',
                  'completo',
                ]),
              })
            )
            .optional(),
        })
        .optional(),
    })
    .strict(),
  params: z.object({
    characterId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const createEditorPayloadSchema = z.object({
  body: editorPayloadSchema.shape.body,
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

const linkableCharacterAssetSearchSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      q: z.string().trim().max(120).optional().default(''),
      limit: z.coerce.number().int().min(1).max(30).optional().default(20),
    })
    .strict(),
})

const characterObjectTraitDisplaySchema = z.object({
  body: z
    .object({
      mostrarRasgosEnFicha: z.boolean(),
    })
    .strict(),
  params: z.object({
    characterId: z.string().uuid(),
    objectId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

function parseCsvValues(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseOptionalNumber(value) {
  return Number.isFinite(value) ? value : null
}

charactersRouter.use(requireAuth)

charactersRouter.get(
  '/recent',
  validate(listRecentCharactersSchema),
  asyncHandler(async (req, res) => {
    const limit = req.validated.query.limit || 20

    const totalVisible =
      req.auth.roleCode === 'administrador'
        ? await prisma.personajes.count()
        : await prisma.personajes.count({
            where: buildVisibleCharacterWhere(req.auth.userId),
          })
    const page = await listVisibleCharactersPage({
      req,
      limit,
    })

    res.json({
      items: page.items,
      meta: {
        limit,
        returned: page.items.length,
        totalVisible,
      },
    })
  })
)

charactersRouter.get(
  '/',
  validate(listCharactersSchema),
  asyncHandler(async (req, res) => {
    const limit = req.validated.query.limit || 30
    const cursor = req.validated.query.cursor || null
    const query = req.validated.query
    const page = await listCharacterArchivePage({
      req,
      limit,
      cursor,
      filters: {
        view: query.view,
        q: query.q,
        matchMode: query.matchMode,
        sort: query.sort,
        categoryIds: parseCsvValues(query.categoryIds),
        tierIds: parseCsvValues(query.tierIds),
        campaignIds: parseCsvValues(query.campaignIds),
        estadoCodigos: parseCsvValues(query.estadoCodigos),
        ageMin: parseOptionalNumber(query.ageMin),
        ageMax: parseOptionalNumber(query.ageMax),
        heightMin: parseOptionalNumber(query.heightMin),
        heightMax: parseOptionalNumber(query.heightMax),
        weightMin: parseOptionalNumber(query.weightMin),
        weightMax: parseOptionalNumber(query.weightMax),
      },
    })

    res.json({
      items: page.items,
      meta: {
        limit,
        returned: page.items.length,
        totalVisible: page.totalVisible,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      },
    })
  })
)

charactersRouter.get(
  '/archive/options',
  validate(characterArchiveOptionsSchema),
  asyncHandler(async (_req, res) => {
    const options = await getCharacterArchiveMetadata()

    res.json(options)
  })
)

charactersRouter.get(
  '/campaigns/:campaignId/characters',
  validate(listCampaignCharactersSchema),
  asyncHandler(async (req, res) => {
    const { campaignId } = req.validated.params
    const campaign = await requireCampaignReadAccess(campaignId, req)
    const campaignContext = getCampaignRoleContext(campaign, req)

    const characters = await prisma.personajes.findMany({
      where: {
        campana_id: campaignId,
      },
      include: {
        permisos_personaje: {
          where: { usuario_id: req.auth.userId },
          select: {
            nivel_acceso_codigo: true,
          },
        },
      },
      orderBy: {
        creado_en: 'desc',
      },
    })

    const items = characters
      .map((character) => {
        const access = {
          ...campaignContext,
          explicitPermission:
            character.permisos_personaje[0]?.nivel_acceso_codigo || null,
          isOwner: character.propietario_usuario_id === req.auth.userId,
        }

        if (access.isMaster || access.isOwner) {
          access.canView = true
          access.viewMode = 'full'
        } else if (
          access.explicitPermission === 'full' ||
          access.explicitPermission === 'completo'
        ) {
          access.canView = true
          access.viewMode = 'full'
        } else if (
          access.explicitPermission === 'preview' ||
          access.explicitPermission === 'vista_previa'
        ) {
          access.canView = true
          access.viewMode = 'preview'
        } else if (
          access.canRead &&
          character.ambito_visibilidad_codigo === 'campana_completo'
        ) {
          access.canView = true
          access.viewMode = 'full'
        } else if (
          access.canRead &&
          character.ambito_visibilidad_codigo === 'campana_vista_previa'
        ) {
          access.canView = true
          access.viewMode = 'preview'
        } else {
          access.canView = false
          access.viewMode = 'none'
        }

        return access.canView ? serializeCharacter(character, access) : null
      })
      .filter(Boolean)

    res.json({
      items,
    })
  })
)

charactersRouter.post(
  '/campaigns/:campaignId/characters',
  validate(createCharacterSchema),
  asyncHandler(async (req, res) => {
    const { campaignId } = req.validated.params
    const data = req.validated.body
    const campaign = await requireCampaignReadAccess(campaignId, req)
    const campaignContext = getCampaignRoleContext(campaign, req)

    if (!campaignContext.isMember) {
      throw createHttpError(
        403,
        'Debes pertenecer a la campana para crear personajes.'
      )
    }

    if (
      data.propietarioUsuarioId &&
      !campaignContext.isMaster &&
      data.propietarioUsuarioId !== req.auth.userId
    ) {
      throw createHttpError(
        403,
        'Solo el master de la campana puede asignar un personaje a otro usuario.'
      )
    }

    await assertManagedImageUrl(data.imagenPrincipalUrl, {
      entityLabel: 'La imagen principal del personaje',
    })

    const character = await prisma.personajes.create({
      data: {
        campana_id: campaignId,
        aventura_id: data.aventuraId,
        creado_por_usuario_id: req.auth.userId,
        propietario_usuario_id: data.propietarioUsuarioId || req.auth.userId,
        nombre: data.nombre,
        titulo: data.titulo,
        descripcion: data.descripcion,
        imagen_principal_url: data.imagenPrincipalUrl,
        ambito_visibilidad_codigo:
          data.ambitoVisibilidadCodigo || 'usuarios_seleccionados',
      },
      include: {
        permisos_personaje: {
          where: { usuario_id: req.auth.userId },
          select: { nivel_acceso_codigo: true },
        },
      },
    })

    await logEntityChange({
      tipoEntidadCodigo: 'personaje',
      entidadPk: character.id,
      actorUsuarioId: req.auth.userId,
      tipoAccion: 'create',
      resumen: 'Personaje creado dentro de una campana.',
      valorNuevo: {
        campanaId: campaignId,
        nombre: character.nombre,
      },
    })

    res.status(201).json({
      item: serializeCharacter(character, {
        ...campaignContext,
        isOwner: true,
        canView: true,
        canEdit: true,
        viewMode: 'full',
      }),
    })
  })
)

charactersRouter.get(
  '/editor/new',
  asyncHandler(async (req, res) => {
    const result = await getCharacterCreationEditorMetadata({ req })

    res.json(result)
  })
)

charactersRouter.get(
  '/editor/linkable-objects',
  validate(linkableCharacterAssetSearchSchema),
  asyncHandler(async (req, res) => {
    const { q, limit } = req.validated.query
    const items = await searchLinkableCharacterObjects({
      req,
      query: q,
      limit,
    })

    res.json({ items })
  })
)

charactersRouter.get(
  '/editor/linkable-powers',
  validate(linkableCharacterAssetSearchSchema),
  asyncHandler(async (req, res) => {
    const { q, limit } = req.validated.query
    const items = await searchLinkableCharacterPowers({
      req,
      query: q,
      limit,
    })

    res.json({ items })
  })
)

charactersRouter.patch(
  '/:characterId/linked-objects/:objectId/display',
  validate(characterObjectTraitDisplaySchema),
  asyncHandler(async (req, res) => {
    const { characterId, objectId } = req.validated.params
    const { mostrarRasgosEnFicha } = req.validated.body
    const result = await setCharacterObjectTraitDisplay({
      characterId,
      objectId,
      req,
      mostrarRasgosEnFicha,
    })

    res.json(result)
  })
)

charactersRouter.get(
  '/:characterId',
  validate(characterIdSchema),
  asyncHandler(async (req, res) => {
    const { characterId } = req.validated.params
    const context = await requireCharacterViewAccess(characterId, req)

    res.json({
      item: serializeCharacterDetail(context.character, context.access, req),
    })
  })
)

charactersRouter.get(
  '/:characterId/versions',
  validate(characterIdSchema),
  asyncHandler(async (req, res) => {
    const { characterId } = req.validated.params
    const context = await requireCharacterViewAccess(characterId, req)
    const versions = await listCharacterVersions({
      characterId,
      req,
    })

    res.json({
      item: serializeCharacter(context.character, context.access),
      versiones: versions,
    })
  })
)

charactersRouter.get(
  '/:characterId/editor',
  validate(characterIdSchema),
  asyncHandler(async (req, res) => {
    const { characterId } = req.validated.params
    const result = await getCharacterEditorMetadata({
      characterId,
      req,
    })

    res.json(result)
  })
)

charactersRouter.delete(
  '/saved-traits/:traitId',
  validate(savedTraitIdSchema),
  asyncHandler(async (req, res) => {
    const { traitId } = req.validated.params
    const trait = await prisma.rasgos.findFirst({
      where: {
        id: traitId,
        creador_usuario_id: req.auth.userId,
        es_reutilizable: true,
      },
      select: { id: true },
    })

    if (!trait) {
      throw createHttpError(404, 'Rasgo guardado no encontrado.')
    }

    const linkedCount = await prisma.personaje_rasgos.count({
      where: { rasgo_id: traitId },
    })

    if (linkedCount > 0) {
      await prisma.rasgos.update({
        where: { id: traitId },
        data: { es_reutilizable: false },
      })
    } else {
      await prisma.rasgos.delete({
        where: { id: traitId },
      })
    }

    res.status(204).send()
  })
)

charactersRouter.post(
  '/editor',
  validate(createEditorPayloadSchema),
  asyncHandler(async (req, res) => {
    const payload = req.validated.body
    const core = payload.core || {}
    const characterName = core.nombre?.trim()

    if (!characterName) {
      throw createHttpError(
        400,
        'El nombre del personaje no puede quedar vacio.'
      )
    }

    if (!core.campanaId) {
      throw createHttpError(
        400,
        'Selecciona una campana para crear el personaje.'
      )
    }

    const campaign = await requireCampaignReadAccess(core.campanaId, req)
    const campaignContext = getCampaignRoleContext(campaign, req)

    if (!campaignContext.isMember) {
      throw createHttpError(
        403,
        'Debes pertenecer a la campana para crear personajes.'
      )
    }

    if (
      core.propietarioUsuarioId &&
      !campaignContext.isMaster &&
      core.propietarioUsuarioId !== req.auth.userId
    ) {
      throw createHttpError(
        403,
        'Solo el master de la campana puede asignar un personaje a otro usuario.'
      )
    }

    await assertManagedImageUrl(core.imagenPrincipalUrl, {
      entityLabel: 'La imagen principal del personaje',
    })

    const character = await prisma.personajes.create({
      data: {
        campana_id: core.campanaId,
        aventura_id: core.aventuraId || null,
        creado_por_usuario_id: req.auth.userId,
        propietario_usuario_id: core.propietarioUsuarioId || req.auth.userId,
        nombre: characterName,
        titulo: core.titulo || null,
        descripcion: core.descripcion || null,
        lore: core.lore || null,
        imagen_principal_url: core.imagenPrincipalUrl || null,
        ambito_visibilidad_codigo: 'privado',
      },
      select: { id: true },
    })

    let result

    try {
      result = await saveCharacterEditorDraft({
        characterId: character.id,
        req,
        payload,
      })

      await logEntityChange({
        tipoEntidadCodigo: 'personaje',
        entidadPk: character.id,
        actorUsuarioId: req.auth.userId,
        tipoAccion: 'create',
        resumen: 'Personaje creado desde la ficha visual.',
        valorNuevo: payload,
      })

      await notifyMastersOfCampaignEntryCreated({
        entityType: 'character',
        entityId: character.id,
        entityName: result.item?.nombre || characterName,
        campaignIds: [core.campanaId],
        actorUsuarioId: req.auth.userId,
      }).catch((error) => {
        console.warn('No se pudo crear la notificación del personaje:', error)
      })
    } catch (error) {
      await prisma.personajes
        .delete({
          where: { id: character.id },
        })
        .catch(() => {})

      throw error
    }

    res.status(201).json(result)
  })
)

charactersRouter.put(
  '/:characterId/editor',
  validate(editorPayloadSchema),
  asyncHandler(async (req, res) => {
    const { characterId } = req.validated.params
    const result = await saveCharacterEditorDraft({
      characterId,
      req,
      payload: req.validated.body,
    })

    await logEntityChange({
      tipoEntidadCodigo: 'personaje',
      entidadPk: characterId,
      actorUsuarioId: req.auth.userId,
      tipoAccion: 'update',
      resumen: 'Personaje editado desde la ficha visual.',
      valorNuevo: req.validated.body,
    })

    res.json(result)
  })
)

charactersRouter.post(
  '/:characterId/versions',
  validate(createVersionSchema),
  asyncHandler(async (req, res) => {
    const { characterId } = req.validated.params
    const data = req.validated.body

    const sourceContext = await requireCharacterEditAccess(characterId, req)

    await assertManagedImageUrl(data.imagenPrincipalUrl, {
      entityLabel: 'La imagen principal del personaje',
    })

    const result = await createCharacterVersion({
      sourceCharacterId: characterId,
      req,
      targetCampaignId:
        data.campanaIdDestino || sourceContext.character.campana_id,
      targetAdventureId: data.aventuraIdDestino,
      targetOwnerUserId: data.propietarioUsuarioIdDestino,
      targetVisibilityCode: data.ambitoVisibilidadCodigoDestino,
      copyRelations: data.copiarRelaciones ?? true,
      overrides: {
        nombre: data.nombre,
        titulo: data.titulo,
        descripcion: data.descripcion,
        imagenPrincipalUrl: data.imagenPrincipalUrl,
        lore: data.lore,
      },
    })

    res.status(201).json({
      item: serializeCharacter(result.character, result.access),
    })
  })
)

charactersRouter.post(
  '/:characterId/clone',
  validate(cloneCharacterSchema),
  asyncHandler(async (req, res) => {
    const { characterId } = req.validated.params
    const data = req.validated.body

    await requireCharacterEditAccess(characterId, req)

    await assertManagedImageUrl(data.imagenPrincipalUrl, {
      entityLabel: 'La imagen principal del personaje',
    })

    const result = await cloneCharacter({
      sourceCharacterId: characterId,
      req,
      targetCampaignId: data.campanaIdDestino,
      targetAdventureId: data.aventuraIdDestino,
      targetOwnerUserId: data.propietarioUsuarioIdDestino,
      targetVisibilityCode: data.ambitoVisibilidadCodigoDestino,
      copyRelations: data.copiarRelaciones ?? true,
      linkAsVersion: data.vincularComoVersion ?? false,
      explicitBaseCharacterId: data.personajeBaseId,
      overrides: {
        nombre: data.nombre,
        titulo: data.titulo,
        descripcion: data.descripcion,
        imagenPrincipalUrl: data.imagenPrincipalUrl,
        lore: data.lore,
      },
    })

    res.status(201).json({
      item: serializeCharacter(result.character, result.access),
    })
  })
)

charactersRouter.patch(
  '/:characterId',
  validate(updateCharacterSchema),
  asyncHandler(async (req, res) => {
    const { characterId } = req.validated.params
    const data = req.validated.body
    const context = await requireCharacterEditAccess(characterId, req)
    const previousImageUrl = context.character.imagen_principal_url

    await assertManagedImageUrl(data.imagenPrincipalUrl, {
      entityLabel: 'La imagen principal del personaje',
    })

    const updatedCharacter = await prisma.personajes.update({
      where: { id: characterId },
      data: {
        nombre: data.nombre,
        titulo: data.titulo,
        descripcion: data.descripcion,
        imagen_principal_url: data.imagenPrincipalUrl,
        lore: data.lore,
        edad: data.edad,
        ambito_visibilidad_codigo: data.ambitoVisibilidadCodigo,
      },
      include: {
        permisos_personaje: {
          where: { usuario_id: req.auth.userId },
          select: { nivel_acceso_codigo: true },
        },
      },
    })

    if (
      data.imagenPrincipalUrl !== undefined &&
      previousImageUrl &&
      previousImageUrl !== updatedCharacter.imagen_principal_url
    ) {
      await cleanupCloudinaryAssets([previousImageUrl])
    }

    await logEntityChange({
      tipoEntidadCodigo: 'personaje',
      entidadPk: characterId,
      actorUsuarioId: req.auth.userId,
      tipoAccion: 'update',
      resumen: 'Personaje actualizado.',
      valorNuevo: data,
    })

    res.json({
      item: serializeCharacter(updatedCharacter, {
        ...context.access,
        canView: true,
        canEdit: true,
        viewMode: 'full',
      }),
    })
  })
)

charactersRouter.delete(
  '/:characterId',
  validate(characterIdSchema),
  asyncHandler(async (req, res) => {
    const { characterId } = req.validated.params
    const context = await requireCharacterEditAccess(characterId, req)
    const characterMedia = await prisma.personaje_imagenes.findMany({
      where: {
        personaje_id: characterId,
      },
      select: {
        imagen_url: true,
      },
    })

    const urlsToCleanup = [
      context.character.imagen_principal_url,
      ...characterMedia.map((item) => item.imagen_url),
    ].filter(Boolean)

    await prisma.personajes.delete({
      where: { id: characterId },
    })

    await cleanupCloudinaryAssets(urlsToCleanup)

    res.status(204).send()
  })
)

module.exports = {
  charactersRouter,
}
