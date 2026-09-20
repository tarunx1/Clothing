import type { Product, ProductImage, ProductVariant } from "@/types/product";

/**
 * Illustrative local catalog: prices, stock and fabric specs are seed values,
 * not inventory. Imagery is generated campaign concepts, not product proof.
 * A future admin/API replaces this module; nothing in the UI depends on it
 * beyond lib/products.ts.
 */

interface Seed {
  collection: string;
  /** Where the print sits in campaign-01 (0–1), used for the close-up crop. */
  printFocus: { x: number; y: number };
  printName: string;
}

function media(slug: string, name: string, { collection, printFocus, printName }: Seed): ProductImage[] {
  const base = `/images/collections/${collection}`;
  return [
    { id: `${slug}-model`, src: `${base}/campaign-01.webp`, alt: `${name} worn by a model, front view`, type: "model", order: 1 },
    { id: `${slug}-lifestyle`, src: `${base}/campaign-02.webp`, alt: `${name} worn by a model leaning against a wall`, type: "lifestyle", order: 2 },
    { id: `${slug}-print`, src: `${base}/campaign-01.webp`, alt: `Close-up of the ${printName} print on the ${name}`, type: "detail", order: 3, focalPoint: printFocus, zoom: 1.6 },
  ];
}

function variants(code: string, color: string, colorHex: string, price: number, stock: Partial<Record<string, number>>): ProductVariant[] {
  return Object.entries(stock).map(([size, units]) => {
    const sku = `${code}-${color.replace(/\s+/g, "").slice(0, 4).toUpperCase()}-${size}`;
    return ({
    id: sku,
    sku,
    size,
    color,
    colorHex,
    price,
    stock: units ?? 0,
    enabled: true,
  });
  });
}

const heavyweight = {
  currency: "INR" as const,
  material: "100% cotton",
  gsm: 240,
  fit: "Oversized",
  fitNotes: ["Oversized", "Dropped shoulder", "Boxy length"],
  fitAdvice: "Size down for a closer fit.",
  care: ["Cold wash, inside out", "Do not tumble dry", "Do not iron the print"],
  sizeChart: "oversized",
};

export const products: Product[] = [
  {
    ...heavyweight,
    id: "sculpture-tee",
    slug: "sculpture-tee",
    name: "Sculpture Tee",
    subtitle: "Oversized heavyweight tee",
    description: "Classical form, a relaxed silhouette. An oversized graphic tee with an ivory sculpture print and a washed finish.",
    details: "Heavyweight graphic tee with a dropped shoulder, ribbed crew neck and an ivory classical sculpture framed by a meander border.",
    price: 2800,
    collectionId: "col-greek",
    print: "Washed ivory print",
    images: media("sculpture-tee", "Sculpture Tee", { collection: "greek", printFocus: { x: 0.43, y: 0.5 }, printName: "sculpture" }),
    variants: variants("SCU", "Washed black", "#2b2a28", 2800, { XS: 4, S: 12, M: 18, L: 2, XL: 0 }),
    featured: true,
    releaseOrder: 3,
    relatedIds: ["voltage-tee", "serpent-tee"],
  },
  {
    ...heavyweight,
    id: "impact-tee",
    slug: "impact-tee",
    name: "Impact Tee",
    subtitle: "Oversized heavyweight tee",
    description: "A frame before impact. A manga-inspired eye graphic with red linework, on an easy oversized cut.",
    details: "Oversized tee with a monochrome manga eye and red speed-line print across the chest.",
    price: 2600,
    collectionId: "col-anime",
    print: "Two-colour screen print",
    images: media("impact-tee", "Impact Tee", { collection: "anime", printFocus: { x: 0.47, y: 0.44 }, printName: "manga eye" }),
    variants: variants("IMP", "Charcoal", "#3a3a3a", 2600, { S: 8, M: 3, L: 15, XL: 9, XXL: 0 }),
    releaseOrder: 5,
    relatedIds: ["pit-lane-tee", "voltage-tee"],
  },
  {
    ...heavyweight,
    id: "pit-lane-tee",
    slug: "pit-lane-tee",
    name: "Pit Lane Tee",
    subtitle: "Boxy racing tee",
    description: "Off the track, into the everyday. A relaxed racing tee with a distressed 27 print and faded red sleeve stripes.",
    details: "Boxy racing tee with a distressed off-white 27 across the chest and faded red stripes on both sleeves.",
    price: 3200,
    collectionId: "col-motorsport",
    gsm: 260,
    fit: "Boxy",
    sizeChart: "boxy",
    fitNotes: ["Boxy", "Dropped shoulder", "Cropped length"],
    fitAdvice: "True to size for a boxy fit.",
    print: "Distressed high-density print",
    images: media("pit-lane-tee", "Pit Lane Tee", { collection: "motorsport", printFocus: { x: 0.52, y: 0.42 }, printName: "number 27" }),
    variants: variants("PIT", "Washed black", "#2b2a28", 3200, { XS: 6, S: 10, M: 1, L: 7, XL: 5 }),
    releaseOrder: 4,
    relatedIds: ["impact-tee", "sculpture-tee"],
  },
  {
    ...heavyweight,
    id: "voltage-tee",
    slug: "voltage-tee",
    name: "Voltage Tee",
    subtitle: "Oversized heavyweight tee",
    description: "A bold lightning shield, stripped back to silver and black. A graphic essential with a loose, boxy shape.",
    details: "Loose, boxy tee with a distressed silver lightning shield at the chest.",
    price: 2800,
    collectionId: "col-superhero",
    print: "Metallic silver print",
    images: media("voltage-tee", "Voltage Tee", { collection: "superhero", printFocus: { x: 0.5, y: 0.47 }, printName: "lightning shield" }),
    variants: variants("VOL", "Black", "#141414", 2800, { S: 9, M: 14, L: 11, XL: 3 }),
    releaseOrder: 2,
    relatedIds: ["sculpture-tee", "pit-lane-tee"],
  },
  {
    ...heavyweight,
    id: "serpent-tee",
    slug: "serpent-tee",
    name: "Serpent Tee",
    subtitle: "Oversized heavyweight tee",
    description: "Intricate serpent and botanical linework on faded black cotton. A darker point of view, in an oversized silhouette.",
    details: "Oversized tee with fine ivory serpent and gothic botanical linework running down the chest.",
    price: 3000,
    collectionId: "col-dark-art",
    print: "Fine-line ivory print",
    images: media("serpent-tee", "Serpent Tee", { collection: "dark-art", printFocus: { x: 0.5, y: 0.55 }, printName: "serpent" }),
    variants: variants("SRP", "Washed black", "#2b2a28", 3000, { M: 0, L: 0, XL: 0 }),
    releaseOrder: 1,
    relatedIds: ["sculpture-tee", "impact-tee"],
  },
];
