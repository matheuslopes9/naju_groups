-- Drop categories que não funcionavam pra scraping
DROP TABLE IF EXISTS "workspace_categories";

-- Sources de scraping
CREATE TABLE "workspace_sources" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "max_pages" INTEGER NOT NULL DEFAULT 3,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_sources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_sources_workspace_id_slug_key" ON "workspace_sources"("workspace_id", "slug");

ALTER TABLE "workspace_sources" ADD CONSTRAINT "workspace_sources_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Novos campos no workspace
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "keywords" TEXT;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "price_min" DOUBLE PRECISION;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "price_max" DOUBLE PRECISION;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "cooldown_days" INTEGER NOT NULL DEFAULT 30;

-- Índice pra busca por productId+createdAt (cooldown)
CREATE INDEX IF NOT EXISTS "offers_product_id_workspace_id_created_at_idx"
  ON "offers"("product_id", "workspace_id", "created_at");
