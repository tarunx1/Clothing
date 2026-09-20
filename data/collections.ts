import type { Collection, CollectionImage } from "@/types/collection";

/**
 * TEMPORARY seed data. A future admin panel replaces this module; the UI
 * derives everything (count, order, copy, imagery) from these records.
 * Photorealistic AI-generated campaign concepts, not photographs of actual
 * inventory. Generation prompts are kept beside the local campaign assets.
 */

const frames = (slug: string, name: string, captions: string[]): CollectionImage[] =>
  captions.map((caption, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      id: `${slug}-${n}`,
      src: `/images/collections/${slug}/campaign-${n}.webp`,
      alt: `${name} collection, frame ${n}: ${caption}`,
      order: i + 1,
    };
  });

export const collections: Collection[] = [
  {
    id: "col-greek",
    slug: "greek",
    name: "Greek",
    shortDescription: "Ancient forms reinterpreted through modern streetwear.",
    description:
      "Columns, meanders and myth, cut into heavyweight cotton. Classical order meets the street.",
    images: frames("greek", "Greek", ["model wearing a Greek sculpture graphic tee in a stone courtyard", "close editorial view of a Greek-inspired graphic tee"]),
    order: 1,
    enabled: true,
  },
  {
    id: "col-anime",
    slug: "anime",
    name: "Anime",
    shortDescription: "Speed lines, impact frames and hand-drawn momentum.",
    description:
      "Graphics lifted from the language of animation: focus lines, halftone and the frame before impact.",
    images: frames("anime", "Anime", ["model wearing an original manga graphic tee against concrete", "close editorial view of a manga print on heavyweight cotton"]),
    order: 2,
    enabled: true,
  },
  {
    id: "col-superhero",
    slug: "superhero",
    name: "Superhero",
    shortDescription: "Emblems of power, reduced to their boldest shapes.",
    description:
      "Shields, bolts and skylines. The iconography of heroes, stripped back to pure graphic force.",
    images: frames("superhero", "Superhero", ["model wearing a lightning shield graphic tee on a rooftop", "close editorial view of a silver shield graphic tee"]),
    order: 3,
    enabled: true,
  },
  {
    id: "col-motorsport",
    slug: "motorsport",
    name: "Motorsport",
    shortDescription: "Paddock graphics built for velocity.",
    description:
      "Chequered flags, race numbers and redlines. Motorsport heritage translated into everyday uniform.",
    images: frames("motorsport", "Motorsport", ["model wearing a number 27 racing tee in a garage", "close editorial view of a racing print tee with red accents"]),
    order: 4,
    enabled: true,
  },
  {
    id: "col-dark-art",
    slug: "dark-art",
    name: "Dark Art",
    shortDescription: "Occult geometry and ink, printed in black.",
    description:
      "Sigils, serpents and spilled ink. A darker graphic language for those who dress after midnight.",
    images: frames("dark-art", "Dark Art", ["model wearing a serpent and botanical graphic tee", "close editorial view of an ivory serpent print on faded cotton"]),
    order: 5,
    enabled: true,
  },
];
