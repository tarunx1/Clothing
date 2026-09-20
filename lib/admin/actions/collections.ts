"use server";

import { runAdminAction } from "@/lib/admin/actionRunner";
import * as collections from "@/lib/admin/services/collectionAdmin";

export async function createCollectionAction(values: unknown) {
  return runAdminAction("catalog:write", (actor) => collections.createCollection(actor, values), "Collection created.");
}

export async function updateCollectionAction(id: string, values: unknown) {
  return runAdminAction("catalog:write", (actor) => collections.updateCollection(actor, id, values), "Collection updated.");
}

export async function setCollectionFlagsAction(id: string, flags: unknown) {
  return runAdminAction("catalog:write", (actor) => collections.setCollectionFlags(actor, id, flags), "Collection updated.");
}

export async function deleteCollectionAction(id: string) {
  return runAdminAction("catalog:write", (actor) => collections.deleteCollection(actor, id), "Collection deleted.");
}

export async function reorderCollectionsAction(ids: unknown) {
  return runAdminAction("catalog:write", (actor) => collections.reorderCollections(actor, ids), "Collection order saved.");
}

export async function addCollectionImagesAction(collectionId: string, items: unknown) {
  return runAdminAction("catalog:write", (actor) => collections.addCollectionImages(actor, collectionId, items), "Images added.");
}

export async function updateCollectionImageAction(imageId: string, values: unknown) {
  return runAdminAction("catalog:write", (actor) => collections.updateCollectionImage(actor, imageId, values), "Image updated.");
}

export async function removeCollectionImageAction(imageId: string) {
  return runAdminAction("catalog:write", (actor) => collections.removeCollectionImage(actor, imageId), "Image removed.");
}

export async function reorderCollectionImagesAction(collectionId: string, ids: unknown) {
  return runAdminAction("catalog:write", (actor) => collections.reorderCollectionImages(actor, collectionId, ids), "Reel order saved.");
}
