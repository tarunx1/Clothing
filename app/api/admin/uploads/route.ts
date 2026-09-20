import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAction } from "@/lib/admin/authorization";
import { toActionError } from "@/lib/admin/errors";
import { isSameOrigin } from "@/lib/http/requestGuard";
import { storeUpload, UploadError } from "@/lib/storage";

const fieldsSchema = z.object({
  folder: z.enum(["products", "collections", "lookbook", "models", "branding"]),
  kind: z.enum(["image", "model"]),
});

/**
 * Stores one file and returns its public URL. Attaching the file to a product,
 * collection or lookbook lane is a separate, audited server action.
 */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ ok: false, error: "Request not allowed." }, { status: 403 });
    const scope = request.headers.get("x-upload-scope");
    const actor = await requireAdminAction(scope === "content" ? "content:write" : scope === "settings" ? "settings:write" : "catalog:write");
    const form = await request.formData();
    const file = form.get("file");
    const fields = fieldsSchema.parse({ folder: form.get("folder"), kind: form.get("kind") });
    if (!(file instanceof File)) throw new UploadError("Choose a file to upload.");
    const stored = await storeUpload({ folder: fields.folder, kind: fields.kind, fileName: file.name, body: Buffer.from(await file.arrayBuffer()) });
    console.info(`[admin] ${actor.email} uploaded ${stored.key}`);
    return NextResponse.json({ ok: true, data: { url: stored.url, size: stored.size, contentType: stored.contentType } });
  } catch (error) {
    if (error instanceof UploadError) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    const result = toActionError(error);
    const status = result.code === "UNAUTHENTICATED" ? 401 : result.code === "FORBIDDEN" ? 403 : result.code === "VALIDATION" ? 400 : 500;
    return NextResponse.json(result, { status });
  }
}
