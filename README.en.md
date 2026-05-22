# WikiCodex

<p align="center">
  <a href="README.md">
    <img src="https://img.shields.io/badge/ESP-Espa%C3%B1ol-334155?style=for-the-badge" alt="Español">
  </a>
  <a href="README.en.md">
    <img src="https://img.shields.io/badge/ENG-English-0f766e?style=for-the-badge" alt="English">
  </a>
</p>

<p align="center">
  <strong>Private tabletop RPG wiki for campaigns, sheets, rules, permissions and play tools.</strong>
</p>

<p align="center">
  <img src="assets/capturas/home.jpg" alt="WikiCodex main dashboard" width="960">
</p>

WikiCodex is a web application for creating, organizing and browsing a private tabletop role-playing wiki. It is designed for groups that need to keep campaigns, characters, items, locations, sessions, spells, powers, rules, profiles and world notes in one place while keeping full control over what each player can see.

The application combines advanced visual sheets, linked wiki text, play tools, integrated rules, a spell library and a backend-validated privacy system.

## Screenshots

| Home | Character sheet |
| --- | --- |
| <img src="assets/capturas/home.jpg" alt="WikiCodex home" width="520"> | <img src="assets/capturas/ficha-personaje-1.jpg" alt="Character sheet" width="520"> |

| Campaigns | Campaign detail |
| --- | --- |
| <img src="assets/capturas/campanas-activas.jpg" alt="Active campaigns" width="520"> | <img src="assets/capturas/detalle-campana.jpg" alt="Campaign detail" width="520"> |

| Items | Locations |
| --- | --- |
| <img src="assets/capturas/objetos.jpg" alt="Items list" width="520"> | <img src="assets/capturas/lugares.jpg" alt="Locations list" width="520"> |

| Spells | Powers |
| --- | --- |
| <img src="assets/capturas/hechizos.jpg" alt="Spell library" width="520"> | <img src="assets/capturas/poderes.jpg" alt="Powers list" width="520"> |

| Combat manager | Rules |
| --- | --- |
| <img src="assets/capturas/gestor-combate.jpg" alt="Combat manager" width="520"> | <img src="assets/capturas/reglamento.jpg" alt="Integrated rules" width="520"> |

| Classes | Profile and customization |
| --- | --- |
| <img src="assets/capturas/clases.jpg" alt="Classes" width="520"> | <img src="assets/capturas/perfil.jpg" alt="User profile" width="520"> |

### Dark mode and color palette

<p align="center">
  <img src="assets/capturas/modo-oscuro-paleta-color.jpg" alt="Dark mode and color palette" width="960">
</p>

## Key features

### Campaign wiki

- Public or private campaigns.
- Adventures, story arcs and sessions within each campaign.
- Characters, items, locations, spells and powers linked to one or more campaigns.
- Sheets with image, gallery, music, description, game data and internal relationships.
- Comments, favorites, recent activity and global search.

### Advanced sheets

- Character sheets with stats, narrative information, items, powers, spells, music and gallery.
- Traits grouped by type, reorderable and reusable.
- Dynamic `{...}` values inside traits to display live sheet data.
- Character and item versions.
- Item and location sheets with categories, traits, privacy and relationships.
- Visual sheet modes: WikiCodex, Legacy, Arcane Night, Ancient Parchment, Ink and Paper, Grimoire and High Contrast.

### Real privacy

WikiCodex is designed for campaigns where not every player should see the same information. Permissions are validated by the backend; the interface only adapts the experience.

Supported visibility models:

- Fully private.
- Preview only.
- Fully public.
- Available to selected users.
- Visible through campaign membership or campaign role.

Key rules:

- A public campaign does not automatically make its characters, items, locations or powers public.
- Masters have contextual permissions within their campaigns.
- Administrators can manage the full application.
- Public profiles, featured elements, search, favorites, activity, wiki text and notifications respect privacy.

### Wiki text

Long text fields can link internal entities and use simple formatting:

```txt
[[character:Name]]
[[item:Name|visible text]]
**bold**
*italic*
==highlight==
{Dynamic sheet value}
```

Autocomplete and link resolution respect privacy. If a user cannot access a linked entity, the application avoids exposing its content.

### Play tools

- Combat manager with initiative, turns, rounds, temporary hit points, temporary AC, notes and conditions.
- Finished combat history.
- Combat association with sessions.
- Spell manager with casters, slots, temporary spells and visible characters.
- BossRush section prepared as a future module.

### Rules and resources

- Integrated general rules in reading format.
- Quick reference with search and collapsible sections.
- Classes, feats and spells available inside the application.
- External resources and PDFs served through Cloudinary when available.

### Administration

- General application statistics.
- Non-admin user management.
- Normal user creation.
- User password changes.
- Administrative action audit log.
- Controlled deletion of users and campaigns.
- Additional protection through an admin-zone key.
- Independent destructive password for irreversible actions.

## Security

- Username, password and private registration key authentication.
- Hashed passwords.
- JWT sessions.
- Reinforced administrator session handling.
- Schema-based input validation.
- Backend security headers.
- Rate limiting on sensitive routes.
- Environment-based CORS configuration.
- Image uploads handled through backend and Cloudinary.
- Secrets kept outside source code through environment variables.

## User experience

- Responsive interface for desktop, tablet and mobile.
- Side navigation with main sections.
- Quick-access rail with favorites, activity and tools.
- Light and dark mode.
- User-configurable primary color.
- Visual sheets with images, galleries and collapsible blocks.
- Lists with combinable filters.
- Separate static demo to showcase the project without using the real instance.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, React Router, TanStack Query, Tailwind CSS |
| Backend | Node.js, Express, Prisma |
| Database | PostgreSQL |
| Validation | Zod |
| Authentication | JWT |
| Media | Cloudinary |
| Deployment | Vercel, Render, Supabase and Cloudinary |

## Use cases

WikiCodex is especially useful for:

- Long campaigns with extensive accumulated lore.
- Tables where the master needs to hide information from specific players.
- Groups with several campaigns connected in the same world.
- Games where items, powers or characters change over time.
- Small communities that need a private wiki with permission control.
- Session preparation with quick access to rules, spells and resources.

## Project status

WikiCodex is in an advanced first functional version. It already includes authentication, privacy, administration, complex sheets, a spell library, play tools, integrated rules, Cloudinary and a deployment path prepared for free or low-cost services.

Modules prepared for future evolution:

- BossRush.
- Rule sets.
- More external resource integrations.
- Future performance and visual experience improvements.

## Authorship

Project created by **Adrián Vilella Espony**.

- Email: [adrian.vilella.pro@gmail.com](mailto:adrian.vilella.pro@gmail.com)
- LinkedIn: [www.linkedin.com/in/adrián-vilella-espony-40a046410](https://www.linkedin.com/in/adri%C3%A1n-vilella-espony-40a046410)

