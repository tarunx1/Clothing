import Link from "next/link";
import { BagButton } from "@/components/cart/BagButton";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { HeaderShell } from "@/components/layout/HeaderShell";
import { siteConfig } from "@/config/site";
import { getStoreSettings } from "@/lib/content/siteContent";
import { getSettings } from "@/lib/settings/settingsService";

const { navigation } = siteConfig;

/**
 * Minimal fixed header. Colour comes from `--header-fg`, which follows the
 * `data-surface` attribute on <html> (see lib/surfaceTheme.ts), so it
 * can turn white over dark sections without re-rendering.
 * Items marked `data-intro-nav` stay hidden while a hero intro is pending.
 */
export async function Header() {
  const [{ storeName }, branding] = await Promise.all([getStoreSettings(), getSettings("branding")]);
  return (
    <HeaderShell>
      <div className="grid grid-cols-2 items-start gap-y-3 px-(--gutter) pt-5 text-[11px] leading-none font-medium tracking-[0.04em] uppercase md:grid-cols-3 md:pt-6 md:text-xs">
        <Link
          href="/"
          data-intro-nav
          className="pointer-events-auto col-start-1 row-start-1 justify-self-start text-[13px] font-extrabold tracking-[-0.02em] md:text-sm"
          aria-label={`${storeName} home`}
        >
          {branding.logoLight || branding.logoDark ? <>
            {/* Uploaded branding uses existing public URLs without changing their storage. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="store-logo-light" src={branding.logoLight || branding.logoDark} alt={storeName} width={100} height={28} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="store-logo-dark" src={branding.logoDark || branding.logoLight} alt={storeName} width={100} height={28} />
          </> : branding.wordmark || storeName}
        </Link>

        <nav
          aria-label="Primary"
          className="col-span-2 col-start-1 row-start-2 md:col-span-1 md:col-start-2 md:row-start-1 md:justify-self-center"
        >
          <ul className="flex gap-5 md:gap-9">
            {navigation.primary.map((item) => (
              <li key={item.label} data-intro-nav>
                <Link href={item.href} className="nav-link pointer-events-auto">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="pointer-events-auto col-start-2 row-start-1 flex items-center justify-self-end gap-3.5 md:col-start-3" data-intro-nav>
          <ThemeToggle />
          <BagButton />
        </div>
      </div>
    </HeaderShell>
  );
}
