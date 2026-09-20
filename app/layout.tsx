import type { Metadata, Viewport } from "next";
import { Inter_Tight } from "next/font/google";
import { siteConfig } from "@/config/site";
import { getStoreSettings } from "@/lib/content/siteContent";
import { getSettings } from "@/lib/settings/settingsService";
import "./globals.css";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const [{ storeName }, seo, branding] = await Promise.all([getStoreSettings(), getSettings("seo"), getSettings("branding")]);
  const image = seo.ogImage || branding.socialImage;
  return {
    metadataBase: new URL(seo.canonicalBaseUrl || siteConfig.url),
    title: { default: seo.siteTitle || `${storeName} — ${siteConfig.hero.headline.join(" ")}`, template: seo.titleTemplate.replaceAll("{store}", storeName) },
    description: seo.metaDescription,
    robots: { index: seo.robotsIndex, follow: seo.robotsFollow },
    icons: branding.favicon ? { icon: branding.favicon } : undefined,
    openGraph: { siteName: storeName, images: image ? [image] : undefined },
    twitter: { card: seo.twitterCard === "summary" ? "summary" : "summary_large_image", creator: seo.twitterHandle || undefined, images: image ? [image] : undefined },
  };
}

export const viewport: Viewport = {
  themeColor: siteConfig.colors.light,
};

/** Document shell shared by the storefront and the admin. Each area adds its own chrome. */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const localization = await getSettings("localization");
  return (
    <html lang={localization.defaultLocale} data-surface="light" className={`${interTight.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
