-- Default do intervalo de envio agora é 5 min (era 10).
-- Não muda valores existentes — workspaces criados antes continuam no que estavam.
ALTER TABLE "workspaces" ALTER COLUMN "queue_interval_min" SET DEFAULT 5;
