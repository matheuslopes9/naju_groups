CREATE TABLE IF NOT EXISTS "scraped_offers" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "original_price" DOUBLE PRECISION,
  "discount_percent" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "permalink" TEXT NOT NULL,
  "image_url" TEXT NOT NULL,
  "free_shipping" BOOLEAN NOT NULL DEFAULT false,
  "sold_quantity" INTEGER NOT NULL DEFAULT 0,
  "coupon" TEXT,
  "highlight" TEXT,
  "category_detected" TEXT,
  "commission_pct" DOUBLE PRECISION,
  "estimated_commission" DOUBLE PRECISION,
  "source_id" TEXT,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "scraped_offers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "scraped_offers_product_id_key" ON "scraped_offers"("product_id");
CREATE INDEX IF NOT EXISTS "scraped_offers_last_seen_at_idx" ON "scraped_offers"("last_seen_at");
CREATE INDEX IF NOT EXISTS "scraped_offers_source_id_idx" ON "scraped_offers"("source_id");
