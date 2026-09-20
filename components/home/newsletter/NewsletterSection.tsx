import { newsletterConfig } from "@/config/newsletter";
import type { NewsletterContent } from "@/lib/content/schemas";
import { NewsletterForm } from "./NewsletterForm";
import styles from "./newsletter.module.css";

export function NewsletterSection({ copy }: { copy: NewsletterContent }) {
  return (
    <section id={newsletterConfig.id} className={styles.section} aria-labelledby="newsletter-heading">
      <h2 id="newsletter-heading">{copy.heading.map((line, i) => <span key={`${i}-${line}`}>{line}</span>)}</h2>
      <div className={styles.signup}>
        <p className={styles.description}>{copy.description}</p>
        <NewsletterForm submitLabel={copy.submitLabel} />
      </div>
    </section>
  );
}
