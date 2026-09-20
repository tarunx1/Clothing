import type { LookbookImage as LookbookImageData } from "@/types/lookbook";
import { LookbookImage } from "./LookbookImage";
import styles from "./lookbook.module.css";

export function LookbookLane({ images, lane }: { images: LookbookImageData[]; lane: number }) {
  return <div className={styles.lane} data-lookbook-lane={lane}>{images.map(image => <LookbookImage key={image.id} image={image} />)}</div>;
}
