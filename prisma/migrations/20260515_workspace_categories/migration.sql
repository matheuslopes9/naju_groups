-- Drop a tabela antiga de sellers (substituída por categorias)
DROP TABLE IF EXISTS "workspace_sellers";

-- CreateTable
CREATE TABLE "workspace_categories" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_categories_workspace_id_category_id_key" ON "workspace_categories"("workspace_id", "category_id");

-- AddForeignKey
ALTER TABLE "workspace_categories" ADD CONSTRAINT "workspace_categories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
