import Image from "@/components/ui/StoreImage";
import type { LookbookImage as LookbookImageData } from "@/types/lookbook";
import styles from "./lookbook.module.css";

export function LookbookImage({ image }: { image: LookbookImageData }) {
  return (
    <figure className={styles.frame}>
      <Image src={image.src} alt={image.alt} fill sizes="(max-width: 767px) 82vw, (max-width: 1099px) 30vw, 20vw" style={{ objectPosition: image.position ?? "50% 35%" }} />
    </figure>
  );
}
