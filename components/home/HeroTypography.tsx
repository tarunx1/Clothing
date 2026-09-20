import { ANIM, type AnimTarget } from "@/lib/animationTargets";
import type { HeroContent } from "@/lib/content/schemas";

interface Targets {
  block: AnimTarget;
  line: AnimTarget;
  caption: AnimTarget;
  /** Optional wrapper animated on exit, so intro and scroll never fight. */
  exit?: AnimTarget;
}

interface EditorialHeadingProps {
  lines: readonly string[];
  caption?: string;
  as?: "h1" | "h2";
  targets: Targets;
  className?: string;
}

/**
 * Oversized editorial heading. Every line (and the caption) sits inside an
 * overflow mask; timelines slide the inner span from 110% to 0%.
 * Screen readers get the sentence once, without the visual line breaks.
 */
function EditorialHeading({ lines, caption, as: Tag = "h2", targets, className = "" }: EditorialHeadingProps) {
  const masked = (content: string, target: AnimTarget, key: string) => (
    <span key={key} className="line-mask">
      <span data-anim={targets.exit} className="block">
        <span data-anim={target} data-reveal-line className="block whitespace-nowrap">
          {content}
        </span>
      </span>
    </span>
  );

  return (
    // Outer element owns CSS positioning; GSAP only transforms the inner wrapper,
    // so responsive translate utilities never get baked into animated values.
    <div className={className}>
      <div data-anim={targets.block}>
        <Tag className="display-type text-[clamp(3rem,8.7vw,14rem)] stacked:text-[14.6vw]">
          <span className="sr-only">{lines.join(" ")}</span>
          <span aria-hidden="true" className="block">
            {lines.map((line, i) => masked(line, targets.line, `${i}-${line}`))}
          </span>
        </Tag>
        {caption ? (
          <p className="mt-6 pl-[0.3em] text-[11px] leading-snug font-medium tracking-[0.06em] uppercase md:mt-8 md:text-xs">
            {masked(caption, targets.caption, "caption")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

const blockPosition =
  "absolute left-(--gutter) top-1/2 -translate-y-1/2 stacked:top-[max(7.5rem,15svh)] stacked:translate-y-0";

/** Left-side hero typography: the opening line and the "turn around" line. */
export function HeroTypography({ copy: hero }: { copy: HeroContent }) {
  return (
    <>
      <EditorialHeading
        as="h1"
        lines={hero.headline}
        caption={hero.caption || undefined}
        className={`${blockPosition} text-black`}
        targets={{
          block: ANIM.headlineBlock,
          line: ANIM.headlineLine,
          caption: ANIM.headlineCaption,
          exit: ANIM.headlineExit,
        }}
      />
      <EditorialHeading
        lines={hero.turnHeadline}
        caption={hero.turnCaption || undefined}
        className={`${blockPosition} text-white`}
        targets={{ block: ANIM.turnBlock, line: ANIM.turnLine, caption: ANIM.turnCaption, exit: ANIM.turnExit }}
      />
    </>
  );
}
