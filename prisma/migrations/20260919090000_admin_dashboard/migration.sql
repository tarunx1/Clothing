-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "InventoryAdjustmentReason" AS ENUM ('RESTOCK', 'CORRECTION', 'RETURN', 'DAMAGED', 'OTHER');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'STAFF',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token_hash" TEXT NOT NULL,
    "admin_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variant_id" UUID NOT NULL,
    "quantity_delta" INTEGER NOT NULL,
    "quantity_before" INTEGER NOT NULL,
    "quantity_after" INTEGER NOT NULL,
    "reason" "InventoryAdjustmentReason" NOT NULL,
    "note" TEXT,
    "admin_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "carrier" TEXT,
    "tracking_number" TEXT,
    "tracking_url" TEXT,
    "shipped_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_content" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_content_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "lookbook_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "src" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "lane" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" TEXT,
    "credit_name" TEXT,
    "credit_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lookbook_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "admin_sessions_admin_id_idx" ON "admin_sessions"("admin_id");

-- CreateIndex
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "inventory_adjustments_variant_id_created_at_idx" ON "inventory_adjustments"("variant_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_adjustments_created_at_idx" ON "inventory_adjustments"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_entity_type_entity_id_idx" ON "admin_audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_order_id_key" ON "shipments"("order_id");

-- CreateIndex
CREATE INDEX "lookbook_images_enabled_lane_order_idx" ON "lookbook_images"("enabled", "lane", "order");

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Guards the admin cannot bypass.
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_reserved_non_negative" CHECK ("reserved_quantity" >= 0);
ALTER TABLE "lookbook_images" ADD CONSTRAINT "lookbook_images_lane_range" CHECK ("lane" BETWEEN 1 AND 3);

-- The homepage explorer now shows featured collections (max 5). Keep today's homepage unchanged.
UPDATE "collections" SET "featured" = true
WHERE "id" IN (SELECT "id" FROM "collections" WHERE "enabled" = true ORDER BY "order" ASC LIMIT 5)
  AND NOT EXISTS (SELECT 1 FROM "collections" WHERE "featured" = true);

-- Move the lookbook from source code (data/lookbook.ts) into the database once.
INSERT INTO "lookbook_images" ("src", "alt", "lane", "order", "credit_name", "credit_url", "updated_at")
SELECT v.src, v.alt, v.lane, v.ord, v.credit_name, v.credit_url, CURRENT_TIMESTAMP
FROM (VALUES
  ('/images/lookbook/28758240.jpg', 'Full-length studio portrait in an oversized charcoal tee, shorts and cap', 1, 1, 'INFECTED Store', 'https://www.pexels.com/photo/casual-fashion-model-in-oversized-t-shirt-28758240/'),
  ('/images/lookbook/26967988.jpg', 'Close studio portrait of a man wearing a black crew-neck T-shirt', 1, 2, 'Bruno Casttro', 'https://www.pexels.com/photo/model-in-black-t-shirt-26967988/'),
  ('/images/lookbook/13462505.jpg', 'Woman wearing an oversized black graphic tee on a city street', 2, 1, 'Pexels contributor', 'https://www.pexels.com/photo/woman-wearing-an-oversized-black-shirt-13462505/'),
  ('/images/lookbook/29276076.jpg', 'Model in sunglasses looking down at the drape of a loose black T-shirt', 2, 2, 'INFECTED Store', 'https://www.pexels.com/photo/man-in-black-t-shirt-with-sunglasses-inspection-29276076/'),
  ('/images/lookbook/16400892.jpg', 'Outdoor portrait of a model with dyed hair wearing a black T-shirt', 3, 1, 'Teddy Yang', 'https://www.pexels.com/photo/man-posing-in-black-t-shirt-16400892/'),
  ('/images/lookbook/16109695.jpg', 'Model with hands in pockets wearing a black graphic tee in a dark studio', 3, 2, 'Karen Irala', 'https://www.pexels.com/photo/model-in-tshirt-16109695/')
) AS v(src, alt, lane, ord, credit_name, credit_url)
WHERE NOT EXISTS (SELECT 1 FROM "lookbook_images");
