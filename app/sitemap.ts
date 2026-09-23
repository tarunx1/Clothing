import type { MetadataRoute } from "next";
import { getCollections, getProducts } from "@/lib/services/catalogService";
import { getSettings } from "@/lib/settings/settingsService";
import { siteConfig } from "@/config/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [seo, products, collections] = await Promise.all([
    getSettings("seo"),
    getProducts().catch(() => []),
    getCollections().catch(() => []),
  ]);

  const baseUrl = (seo.canonicalBaseUrl || siteConfig.url).replace(/\/$/, "");
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/shop`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/collections`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${baseUrl}/product/${product.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const collectionRoutes: MetadataRoute.Sitemap = collections.map((col) => ({
    url: `${baseUrl}/collections/${col.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...productRoutes, ...collectionRoutes];
}
