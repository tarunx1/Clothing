import Image from "@/components/ui/StoreImage";
import styles from "./admin.module.css";

/** Small optimized preview (next/image resizes; the original file is never sent to a 40px cell). */
export function Thumb({ src, alt, size = 40 }: { src?: string | null; alt?: string; size?: number }) {
  return (
    <span className={styles.thumb} style={{ width: size, height: Math.round(size * 1.2) }}>
      {src ? <Image src={src} alt={alt ?? ""} fill sizes={`${size}px`} /> : null}
    </span>
  );
}
