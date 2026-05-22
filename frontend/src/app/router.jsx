import {
  createBrowserRouter,
  createHashRouter,
  Navigate,
} from 'react-router-dom'

import { isDemoMode } from '../demo/config'
import {
  GuestOnlyRoute,
  ProtectedRoute,
  RoleRoute,
} from '../components/ui/AuthGuard'
import { AppShell } from '../layouts/AppShell'
import { AdminSettingsPage } from '../pages/AdminSettingsPage'
import { AppInfoPage } from '../pages/AppInfoPage'
import { AuthPage } from '../pages/AuthPage'
import { BossRushPage } from '../pages/BossRushPage'
import { CampaignDetailPage } from '../pages/CampaignDetailPage'
import { CampaignSessionDetailPage } from '../pages/CampaignSessionDetailPage'
import { CampaignsPage } from '../pages/CampaignsPage'
import { CharacterDetailPage } from '../pages/CharacterDetailPage'
import { CharactersPage } from '../pages/CharactersPage'
import { ClassDetailPage, SubclassDetailPage } from '../pages/ClassDetailPage'
import { ClassListPage, ClassesPage } from '../pages/ClassesPage'
import { FeatDetailPage } from '../pages/FeatDetailPage'
import { FeatsPage } from '../pages/FeatsPage'
import {
  ActiveCombatsPage,
  ActiveCombatDetailPage,
  CombatManagerPage,
  CombatStartPage,
  FinishedCombatDetailPage,
  FinishedCombatsPage,
  SessionCombatDetailPage,
} from '../pages/CombatManagerPage'
import { GameToolsPage } from '../pages/GameToolsPage'
import { HomePage } from '../pages/HomePage'
import { ObjectDetailPage } from '../pages/ObjectDetailPage'
import { ObjectsPage } from '../pages/ObjectsPage'
import { OtherPowersPage } from '../pages/OtherPowersPage'
import { PlacesPage } from '../pages/PlacesPage'
import { PlaceDetailPage } from '../pages/PlaceDetailPage'
import { PowerDetailPage } from '../pages/PowerDetailPage'
import { PowersPage } from '../pages/PowersPage'
import { SpellDetailPage } from '../pages/SpellDetailPage'
import { SpellsPage } from '../pages/SpellsPage'
import { ProfilePage } from '../pages/ProfilePage'
import { PublicProfileEditorPage } from '../pages/PublicProfileEditorPage'
import { PublicProfilePage } from '../pages/PublicProfilePage'
import { RulesPage } from '../pages/RulesPage'
import { RulesExternalResourcesPage } from '../pages/RulesExternalResourcesPage'
import { RulesQuickReferencePage } from '../pages/RulesQuickReferencePage'
import { RulesSetsPage } from '../pages/RulesSetsPage'
import { SpellManagerPage } from '../pages/SpellManagerPage'

const createRouter = isDemoMode ? createHashRouter : createBrowserRouter

