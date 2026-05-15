-- Campos enriquecidos pra score de rentabilidade e cupons
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "coupon" TEXT;
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "highlight" TEXT;
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "category_detected" TEXT;
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "commission_pct" DOUBLE PRECISION;
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "estimated_commission" DOUBLE PRECISION;
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "score" INTEGER;
