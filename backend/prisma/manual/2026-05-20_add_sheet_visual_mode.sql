ALTER TABLE "usuarios"
ADD COLUMN IF NOT EXISTS "modo_visual_fichas" TEXT NOT NULL DEFAULT 'wikicodex';
