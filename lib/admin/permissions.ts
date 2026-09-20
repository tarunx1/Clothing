import type { AdminRole } from "@prisma/client";

/**
 * Admin permissions. Names map to the product vocabulary:
 * catalog:write = MANAGE_PRODUCTS, orders:write = MANAGE_ORDERS,
 * content:write = MANAGE_CONTENT, settings:write = MANAGE_SETTINGS,
 * integrations:manage = MANAGE_INTEGRATIONS, security:manage = MANAGE_SECURITY.
 * Safe to import on the client (for UI hints); the server enforces them.
 */
export const PERMISSIONS = [
  "dashboard:view",
  "catalog:write",
  "inventory:write",
  "orders:write",
  "content:write",
  "settings:write",
  "integrations:manage",
  "security:manage",
  "audit:view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Central role → permission map. New roles are added here, nowhere else. */
export const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  MANAGER: ["dashboard:view", "catalog:write", "inventory:write", "orders:write", "content:write", "settings:write", "audit:view"],
  STAFF: ["dashboard:view", "inventory:write", "orders:write"],
};

export const ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: "Administrator — everything, including payments, integrations and security",
  MANAGER: "Manager — catalog, orders, content and store settings; no credentials or security",
  STAFF: "Staff — stock and order fulfilment",
};

export const hasPermission = (role: AdminRole | null | undefined, permission: Permission) => Boolean(role && ROLE_PERMISSIONS[role]?.includes(permission));
