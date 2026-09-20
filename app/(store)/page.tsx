import { existsSync } from "node:fs";
import path from "node:path";
import { Hero } from "@/components/home/Hero";
import { CollectionExplorer } from "@/components/home/collections/CollectionExplorer";
import { withAvailableImages } from "@/lib/collectionAssets";
import { getHomepageCollections } from "@/lib/collections";
import { physicsProxyPath, type GarmentAssets } from "@/config/garmentPhysics";
import { explorerConfig, shirtConfig } from "@/config/site";
import { LookbookBrandStory } from "@/components/home/lookbook/LookbookBrandStory";
import { NewsletterSection } from "@/components/home/newsletter/NewsletterSection";
import { Footer } from "@/components/layout/Footer";
import { getCollections } from "@/lib/services/catalogService";
import { getHomepageContent, getLookbookImages } from "@/lib/content/siteContent";
import { getSettings } from "@/lib/settings/settingsService";

export default async function Home() {
  // Resolved on the server so a missing GLB never triggers a 404 request;
  // the procedural fallback shirt is used instead.
  const modelAvailable = existsSync(
    // Statically scoped to public/models so the build only traces that folder.
    path.join(process.cwd(), "public/models", path.basename(shirtConfig.modelPath)),
  );

  const assets: GarmentAssets = {
    proxyAvailable: existsSync(path.join(process.cwd(), "public", physicsProxyPath)),
    textures: {},
  };
  for (const name of ["basecolor", "normal", "roughness", "ao"] as const) {
    const url = `/textures/tshirt/${name}.webp`;
    if (existsSync(path.join(process.cwd(), "public", url))) assets.textures[name] = url;
  }

  const [collections, content, lookbook, features] = await Promise.all([getCollections(), getHomepageContent(), getLookbookImages(), getSettings("features")]);
  // Featured (admin-ordered, capped), stripped of image files that do not exist yet.
  const explorerCollections = withAvailableImages(getHomepageCollections(collections, explorerConfig.maxCollections));

  return (
    <>
    <main>
      <Hero modelAvailable={modelAvailable} assets={assets} copy={content.hero}>
        <CollectionExplorer collections={explorerCollections} />
      </Hero>
      {features.lookbook ? <LookbookBrandStory images={lookbook} copy={content.brandStory} /> : null}
      {features.newsletter ? <NewsletterSection copy={content.newsletter} /> : null}
    </main>
    <Footer />
    </>
  );
}
