import type { LookbookImage } from "@/types/lookbook";

/** Local stock photography, not a photographed BRAND campaign. Replace these
 * seed records with commissioned imagery when available; credits travel with it. */
export const lookbookImages: LookbookImage[] = [
  { id: "silhouette", src: "/images/lookbook/28758240.jpg", alt: "Full-length studio portrait in an oversized charcoal tee, shorts and cap", lane: 1, order: 1, credit: { photographer: "INFECTED Store", url: "https://www.pexels.com/photo/casual-fashion-model-in-oversized-t-shirt-28758240/" } },
  { id: "portrait", src: "/images/lookbook/26967988.jpg", alt: "Close studio portrait of a man wearing a black crew-neck T-shirt", lane: 1, order: 2, credit: { photographer: "Bruno Casttro", url: "https://www.pexels.com/photo/model-in-black-t-shirt-26967988/" } },
  { id: "street", src: "/images/lookbook/13462505.jpg", alt: "Woman wearing an oversized black graphic tee on a city street", lane: 2, order: 1, credit: { photographer: "Pexels contributor", url: "https://www.pexels.com/photo/woman-wearing-an-oversized-black-shirt-13462505/" } },
  { id: "drape", src: "/images/lookbook/29276076.jpg", alt: "Model in sunglasses looking down at the drape of a loose black T-shirt", lane: 2, order: 2, credit: { photographer: "INFECTED Store", url: "https://www.pexels.com/photo/man-in-black-t-shirt-with-sunglasses-inspection-29276076/" } },
  { id: "attitude", src: "/images/lookbook/16400892.jpg", alt: "Outdoor portrait of a model with dyed hair wearing a black T-shirt", lane: 3, order: 1, credit: { photographer: "Teddy Yang", url: "https://www.pexels.com/photo/man-posing-in-black-t-shirt-16400892/" } },
  { id: "graphic", src: "/images/lookbook/16109695.jpg", alt: "Model with hands in pockets wearing a black graphic tee in a dark studio", lane: 3, order: 2, credit: { photographer: "Karen Irala", url: "https://www.pexels.com/photo/model-in-tshirt-16109695/" } },
];
