-- CreateEnum
CREATE TYPE "SettingValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'SECRET');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- AlterEnum
ALTER TYPE "AdminRole" ADD VALUE 'MANAGER';

-- AlterTable
ALTER TABLE "admin_sessions" ADD COLUMN     "step_up_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "mode" TEXT;

-- AlterTable
ALTER TABLE "shipping_addresses" ADD COLUMN     "company" TEXT;

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB,
    "value_type" "SettingValueType" NOT NULL,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "ciphertext" TEXT,
    "iv" TEXT,
    "auth_tag" TEXT,
    "key_id" TEXT,
    "encryption_version" INTEGER,
    "secret_hint" TEXT,
    "description" TEXT,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setting_changes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previous_value" JSONB,
    "new_value" JSONB,
    "admin_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "setting_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_endpoints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "secret_ciphertext" TEXT NOT NULL,
    "secret_iv" TEXT NOT NULL,
    "secret_auth_tag" TEXT NOT NULL,
    "secret_key_id" TEXT NOT NULL,
    "secret_hint" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "endpoint_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "http_status" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "permissions" TEXT[],
    "created_by_id" UUID,
    "last_used_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "label" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "endpoint" TEXT,
    "public_key" TEXT,
    "secret_ciphertext" TEXT,
    "secret_iv" TEXT,
    "secret_auth_tag" TEXT,
    "secret_key_id" TEXT,
    "secret_hint" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "custom_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_health" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "environment" TEXT,
    "last_tested_at" TIMESTAMPTZ(3) NOT NULL,
    "last_error" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "integration_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'homepage',
    "status" TEXT NOT NULL DEFAULT 'SUBSCRIBED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_settings_namespace_idx" ON "system_settings"("namespace");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_namespace_key_key" ON "system_settings"("namespace", "key");

-- CreateIndex
CREATE INDEX "setting_changes_namespace_created_at_idx" ON "setting_changes"("namespace", "created_at");

-- CreateIndex
CREATE INDEX "setting_changes_created_at_idx" ON "setting_changes"("created_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_endpoint_id_created_at_idx" ON "webhook_deliveries"("endpoint_id", "created_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_created_at_idx" ON "webhook_deliveries"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_prefix_key" ON "api_keys"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Existing payments were all made with Razorpay test keys.
UPDATE "payments" SET "mode" = 'test' WHERE "mode" IS NULL;

-- Move the earlier "settings" content slot into typed system settings, then retire it.
INSERT INTO "system_settings" ("namespace", "key", "value", "value_type", "updated_at")
SELECT v.namespace, v.key, v.value, v.value_type::"SettingValueType", CURRENT_TIMESTAMP
FROM "site_content" sc
CROSS JOIN LATERAL (VALUES
  ('general', 'storeName', sc."value" -> 'storeName', 'STRING'),
  ('general', 'supportEmail', sc."value" -> 'supportEmail', 'STRING'),
  ('localization', 'defaultCurrency', sc."value" -> 'defaultCurrency', 'STRING'),
  ('inventory', 'lowStockThreshold', sc."value" -> 'lowStockThreshold', 'NUMBER')
) AS v(namespace, key, value, value_type)
WHERE sc."key" = 'settings' AND v.value IS NOT NULL AND jsonb_typeof(v.value) <> 'null'
ON CONFLICT ("namespace", "key") DO NOTHING;
DELETE FROM "site_content" WHERE "key" = 'settings';
