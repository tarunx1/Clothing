import "server-only";
import type { AdminActor } from "@/lib/admin/authorization";
import { recordAudit } from "@/lib/admin/audit";
import { AdminError } from "@/lib/admin/errors";
import { invalidateStorefront, storefrontTargets } from "@/lib/admin/revalidate";
import { assertSameSet, deleteIfUnreferenced, orderedIdsSchema } from "@/lib/admin/services/shared";
import { lookbookUpdateSchema, mediaItemSchema } from "@/lib/admin/validation";
import { contentSchemas, type ContentKey } from "@/lib/content/schemas";
import { readContent } from "@/lib/content/siteContent";
import { prisma } from "@/lib/db/prisma";
import { isAcceptableMediaUrl } from "@/lib/storage";
import { z } from "zod";

export async function getEditableContent() {
  const [hero, brandStory, newsletter] = await Promise.all([readContent("hero"), readContent("brandStory"), readContent("newsletter")]);
  return { hero, brandStory, newsletter };
}

/** Validates and stores one content slot. Only known keys with their schema are accepted. */
export async function updateContent(actor: AdminActor, key: ContentKey, values: unknown) {
  if (!(key in contentSchemas)) throw new AdminError("VALIDATION", "Unknown content section.");
  const value = contentSchemas[key].parse(values);
  const previous = await readContent(key);
  const changed = Object.keys(value).filter((field) => JSON.stringify((value as Record<string, unknown>)[field]) !== JSON.stringify((previous as Record<string, unknown>)[field]));
  await prisma.$transaction(async (tx) => {
    await tx.siteContent.upsert({ where: { key }, update: { value, updatedById: actor.id }, create: { key, value, updatedById: actor.id } });
    await recordAudit(tx, actor, "CONTENT_UPDATED", "content", key, { changed });
  });
  invalidateStorefront(storefrontTargets.content());
  return value;
}

// ---------- Lookbook ----------

export async function listLookbookForAdmin() {
  const rows = await prisma.lookbookImage.findMany({ orderBy: [{ lane: "asc" }, { order: "asc" }] });
  return rows.map((row) => ({ id: row.id, src: row.src, alt: row.alt, lane: row.lane, order: row.order, enabled: row.enabled, creditName: row.creditName ?? "", creditUrl: row.creditUrl ?? "" }));
}

const lane = z.coerce.number().int().min(1).max(3);

export async function addLookbookImages(actor: AdminActor, laneValue: unknown, items: unknown) {
  const targetLane = lane.parse(laneValue);
  const list = mediaItemSchema.array().min(1).max(20).parse(items);
  for (const item of list) if (!(await isAcceptableMediaUrl(item.url))) throw new AdminError("VALIDATION", "One of the images is not an uploaded file.");
  const created = await prisma.$transaction(async (tx) => {
    const max = await tx.lookbookImage.aggregate({ where: { lane: targetLane }, _max: { order: true } });
    const rows = [];
    for (const [index, item] of list.entries()) {
      rows.push(await tx.lookbookImage.create({ data: { src: item.url, alt: item.alt || "Lookbook photograph", lane: targetLane, order: (max._max.order ?? 0) + index + 1 } }));
    }
    await recordAudit(tx, actor, "LOOKBOOK_UPDATED", "lookbook", null, { added: rows.length, lane: targetLane });
    return rows;
  });
  invalidateStorefront(storefrontTargets.content());
  return created.map((row) => ({ id: row.id, src: row.src, alt: row.alt, lane: row.lane, order: row.order, enabled: row.enabled, creditName: "", creditUrl: "" }));
}

export async function updateLookbookImage(actor: AdminActor, id: string, values: unknown) {
  const input = lookbookUpdateSchema.parse(values);
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.lookbookImage.findUnique({ where: { id } });
    if (!current) throw new AdminError("NOT_FOUND", "This image no longer exists.");
    let order = current.order;
    if (input.lane !== current.lane) {
      const max = await tx.lookbookImage.aggregate({ where: { lane: input.lane }, _max: { order: true } });
      order = (max._max.order ?? 0) + 1;
    }
    const row = await tx.lookbookImage.update({
      where: { id },
      data: { alt: input.alt, lane: input.lane, order, enabled: input.enabled, creditName: input.creditName || null, creditUrl: input.creditUrl || null },
    });
    await recordAudit(tx, actor, "LOOKBOOK_UPDATED", "lookbook", id, { lane: row.lane, enabled: row.enabled });
    return row;
  });
  invalidateStorefront(storefrontTargets.content());
  return { id: updated.id, lane: updated.lane, order: updated.order, enabled: updated.enabled };
}

export async function removeLookbookImage(actor: AdminActor, id: string) {
  const image = await prisma.lookbookImage.findUnique({ where: { id } });
  if (!image) return;
  await prisma.$transaction(async (tx) => {
    await tx.lookbookImage.delete({ where: { id } });
    await recordAudit(tx, actor, "LOOKBOOK_UPDATED", "lookbook", id, { removed: true });
  });
  await deleteIfUnreferenced(image.src);
  invalidateStorefront(storefrontTargets.content());
}

export async function reorderLookbookLane(actor: AdminActor, laneValue: unknown, orderedIds: unknown) {
  const targetLane = lane.parse(laneValue);
  const ids = orderedIdsSchema.parse(orderedIds);
  await prisma.$transaction(async (tx) => {
    const rows = await tx.lookbookImage.findMany({ where: { lane: targetLane }, select: { id: true } });
    assertSameSet(rows.map((row) => row.id), ids);
    for (const [index, id] of ids.entries()) await tx.lookbookImage.update({ where: { id }, data: { order: index + 1 } });
    await recordAudit(tx, actor, "LOOKBOOK_UPDATED", "lookbook", null, { reordered: ids.length, lane: targetLane });
  });
  invalidateStorefront(storefrontTargets.content());
}

export async function listAuditLog(take = 30) {
  const rows = await prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take, include: { admin: { select: { name: true, email: true } } } });
  return rows.map((row) => ({ id: row.id, action: row.action, entityType: row.entityType, entityId: row.entityId, metadata: row.metadata, by: row.admin?.name ?? "System", at: row.createdAt }));
}
