import { Header } from "@/components/layout/Header";
import { SmoothScrollProvider } from "@/components/animation/SmoothScrollProvider";
import { getSettings } from "@/lib/settings/settingsService";
import { StoreAnalytics } from "@/components/settings/StoreAnalytics";
import { siteConfig } from "@/config/site";
import { formatMoney } from "@/lib/money";
import { StorePreferences } from "@/components/settings/StorePreferences";

/** Storefront chrome: smooth scroll and the marketing header. The admin does not load these. */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [analytics, site, ar, localization, returns, shipping, seo, general, branding, social, cdn] = await Promise.all([getSettings("analytics"), getSettings("site"), getSettings("ar"), getSettings("localization"), getSettings("returns"), getSettings("shipping"), getSettings("seo"), getSettings("general"), getSettings("branding"), getSettings("social"), getSettings("cdn")]);
  const shippingAndReturns = ["Shipping options and delivery times are shown at checkout.", ...(shipping.freeShippingEnabled ? [`Free shipping on eligible methods over ${formatMoney(shipping.freeShippingThreshold / 100, localization.defaultCurrency)}.`] : []), returns.enabled ? `Returns accepted within ${returns.windowDays} days.` : "Returns are not currently offered.", ...(returns.exchangesEnabled ? ["Exchanges are available."] : []), ...(returns.instructions ? [returns.instructions] : [])];
  const organization = { "@context": "https://schema.org", "@type": "Organization", name: seo.organizationName || general.storeName, url: seo.canonicalBaseUrl || siteConfig.url, logo: branding.logoLight || undefined, sameAs: Object.values(social).filter(Boolean) };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization).replaceAll("<", "\\u003c") }} />
      <noscript>
        <style>{`[data-intro-nav],[data-reveal-line],[data-reveal-fade]{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <StorePreferences value={{ desktopQuality: ar.defaultModelQuality, mobileQuality: ar.mobileQuality, sizeUnit: localization.sizeUnit === "INCHES" ? "in" : "cm", shippingAndReturns, cdn }}><SmoothScrollProvider>
        <Header />
        {site.announcementEnabled && site.announcementText ? <aside className="store-announcement">{site.announcementHref ? <a href={site.announcementHref}>{site.announcementText}</a> : site.announcementText}</aside> : null}
        {children}
      </SmoothScrollProvider></StorePreferences>
      <StoreAnalytics config={analytics} />
    </>
  );
}
