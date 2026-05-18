-- Sessão headless do Mercado Livre Afiliados (singleton)
-- Armazena cookies do Playwright após login manual, pra reutilizar em chamadas futuras
CREATE TABLE IF NOT EXISTS "affiliate_sessions" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "cookies_enc" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "last_check_at" TIMESTAMP(3),
    "last_error" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "affiliate_sessions_pkey" PRIMARY KEY ("id")
);

-- Auto-aprovação por workspace
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "auto_approve_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "auto_approve_threshold" INTEGER NOT NULL DEFAULT 80;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "auto_approve_max_daily" INTEGER NOT NULL DEFAULT 10;

-- Log de ações do agente IA
CREATE TABLE IF NOT EXISTS "agent_actions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "offer_id" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_actions_workspace_id_created_at_idx" ON "agent_actions"("workspace_id", "created_at");
CREATE INDEX IF NOT EXISTS "agent_actions_created_at_idx" ON "agent_actions"("created_at");
