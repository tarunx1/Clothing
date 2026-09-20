import type { Metadata } from "next";
import { Shop } from "@/components/shop/Shop";
import { Footer } from "@/components/layout/Footer";
import { getCollections, getProducts } from "@/lib/services/catalogService";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const collections = await getCollections();
  const names = collections.filter((collection) => collection.enabled).map((collection) => collection.name);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0] ?? "every collection";
  return { title: "Shop", description: `Explore graphic essentials across ${list}.` };
}
export default async function ShopPage() {
  const [products, collections] = await Promise.all([getProducts(), getCollections()]);
  return <><Shop products={products} collections={collections} /><Footer /></>;
}
