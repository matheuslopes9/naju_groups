-- Drop tabela workspace_sources (sistema antigo de fontes por workspace)
DROP TABLE IF EXISTS "workspace_sources";

-- Drop campos legados da workspace
ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "search_query";
ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "category_ids";
ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "max_per_run";
ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "interval_min";
ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "auto_search";
ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "auto_approve_min_interval_min";
ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "catalog_sources";
