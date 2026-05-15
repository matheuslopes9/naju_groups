-- Coluna pro shortlink oficial gerado pelo usuário no portal de afiliados
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "shortlink" TEXT;
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "shortlink_added_at" TIMESTAMP(3);
