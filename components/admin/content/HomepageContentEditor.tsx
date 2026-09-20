"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { FormField, TextareaField } from "@/components/ui/FormField";
import { updateContentAction } from "@/lib/admin/actions/content";
import type { BrandStoryContent, HeroContent, NewsletterContent } from "@/lib/content/schemas";
import { useToast } from "../Toaster";
import styles from "../admin.module.css";

type Section = "hero" | "brandStory" | "newsletter";
const toLines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);

/** Shared save/feedback wrapper for one content slot. Layout and motion stay in code; only words change. */
function ContentForm({ section, title, description, toValue, children }: { section: Section; title: string; description: string; toValue: (data: FormData) => unknown; children: (errors: Record<string, string>) => ReactNode }) {
  const notify = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const result = await updateContentAction(section, toValue(new FormData(event.currentTarget)));
    setBusy(false);
    if (!result.ok) {
      // "headline.1" → "headline" so list errors land on their textarea.
      setErrors(Object.fromEntries(Object.entries(result.fieldErrors ?? {}).map(([key, message]) => [key.split(".")[0], message])));
      notify(result.error, "error");
      return;
    }
    setErrors({});
    notify(`${title} saved. The homepage updates on its next visit.`);
  };
  return (
    <form className={styles.panel} onSubmit={submit} noValidate aria-labelledby={`content-${section}`}>
      <div className={styles.panelHead}>
        <div><h2 id={`content-${section}`}>{title}</h2><p>{description}</p></div>
        <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
      <div className={`${styles.panelBody} ${styles.fields}`}>{children(errors)}</div>
    </form>
  );
}

export function HomepageContentEditor({ hero, brandStory, newsletter }: { hero: HeroContent; brandStory: BrandStoryContent; newsletter: NewsletterContent }) {
  const text = (data: FormData, key: string) => String(data.get(key) ?? "");
  return (
    <div className={styles.stack}>
      <ContentForm
        section="hero"
        title="Hero"
        description="Opening headline and the ‘turn around’ line. One line per row, up to 3 rows."
        toValue={(data) => ({ headline: toLines(text(data, "headline")), caption: text(data, "caption"), turnHeadline: toLines(text(data, "turnHeadline")), turnCaption: text(data, "turnCaption"), metaLeft: text(data, "metaLeft"), metaRight: text(data, "metaRight") })}
      >
        {(errors) => (
          <>
            <div className={styles.fieldRow}>
              <TextareaField id="hero-headline" name="headline" label="Headline" density="compact" rows={3} defaultValue={hero.headline.join("\n")} error={errors.headline} hint="Each row is one animated line." />
              <TextareaField id="hero-turn" name="turnHeadline" label="Turn-around headline" density="compact" rows={3} defaultValue={hero.turnHeadline.join("\n")} error={errors.turnHeadline} />
            </div>
            <div className={styles.fieldRow}>
              <FormField id="hero-caption" name="caption" label="Caption" optional density="compact" defaultValue={hero.caption} error={errors.caption} />
              <FormField id="hero-turn-caption" name="turnCaption" label="Turn-around caption" optional density="compact" defaultValue={hero.turnCaption} error={errors.turnCaption} />
            </div>
            <div className={styles.fieldRow}>
              <FormField id="hero-meta-left" name="metaLeft" label="Footer label (left)" optional density="compact" defaultValue={hero.metaLeft} error={errors.metaLeft} />
              <FormField id="hero-meta-right" name="metaRight" label="Footer label (right)" optional density="compact" defaultValue={hero.metaRight} error={errors.metaRight} />
            </div>
          </>
        )}
      </ContentForm>

      <ContentForm
        section="brandStory"
        title="Brand story"
        description="The ‘Our world’ panel beside the lookbook."
        toValue={(data) => ({ chapter: text(data, "chapter"), edition: text(data, "edition"), label: text(data, "label"), heading: text(data, "heading"), paragraph: text(data, "paragraph"), details: toLines(text(data, "details")), ctaLabel: text(data, "ctaLabel"), ctaCloseLabel: text(data, "ctaCloseLabel"), ctaHref: text(data, "ctaHref"), story: text(data, "story"), footer: text(data, "footer") })}
      >
        {(errors) => (
          <>
            <div className={styles.fieldRow}>
              <FormField id="story-label" name="label" label="Label" density="compact" defaultValue={brandStory.label} error={errors.label} />
              <FormField id="story-heading" name="heading" label="Heading" density="compact" defaultValue={brandStory.heading} error={errors.heading} />
            </div>
            <TextareaField id="story-paragraph" name="paragraph" label="Paragraph" density="compact" rows={3} defaultValue={brandStory.paragraph} error={errors.paragraph} />
            <TextareaField id="story-details" name="details" label="Detail bullets" density="compact" rows={3} defaultValue={brandStory.details.join("\n")} error={errors.details} hint="One bullet per row, up to 5." />
            <div className={styles.fieldRow3}>
              <FormField id="story-cta" name="ctaLabel" label="CTA label" density="compact" defaultValue={brandStory.ctaLabel} error={errors.ctaLabel} />
              <FormField id="story-cta-close" name="ctaCloseLabel" label="CTA close label" density="compact" defaultValue={brandStory.ctaCloseLabel} error={errors.ctaCloseLabel} />
              <FormField id="story-cta-href" name="ctaHref" label="CTA destination" optional density="compact" placeholder="/shop or https://…" defaultValue={brandStory.ctaHref} error={errors.ctaHref} hint="Empty: the CTA expands the longer story below." />
            </div>
            <TextareaField id="story-story" name="story" label="Longer story" optional density="compact" rows={3} defaultValue={brandStory.story} error={errors.story} />
            <div className={styles.fieldRow3}>
              <FormField id="story-chapter" name="chapter" label="Chapter label" optional density="compact" defaultValue={brandStory.chapter} error={errors.chapter} />
              <FormField id="story-edition" name="edition" label="Edition label" optional density="compact" defaultValue={brandStory.edition} error={errors.edition} />
              <FormField id="story-footer" name="footer" label="Footer line" optional density="compact" defaultValue={brandStory.footer} error={errors.footer} />
            </div>
          </>
        )}
      </ContentForm>

      <ContentForm
        section="newsletter"
        title="Newsletter"
        description="Homepage sign-up copy. Email campaigns are not managed here."
        toValue={(data) => ({ heading: toLines(text(data, "heading")), description: text(data, "description"), submitLabel: text(data, "submitLabel") })}
      >
        {(errors) => (
          <>
            <TextareaField id="news-heading" name="heading" label="Heading" density="compact" rows={2} defaultValue={newsletter.heading.join("\n")} error={errors.heading} hint="One line per row." />
            <div className={styles.fieldRow}>
              <FormField id="news-description" name="description" label="Supporting copy" density="compact" defaultValue={newsletter.description} error={errors.description} />
              <FormField id="news-button" name="submitLabel" label="Button label" density="compact" defaultValue={newsletter.submitLabel} error={errors.submitLabel} />
            </div>
          </>
        )}
      </ContentForm>
    </div>
  );
}
