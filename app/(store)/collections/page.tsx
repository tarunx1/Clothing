import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getCollections } from "@/lib/services/catalogService";
import { Footer } from "@/components/layout/Footer";
import styles from "./collections.module.css";

export const metadata: Metadata = {
  title: "Collections — BRAND",
  description: "Explore graphic essentials across Greek, Anime, Superhero, Motorsport and Dark Art.",
};

export default async function CollectionsPage() {
  const collections = await getCollections();

  return (
    <>
      <main className={styles.collectionsPage} data-paper-surface>
        <header className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>DISCIPLINE &amp; MYTH / COLLECTION 01</p>
            <h1 className={styles.title}>
              COLLECTIONS<span className={styles.count}>({String(collections.length).padStart(2, "0")})</span>
            </h1>
          </div>
          <p className={styles.introCopy}>
            Five distinct graphic worlds cut into 240–260 GSM combed cotton. Explore by thematic identity.
          </p>
        </header>

        <section className={styles.grid} aria-label="Collections list">
          {collections.map((col) => {
            const primaryImage = col.images?.[0]?.src || `/images/collections/${col.slug}/campaign-01.webp`;
            return (
              <article key={col.id} className={styles.card}>
                <Link href={`/shop?collection=${col.slug}`} className={styles.mediaWrapper} tabIndex={-1} aria-hidden="true">
                  <Image
                    src={primaryImage}
                    alt={col.name}
                    fill
                    sizes="(max-width: 900px) 100vw, 50vw"
                    className={styles.image}
                  />
                </Link>
                <div className={styles.cardContent}>
                  <div className={styles.info}>
                    <h2 className={styles.name}>
                      <Link href={`/shop?collection=${col.slug}`}>{col.name}</Link>
                    </h2>
                    <p className={styles.description}>{col.description || col.shortDescription}</p>
                  </div>
                  <Link href={`/shop?collection=${col.slug}`} className={styles.action}>
                    Explore Pieces <span>↗</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      </main>
      <Footer />
    </>
  );
}
