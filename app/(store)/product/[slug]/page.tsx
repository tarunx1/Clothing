import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductPage } from "@/components/product/ProductPage";
import { withAvailableMedia } from "@/lib/productAssets";
import { listingImages } from "@/lib/products";
import { getStoreSettings } from "@/lib/content/siteContent";
import { getSettings } from "@/lib/settings/settingsService";
import { getProductBySlug, getProducts, getRelatedProducts } from "@/lib/services/catalogService";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Not found" };
  const [image] = listingImages(withAvailableMedia(product));
  const title = product.name;
  const { storeName } = await getStoreSettings();
  return {
    title,
    description: product.description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: `${title} — ${storeName}`,
      description: product.description,
      type: "website",
      images: image ? [{ url: image.src, alt: image.alt }] : undefined,
    },
  };
}

export default async function ProductRoute({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const found = await getProductBySlug(slug);
  if (!found) notFound();
  const product = withAvailableMedia(found);
  if (!(await getSettings("features")).threeDViewer) product.model3d = undefined;
  const [related, { storeName }, seo] = await Promise.all([
    getRelatedProducts(found).then((list) => list.map(withAvailableMedia)),
    getStoreSettings(),
    getSettings("seo").catch(() => null),
  ]);

  const inStock = product.variants.some((v) => v.enabled && v.stock > 0);
  const images = listingImages(product)
    .filter((img): img is NonNullable<typeof img> => Boolean(img))
    .map((img) => img.src);
  const baseUrl = (seo?.canonicalBaseUrl || siteConfig.url).replace(/\/$/, "");

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: images,
    brand: {
      "@type": "Brand",
      name: storeName,
    },
    offers: {
      "@type": "Offer",
      url: `${baseUrl}/product/${product.slug}`,
      priceCurrency: product.currency,
      price: product.price,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema).replaceAll("<", "\\u003c") }}
      />
      <ProductPage product={product} related={related} />
    </>
  );
}
