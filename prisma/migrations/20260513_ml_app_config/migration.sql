-- CreateTable
CREATE TABLE "ml_app_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "client_id" TEXT NOT NULL,
    "client_secret_enc" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "affiliate_tag" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ml_app_config_pkey" PRIMARY KEY ("id")
);
