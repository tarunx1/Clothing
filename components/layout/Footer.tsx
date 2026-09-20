import { siteConfig } from "@/config/site";
import { getStoreSettings } from "@/lib/content/siteContent";
import { getSettings } from "@/lib/settings/settingsService";
import Link from "next/link";
import styles from "./footer.module.css";

export async function Footer() {
  const { navigation, footer } = siteConfig;
  const [{ storeName }, site, social] = await Promise.all([getStoreSettings(), getSettings("site"), getSettings("social")]);
  const socialLinks = Object.entries(social).filter(([, href]) => href).map(([label, href]) => ({ label, href }));
  return (
    <footer className={styles.footer}>
      <Link className={styles.brand} href="/" aria-label={`${storeName} home`}>{storeName}</Link>
      <nav className={styles.links} aria-label={footer.navigationLabel}>
        {[site.footerLinks.length ? site.footerLinks : navigation.primary, [...(site.legalLinks.length ? site.legalLinks : footer.secondary), ...socialLinks, ...(site.footerEmail ? [{ label: site.footerEmail, href: `mailto:${site.footerEmail}` }] : []), ...(site.footerPhone ? [{ label: site.footerPhone, href: `tel:${site.footerPhone}` }] : [])]].map((group, index) => (
          <ul key={index}>{group.map(link => <li key={link.href}><a href={link.href}>{link.label}</a></li>)}</ul>
        ))}
      </nav>
      <p className={styles.copyright}>© {new Date().getFullYear()} {storeName}</p>
    </footer>
  );
}