export const router = createRouter([
  {
    element: <GuestOnlyRoute />,
    children: [
      {
        path: '/',
        element: <AuthPage />,
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/app',
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <HomePage />,
          },
          {
            path: 'campanas',
            element: <CampaignsPage />,
          },
          {
            path: 'campanas/nuevo',
            element: <CampaignDetailPage createMode />,
          },
          {
            path: 'campanas/:campaignId',
            element: <CampaignDetailPage />,
          },
          {
            path: 'campanas/:campaignId/partidas/:sessionId',
            element: <CampaignSessionDetailPage />,
          },
          {
            path: 'campanas/:campaignId/partidas/:sessionId/combates/:combatId',
            element: <SessionCombatDetailPage />,
          },
          {
            path: 'personajes',
            element: <CharactersPage />,
          },
          {
            path: 'personajes/nuevo',
            element: <CharacterDetailPage createMode />,
          },
          {
            path: 'personajes/:characterId',
            element: <CharacterDetailPage />,
          },
          {
            path: 'objetos',
            element: <ObjectsPage />,
          },
          {
            path: 'objetos/nuevo',
            element: <ObjectDetailPage createMode />,
          },
          {
            path: 'objetos/:objectId',
            element: <ObjectDetailPage />,
          },
          {
            path: 'lugares',
            element: <PlacesPage />,
          },
          {
            path: 'lugares/nuevo',
            element: <PlaceDetailPage createMode />,
          },
          {
            path: 'lugares/:placeId',
            element: <PlaceDetailPage />,
          },
          {
            path: 'poderes',
            element: <PowersPage />,
          },
          {
            path: 'poderes/hechizos',
            element: <SpellsPage />,
          },
          {
            path: 'poderes/hechizos/nuevo',
            element: <SpellDetailPage createMode />,
          },
          {
            path: 'poderes/hechizos/:spellId',
            element: <SpellDetailPage />,
          },
          {
            path: 'poderes/otros',
            element: <OtherPowersPage />,
          },
          {
            path: 'poderes/otros/nuevo',
            element: <PowerDetailPage createMode />,
          },
          {
            path: 'poderes/otros/:powerId/editar',
            element: <PowerDetailPage startEditing />,
          },
          {
            path: 'poderes/otros/:powerId',
            element: <PowerDetailPage />,
          },
          {
            path: 'clases',
            element: <ClassesPage />,
          },
          {
            path: 'clases/listado',
            element: <ClassListPage />,
          },
          {
            path: 'clases/nuevo',
            element: <ClassDetailPage createMode />,
          },
          {
            path: 'clases/dotes',
            element: <FeatsPage />,
          },
          {
            path: 'clases/dotes/nuevo',
            element: <FeatDetailPage createMode />,
          },
          {
            path: 'clases/dotes/:featId/editar',
            element: <FeatDetailPage startEditing />,
          },
          {
            path: 'clases/dotes/:featId',
            element: <FeatDetailPage />,
          },
          {
            path: 'clases/:classId/editar',
            element: <ClassDetailPage startEditing />,
          },
          {
            path: 'clases/:classId/subclases/:subclassId',
            element: <SubclassDetailPage />,
          },
          {
            path: 'clases/:classId',
            element: <ClassDetailPage />,
          },
          {
            path: 'herramientas',
            element: <GameToolsPage />,
          },
          {
            path: 'herramientas/combate',
            element: <CombatManagerPage />,
          },
          {
            path: 'herramientas/combate/iniciar',
            element: <CombatStartPage />,
          },
          {
            path: 'herramientas/combate/activos',
            element: <ActiveCombatsPage />,
          },
          {
            path: 'herramientas/combate/activos/:combatId',
            element: <ActiveCombatDetailPage />,
          },
          {
            path: 'herramientas/combate/terminados',
            element: <FinishedCombatsPage />,
          },
          {
            path: 'herramientas/combate/terminados/:combatId',
            element: <FinishedCombatDetailPage />,
          },
          {
            path: 'herramientas/hechizos',
            element: <SpellManagerPage />,
          },
          {
            path: 'herramientas/bossrush',
            element: <BossRushPage />,
          },
          {
            path: 'herramientas/reglamento',
            element: <Navigate to="/app/reglamento" replace />,
          },
          {
            path: 'herramientas/reglamento/general',
            element: <Navigate to="/app/reglamento/general" replace />,
          },
          {
            path: 'herramientas/reglamento/referencia-rapida',
            element: (
              <Navigate to="/app/reglamento/referencia-rapida" replace />
            ),
          },
          {
            path: 'herramientas/reglamento/sets',
            element: <Navigate to="/app/reglamento/sets" replace />,
          },
          {
            path: 'herramientas/reglamento/recursos',
            element: <Navigate to="/app/reglamento/recursos" replace />,
          },
          {
            path: 'reglamento',
            element: <RulesPage />,
          },
          {
            path: 'reglamento/general',
            lazy: async () => {
              const { RulesGeneralPage } =
                await import('../pages/RulesGeneralPage')

              return { Component: RulesGeneralPage }
            },
          },
          {
            path: 'reglamento/referencia-rapida',
            element: <RulesQuickReferencePage />,
          },
          {
            path: 'reglamento/sets',
            element: <RulesSetsPage />,
          },
          {
            path: 'reglamento/recursos',
            element: <RulesExternalResourcesPage />,
          },
          {
            path: 'reglamento/estandar',
            element: <Navigate to="/app/reglamento/general" replace />,
          },
          {
            path: 'perfil',
            element: <ProfilePage />,
          },
          {
            path: 'perfil-publico/editar',
            element: <PublicProfileEditorPage />,
          },
          {
            path: 'perfiles/:userId',
            element: <PublicProfilePage />,
          },
          {
            path: 'informacion',
            element: <AppInfoPage />,
          },
          {
            element: <RoleRoute allowedRoles={['administrador']} />,
            children: [
              {
                path: 'administracion',
                element: <AdminSettingsPage />,
              },
              {
                path: 'configuracion',
                element: <AdminSettingsPage />,
              },
            ],
          },
          {
            path: '*',
            element: <Navigate to="/app" replace />,
          },
        ],
      },
    ],
  },
])
