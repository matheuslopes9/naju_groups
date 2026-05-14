-- CreateTable
CREATE TABLE "workspace_sellers" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "nickname" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_sellers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_sellers_workspace_id_seller_id_key" ON "workspace_sellers"("workspace_id", "seller_id");

-- AddForeignKey
ALTER TABLE "workspace_sellers" ADD CONSTRAINT "workspace_sellers_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
