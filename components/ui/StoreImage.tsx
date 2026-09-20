"use client";
import Image, { type ImageProps } from "next/image";
import { useStorePreferences } from "@/components/settings/StorePreferences";

/** Configured remote providers work without broadening the server optimizer's URL allowlist. */
export default function StoreImage(props: ImageProps) {
  const { cdn } = useStorePreferences();
  let src = props.src;
  if (typeof src === "string") {
    const base = src.startsWith("/images/") ? cdn?.assetBaseUrl : src.startsWith("/media/") ? cdn?.mediaBaseUrl : "";
    if (base) src = `${base.replace(/\/$/, "")}${src}`;
  }
  const remote = typeof src === "string" && /^https?:\/\//.test(src);
  return <Image {...props} src={src} unoptimized={props.unoptimized || remote || cdn?.optimizeLocalImages === false} />;
}
