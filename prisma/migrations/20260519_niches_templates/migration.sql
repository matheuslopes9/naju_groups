-- Configurações por workspace: nicho + estilo de anúncio + público + throttle
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "niche_preset" TEXT;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "audience" TEXT;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "ad_style" TEXT NOT NULL DEFAULT 'compact';
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "auto_approve_min_interval_min" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "typing_simulation" BOOLEAN NOT NULL DEFAULT true;
