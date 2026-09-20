"use client";

import { useCallback, useState } from "react";

export type UploadFolder = "products" | "collections" | "lookbook" | "models" | "branding";

/** Sends files one at a time to the admin upload route and reports progress. */
export function useUpload(folder: UploadFolder, kind: "image" | "model" = "image", scope: "catalog" | "content" | "settings" = "catalog") {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const upload = useCallback(async (files: File[]) => {
    const uploaded: { url: string; name: string }[] = [];
    const errors: string[] = [];
    setProgress({ done: 0, total: files.length });
    for (const [index, file] of files.entries()) {
      const body = new FormData();
      body.set("file", file);
      body.set("folder", folder);
      body.set("kind", kind);
      try {
        const response = await fetch("/api/admin/uploads", { method: "POST", body, headers: { "x-upload-scope": scope } });
        const result = (await response.json().catch(() => null)) as { ok: boolean; data?: { url: string }; error?: string } | null;
        if (result?.ok && result.data) uploaded.push({ url: result.data.url, name: file.name });
        else errors.push(`${file.name}: ${result?.error ?? "Upload failed."}`);
      } catch {
        errors.push(`${file.name}: Upload failed. Check your connection.`);
      }
      setProgress({ done: index + 1, total: files.length });
    }
    setProgress(null);
    return { uploaded, errors };
  }, [folder, kind, scope]);
  return { upload, progress };
}

/** A readable starting alt text from a file name ("front-view_2.jpg" → "Front view 2"). */
export const altFromFileName = (name: string) => {
  const base = name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "Image";
};
