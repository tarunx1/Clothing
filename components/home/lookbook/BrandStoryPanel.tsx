"use client";

import { useState } from "react";
import Link from "next/link";
import type { BrandStoryContent } from "@/lib/content/schemas";
import styles from "./lookbook.module.css";

export function BrandStoryPanel({ copy }: { copy: BrandStoryContent }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={styles.panel}>
      <p className={styles.label} data-story-reveal>{copy.label}</p>
      <div className={styles.headingMask}><h2 id="brand-story-heading" data-story-reveal>{copy.heading}</h2></div>
      <p className={styles.description} data-story-reveal>{copy.paragraph}</p>
      <ul className={styles.details} data-story-reveal>{copy.details.map((detail, i) => <li key={`${i}-${detail}`}><span aria-hidden="true">0{i + 1}</span>{detail}</li>)}</ul>
      <div data-story-reveal>
        {copy.ctaHref ? <Link className={styles.cta} href={copy.ctaHref}>{copy.ctaLabel}<span aria-hidden="true">↗</span></Link> : <button className={styles.cta} type="button" aria-expanded={expanded} aria-controls="brand-story-more" onClick={() => setExpanded(!expanded)}>{expanded ? copy.ctaCloseLabel : copy.ctaLabel}<span aria-hidden="true">{expanded ? "−" : "↗"}</span></button>}
        <p id="brand-story-more" className={styles.expanded} hidden={!expanded}>{copy.story}</p>
      </div>
    </div>
  );
}
