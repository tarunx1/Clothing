import { z } from "zod";
import { brandStory } from "@/config/brandStory";
import { newsletterConfig } from "@/config/newsletter";
import { siteConfig } from "@/config/site";

const line = (max: number) => z.string().trim().min(1, "Required").max(max, `Keep it under ${max} characters`);
const lines = (max: number, count: number) => z.array(line(max)).min(1, "Add at least one line").max(count, `Use at most ${count} lines`);

/** Internal path ("/shop") or absolute https URL. */
const href = z
  .string()
  .trim()
  .max(300)
  .refine((value) => value === "" || (/^\/(?!\/)/.test(value)) || /^https:\/\/[^\s]+$/.test(value), "Use a path like /shop or an https:// link");

export const heroContentSchema = z.object({
  headline: lines(28, 3),
  caption: z.string().trim().max(80),
  turnHeadline: lines(28, 3),
  turnCaption: z.string().trim().max(80),
  metaLeft: z.string().trim().max(40),
  metaRight: z.string().trim().max(40),
});

export const brandStoryContentSchema = z.object({
  chapter: z.string().trim().max(60),
  edition: z.string().trim().max(60),
  label: line(40),
  heading: line(120),
  paragraph: line(400),
  details: lines(60, 5),
  ctaLabel: line(40),
  ctaCloseLabel: line(40),
  /** Empty: the CTA expands the longer story in place. */
  ctaHref: href,
  story: z.string().trim().max(1200),
  footer: z.string().trim().max(80),
});

export const newsletterContentSchema = z.object({
  heading: lines(32, 3),
  description: line(200),
  submitLabel: line(20),
});

export const contentSchemas = {
  hero: heroContentSchema,
  brandStory: brandStoryContentSchema,
  newsletter: newsletterContentSchema,
} as const;

export type ContentKey = keyof typeof contentSchemas;
export type ContentValue<K extends ContentKey> = z.infer<(typeof contentSchemas)[K]>;
export type HeroContent = ContentValue<"hero">;
export type BrandStoryContent = ContentValue<"brandStory">;
export type NewsletterContent = ContentValue<"newsletter">;

/** Launch copy from source config: used until the owner saves a value in the admin. */
export const contentDefaults: { [K in ContentKey]: ContentValue<K> } = {
  hero: {
    headline: [...siteConfig.hero.headline],
    caption: siteConfig.hero.caption,
    turnHeadline: [...siteConfig.hero.turnHeadline],
    turnCaption: siteConfig.hero.turnCaption,
    metaLeft: siteConfig.hero.meta.left,
    metaRight: siteConfig.hero.meta.right,
  },
  brandStory: {
    chapter: brandStory.chapter,
    edition: brandStory.edition,
    label: brandStory.label,
    heading: brandStory.heading,
    paragraph: brandStory.paragraph,
    details: [...brandStory.details],
    ctaLabel: brandStory.cta.label,
    ctaCloseLabel: brandStory.cta.closeLabel,
    ctaHref: brandStory.cta.href ?? "",
    story: brandStory.story,
    footer: brandStory.footer,
  },
  newsletter: {
    heading: [...newsletterConfig.heading],
    description: newsletterConfig.description,
    submitLabel: newsletterConfig.submitLabel,
  },
};

export const CONTENT_KEYS = Object.keys(contentSchemas) as ContentKey[];
