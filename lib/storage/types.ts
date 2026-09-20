export interface StoredFile {
  /** Provider-independent object key, e.g. `products/2026/09/ab12…-front.webp`. */
  key: string;
  /** Public URL the storefront renders. */
  url: string;
  contentType: string;
  size: number;
}

export interface StorageProvider {
  readonly id: "local" | "s3" | "r2" | "cloudinary";
  upload(input: { key: string; body: Buffer; contentType: string }): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  /** Maps a URL this provider issued back to its key; null for anything else (seed assets, external links). */
  keyFromUrl(url: string): string | null;
}
