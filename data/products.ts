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
    id: "akaal",
    slug: "akaal",
    name: "Akaal T-Shirt - Washed Black",
    subtitle: "Oversized heavyweight tee",
    description: "Bold typographic streetwear. Heavyweight cotton featuring the iconic Akaal 84 graphic.",
    details: "240 GSM 100% combed cotton, dropped shoulder boxy cut with crisp screen print across the chest.",
    price: 1300,
    compareAtPrice: 1499,
    collectionId: "col-dark-art",
    print: "Typographic screen print",
    images: [
      { id: "akaal-model", src: "/images/products/akaal-model.jpg", alt: "Akaal T-Shirt worn by model", type: "model", order: 1 },
      { id: "akaal-02", src: "/images/products/akaal-02.jpg", alt: "Akaal T-Shirt flat lay", type: "front", order: 2 },
    ],
    variants: variants("AKL", "Black", "#141414", 1300, { S: 10, M: 25, L: 18, XL: 8 }),
    featured: true,
    releaseOrder: 10,
    relatedIds: ["almond-blossoms-van-gogh", "angel", "black-santa-rose"],
  },
  {
    ...heavyweight,
    id: "almond-blossoms-van-gogh",
    slug: "almond-blossoms-van-gogh",
    name: "Almond Blossoms T-Shirt - Off White",
    subtitle: "Oversized art tee",
    description: "Impressionist masterpiece meets contemporary streetwear. Van Gogh's Almond Blossoms on off-white cotton.",
    details: "240 GSM heavyweight cotton with vibrant turquoise and white blossom artwork.",
    price: 1100,
    compareAtPrice: 1399,
    collectionId: "col-greek",
    print: "Fine pigment screen print",
    images: [
      { id: "almond-model", src: "/images/products/almond-model.jpg", alt: "Almond Blossoms Van Gogh T-Shirt worn by model", type: "model", order: 1 },
      { id: "almond-02", src: "/images/products/almond-02.jpg", alt: "Almond Blossoms Van Gogh T-Shirt flat lay", type: "front", order: 2 },
    ],
    variants: variants("ALM", "Off-White", "#f4f1ea", 1100, { S: 12, M: 20, L: 15, XL: 6 }),
    featured: true,
    releaseOrder: 9,
    relatedIds: ["akaal", "angel", "black-santa-rose"],
  },
  {
    ...heavyweight,
    id: "angel",
    slug: "angel",
    name: "Angel Graphic T-Shirt - Washed Black",
    subtitle: "Oversized graphic tee",
    description: "Gothic guardian. An intricate hooded winged angel resting on a medieval broadsword.",
    details: "240 GSM washed black cotton with fine-line white screen print.",
    price: 1100,
    compareAtPrice: 1399,
    collectionId: "col-dark-art",
    print: "Fine-line gothic print",
    images: [
      { id: "angel-model", src: "/images/products/angel-model.jpg", alt: "Angel T-Shirt worn by model", type: "model", order: 1 },
      { id: "angel-01", src: "/images/products/angel-01.jpg", alt: "Angel T-Shirt flat lay", type: "front", order: 2 },
    ],
    variants: variants("ANG", "Black", "#141414", 1100, { S: 15, M: 30, L: 22, XL: 10 }),
    featured: true,
    releaseOrder: 8,
    relatedIds: ["akaal", "almond-blossoms-van-gogh", "black-santa-rose"],
  },
  {
    ...heavyweight,
    id: "black-santa-rose",
    slug: "black-santa-rose",
    name: "Black Santa Rose T-Shirt - Black",
    subtitle: "Embroidered luxury tee",
    description: "Subtle elegance. Washed black heavy cotton featuring a delicate embroidered red rose emblem.",
    details: "240 GSM organic cotton with high-density embroidered red rose emblem.",
    price: 1100,
    compareAtPrice: 1399,
    collectionId: "col-anime",
    print: "High-density embroidery",
    images: [
      { id: "rose-model", src: "/images/products/rose-model.jpg", alt: "Black Santa Rose T-Shirt worn by model", type: "model", order: 1 },
      { id: "rose-02", src: "/images/products/rose-02.jpg", alt: "Black Santa Rose T-Shirt flat lay", type: "front", order: 2 },
    ],
    variants: variants("BSR", "Black", "#141414", 1100, { S: 8, M: 18, L: 14, XL: 5 }),
    featured: true,
    releaseOrder: 7,
    relatedIds: ["akaal", "almond-blossoms-van-gogh", "angel"],
  },
  {
    ...heavyweight,
    id: "sculpture-tee",
    slug: "sculpture-tee",
    name: "Sculpture T-Shirt - Washed Black",
    subtitle: "Oversized heavyweight tee",
    description: "Classical form, a relaxed silhouette. An oversized graphic tee with an ivory sculpture print and a washed finish.",
    details: "Heavyweight graphic tee with a dropped shoulder, ribbed crew neck and an ivory classical sculpture framed by a meander border.",
    price: 2800,
    compareAtPrice: 2999,
    collectionId: "col-greek",
    print: "Washed ivory print",
    images: [
      { id: "sculpture-02", src: "/images/collections/greek/campaign-01.webp", alt: "Sculpture Tee worn by model", type: "model", order: 1 },
      { id: "sculpture-01", src: "/images/products/sculpture-01.jpg", alt: "Sculpture Tee flat lay", type: "front", order: 2 },
    ],
    variants: variants("SCU", "Washed black", "#2b2a28", 2800, { XS: 4, S: 12, M: 18, L: 2, XL: 0 }),
    featured: true,
    releaseOrder: 3,
    relatedIds: ["voltage-tee", "serpent-tee"],
  },
  {
    ...heavyweight,
    id: "impact-tee",
    slug: "impact-tee",
    name: "Impact T-Shirt - Charcoal",
    subtitle: "Oversized heavyweight tee",
    description: "A frame before impact. A manga-inspired eye graphic with red linework, on an easy oversized cut.",
    details: "Oversized tee with a monochrome manga eye and red speed-line print across the chest.",
    price: 2600,
    compareAtPrice: 2799,
    collectionId: "col-anime",
    print: "Two-colour screen print",
    images: [
      { id: "impact-02", src: "/images/collections/anime/campaign-01.webp", alt: "Impact Tee worn by model", type: "model", order: 1 },
      { id: "impact-01", src: "/images/products/impact-01.jpg", alt: "Impact Tee flat lay", type: "front", order: 2 },
    ],
    variants: variants("IMP", "Charcoal", "#3a3a3a", 2600, { S: 8, M: 3, L: 15, XL: 9, XXL: 0 }),
    releaseOrder: 5,
    relatedIds: ["pit-lane-tee", "voltage-tee"],
  },
  {
    ...heavyweight,
    id: "pit-lane-tee",
    slug: "pit-lane-tee",
    name: "Pit Lane Racing T-Shirt - Washed Black",
    subtitle: "Boxy racing tee",
    description: "Off the track, into the everyday. A relaxed racing tee with a distressed 27 print and faded red sleeve stripes.",
    details: "Boxy racing tee with a distressed off-white 27 across the chest and faded red stripes on both sleeves.",
    price: 3200,
    compareAtPrice: 3499,
    collectionId: "col-motorsport",
    gsm: 260,
    fit: "Boxy",
    sizeChart: "boxy",
    fitNotes: ["Boxy", "Dropped shoulder", "Cropped length"],
    fitAdvice: "True to size for a boxy fit.",
    print: "Distressed high-density print",
    images: [
      { id: "pit-lane-02", src: "/images/collections/motorsport/campaign-01.webp", alt: "Pit Lane Tee worn by model", type: "model", order: 1 },
      { id: "pit-lane-01", src: "/images/products/pit-lane-01.jpg", alt: "Pit Lane Tee flat lay", type: "front", order: 2 },
      { id: "pit-lane-03", src: "/images/collections/motorsport/campaign-02.webp", alt: "Pit Lane Tee lifestyle", type: "lifestyle", order: 3 },
    ],
    variants: variants("PIT", "Washed black", "#2b2a28", 3200, { XS: 6, S: 10, M: 1, L: 7, XL: 5 }),
    releaseOrder: 4,
    relatedIds: ["impact-tee", "sculpture-tee"],
  },
  {
    ...heavyweight,
    id: "voltage-tee",
    slug: "voltage-tee",
    name: "Voltage T-Shirt - Black",
    subtitle: "Oversized heavyweight tee",
    description: "A bold lightning shield, stripped back to silver and black. A graphic essential with a loose, boxy shape.",
    details: "Loose, boxy tee with a distressed silver lightning shield at the chest.",
    price: 2800,
    compareAtPrice: 2999,
    collectionId: "col-superhero",
    print: "Metallic silver print",
    images: [
      { id: "voltage-02", src: "/images/collections/superhero/campaign-01.webp", alt: "Voltage Tee worn by model", type: "model", order: 1 },
      { id: "voltage-01", src: "/images/products/voltage-01.jpg", alt: "Voltage Tee flat lay", type: "front", order: 2 },
      { id: "voltage-03", src: "/images/collections/superhero/campaign-02.webp", alt: "Voltage Tee lifestyle", type: "lifestyle", order: 3 },
    ],
    variants: variants("VOL", "Black", "#141414", 2800, { S: 9, M: 14, L: 11, XL: 3 }),
    releaseOrder: 2,
    relatedIds: ["sculpture-tee", "pit-lane-tee"],
  },
  {
    ...heavyweight,
    id: "serpent-tee",
    slug: "serpent-tee",
    name: "Serpent Graphic T-Shirt - Washed Black",
    subtitle: "Oversized heavyweight tee",
    description: "Intricate serpent and botanical linework on faded black cotton. A darker point of view, in an oversized silhouette.",
    details: "Oversized tee with fine ivory serpent and gothic botanical linework running down the chest.",
    price: 3000,
    compareAtPrice: 3299,
    collectionId: "col-dark-art",
    print: "Fine-line ivory print",
    images: [
      { id: "serpent-02", src: "/images/collections/dark-art/campaign-01.webp", alt: "Serpent Tee worn by model", type: "model", order: 1 },
      { id: "serpent-01", src: "/images/products/serpent-01.jpg", alt: "Serpent Tee flat lay", type: "front", order: 2 },
      { id: "serpent-03", src: "/images/collections/dark-art/campaign-02.webp", alt: "Serpent Tee lifestyle", type: "lifestyle", order: 3 },
    ],
    variants: variants("SRP", "Washed black", "#2b2a28", 3000, { M: 0, L: 0, XL: 0 }),
    releaseOrder: 1,
    relatedIds: ["sculpture-tee", "impact-tee"],
  },
];
