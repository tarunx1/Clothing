import type { LookbookImage } from "@/types/lookbook";
import { LookbookLane } from "./LookbookLane";
import { brandStory } from "@/config/brandStory";
import styles from "./lookbook.module.css";

export function LookbookLanes({ images }: { images: LookbookImage[] }) {
  return <div className={styles.lanes} tabIndex={0} role="region" aria-label={brandStory.galleryLabel}>{([1, 2, 3] as const).map(lane => <LookbookLane key={lane} lane={lane} images={images.filter(image => image.lane === lane).sort((a, b) => a.order - b.order)} />)}</div>;
}
