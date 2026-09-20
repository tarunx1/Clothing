"use server";

import { z } from "zod";
import { runAdminAction } from "@/lib/admin/actionRunner";
import * as content from "@/lib/admin/services/contentAdmin";

const key = z.enum(["hero", "brandStory", "newsletter"]);

export async function updateContentAction(section: unknown, values: unknown) {
  return runAdminAction("content:write", (actor) => content.updateContent(actor, key.parse(section), values), "Content saved.");
}

export async function addLookbookImagesAction(lane: unknown, items: unknown) {
  return runAdminAction("content:write", (actor) => content.addLookbookImages(actor, lane, items), "Images added.");
}

export async function updateLookbookImageAction(id: string, values: unknown) {
  return runAdminAction("content:write", (actor) => content.updateLookbookImage(actor, id, values), "Image updated.");
}

export async function removeLookbookImageAction(id: string) {
  return runAdminAction("content:write", (actor) => content.removeLookbookImage(actor, id), "Image removed.");
}

export async function reorderLookbookLaneAction(lane: unknown, ids: unknown) {
  return runAdminAction("content:write", (actor) => content.reorderLookbookLane(actor, lane, ids), "Lane order saved.");
}
