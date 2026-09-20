import { readLocalFile } from "@/lib/storage/local";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", glb: "model/gltf-binary" };

/** Serves files written by the local storage driver. Keys are random, so responses are immutable. */
export async function GET(_request: Request, { params }: RouteContext<"/media/[...key]">) {
  const { key } = await params;
  const joined = key.join("/");
  const type = TYPES[joined.split(".").pop()?.toLowerCase() ?? ""];
  const file = type ? await readLocalFile(joined) : null;
  if (!file || !type) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file), {
    headers: {
      "content-type": type,
      "content-length": String(file.length),
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
