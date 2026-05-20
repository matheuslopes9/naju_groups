-- Workspace: catalogSources (CSV), janela de envio, intervalo da fila
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "catalog_sources" TEXT;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "send_window_start" TEXT NOT NULL DEFAULT '08:00';
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "send_window_end" TEXT NOT NULL DEFAULT '22:00';
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "queue_interval_min" INTEGER NOT NULL DEFAULT 10;

-- Tabela de fila de envios
CREATE TABLE IF NOT EXISTS "queued_sends" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "offer_id" TEXT NOT NULL,
  "scheduled_for" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "sent_at" TIMESTAMP(3),
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "queued_sends_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "queued_sends_workspace_id_offer_id_key" ON "queued_sends"("workspace_id", "offer_id");
CREATE INDEX IF NOT EXISTS "queued_sends_status_scheduled_for_idx" ON "queued_sends"("status", "scheduled_for");
CREATE INDEX IF NOT EXISTS "queued_sends_workspace_id_status_scheduled_for_idx" ON "queued_sends"("workspace_id", "status", "scheduled_for");

ALTER TABLE "queued_sends" ADD CONSTRAINT "queued_sends_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
