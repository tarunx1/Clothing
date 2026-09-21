import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "About — BRAND",
  description: "Heavyweight essentials cut for those born to stand out.",
};

export default function AboutPage() {
  return (
    <>
      <main className={styles.aboutPage} data-paper-surface>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>MANIFESTO / PHILOSOPHY</p>
          <h1 className={styles.title}>BORN TO STAND OUT.</h1>
          <p className={styles.lead}>
            BRAND was founded with a singular conviction: streetwear should carry architectural weight, honest materials, and an unmistakable graphic point of view.
          </p>
        </header>

        <section className={styles.grid} aria-label="Brand Pillars">
          <div className={styles.pillar}>
            <span className={styles.pillarNumber}>01 / MATERIAL</span>
            <h2 className={styles.pillarTitle}>240–260 GSM Heavyweight Cotton</h2>
            <p className={styles.pillarBody}>
              Every garment is knitted from dense, combed 100% organic cotton. Pre-shrunk and double-stitched at stress points to hold its structural drape wash after wash.
            </p>
          </div>

          <div className={styles.pillar}>
            <span className={styles.pillarNumber}>02 / SILHOUETTE</span>
            <h2 className={styles.pillarTitle}>Architectural Boxy Cut</h2>
            <p className={styles.pillarBody}>
              Dropped shoulders, reinforced ribbed crew necks, and a relaxed boxy body engineered for balanced proportions. Designed to frame the body without clinging.
            </p>
          </div>

          <div className={styles.pillar}>
            <span className={styles.pillarNumber}>03 / ARTWORK</span>
            <h2 className={styles.pillarTitle}>Pigment &amp; Screen Craft</h2>
            <p className={styles.pillarBody}>
              From classical Greek busts to high-octane motorsport iconography and intricate occult linework, our graphics are screen-printed with fine pigment inks that age with character.
            </p>
          </div>
        </section>

        <section className={styles.ctaSection}>
          <p className={styles.ctaText}>Explore our current season releases.</p>
          <Link href="/shop" className={styles.ctaButton}>
            View The Shop <span>↗</span>
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
