import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings/settingsService";
import { siteConfig } from "@/config/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getSettings("seo").catch(() => null);
  const baseUrl = (seo?.canonicalBaseUrl || siteConfig.url).replace(/\/$/, "");

  const allowIndex = seo?.robotsIndex ?? true;
  const allowFollow = seo?.robotsFollow ?? true;

  if (!allowIndex) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/order/confirmation/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
