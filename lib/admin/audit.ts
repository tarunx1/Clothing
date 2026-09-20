import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { AdminActor } from "@/lib/admin/authorization";

export type AuditAction =
  | "ADMIN_LOGIN"
  | "ADMIN_LOGOUT"
  | "PRODUCT_CREATED"
  | "PRODUCT_UPDATED"
  | "PRODUCT_DELETED"
  | "PRODUCT_MEDIA_UPDATED"
  | "VARIANTS_UPDATED"
  | "COLOR_CREATED"
  | "COLLECTION_CREATED"
  | "COLLECTION_UPDATED"
  | "COLLECTION_DELETED"
  | "COLLECTIONS_REORDERED"
  | "COLLECTION_MEDIA_UPDATED"
  | "INVENTORY_ADJUSTED"
  | "ORDER_STATUS_CHANGED"
  | "CONTENT_UPDATED"
  | "LOOKBOOK_UPDATED"
  | "SETTINGS_UPDATED"
  | "SECRETS_REENCRYPTED"
  | "WEBHOOK_CREATED"
  | "WEBHOOK_UPDATED"
  | "WEBHOOK_DELETED"
  | "WEBHOOK_SECRET_ROTATED"
  | "API_KEY_CREATED"
  | "API_KEY_REVOKED"
  | "API_KEY_ROTATED"
  | "CUSTOM_CREDENTIAL_SAVED"
  | "CUSTOM_CREDENTIAL_DELETED"
  | "INTEGRATION_TESTED"
  | "INTEGRATION_DISCONNECTED"
  | "ADMIN_CREATED"
  | "ADMIN_UPDATED"
  | "ADMIN_DEACTIVATED"
  | "ADMIN_PASSWORD_CHANGED"
  | "ADMIN_REAUTHENTICATED"
  | "STORE_PASSWORD_UPDATED"
  | "MAINTENANCE_ENABLED"
  | "MAINTENANCE_DISABLED"
  | "CACHES_CLEARED"
  | "SETTINGS_IMPORTED"
  | "DELIVERY_METHOD_SAVED"
  // Namespace actions from the settings registry (e.g. PAYMENT_SETTINGS_UPDATED).
  | (string & {});

type Db = PrismaClient | Prisma.TransactionClient;

/** Appends to the audit trail. Metadata must be a small change summary, never secrets. */
export function recordAudit(db: Db, actor: AdminActor | null, action: AuditAction, entityType: string, entityId: string | null, metadata?: Prisma.InputJsonValue) {
  return db.adminAuditLog.create({ data: { adminId: actor?.id ?? null, action, entityType, entityId, metadata } });
}
