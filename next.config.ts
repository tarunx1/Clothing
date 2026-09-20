import type { NextConfig } from "next";

const remoteMedia = (() => {
  try {
    return process.env.S3_PUBLIC_URL ? new URL(process.env.S3_PUBLIC_URL) : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: {
    // Required allowlist in Next.js 16; the explorer frames use the default quality.
    qualities: [75],
    // Bundled assets and admin uploads (local driver). No query strings, so arbitrary URLs cannot be optimized.
    localPatterns: [
      { pathname: "/images/**", search: "" },
      { pathname: "/media/**", search: "" },
    ],
    // Object storage (S3/R2) public origin, when configured.
    remotePatterns: remoteMedia ? [{ protocol: remoteMedia.protocol.replace(":", "") as "https" | "http", hostname: remoteMedia.hostname, pathname: `${remoteMedia.pathname.replace(/\/$/, "")}/**` }] : [],
  },
};

export default nextConfig;
