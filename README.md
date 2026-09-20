# BRAND — cinematic landing page

Next.js (App Router) · React Three Fiber · GSAP ScrollTrigger · Lenis · Tailwind CSS

```bash
npm install
npm run dev          # http://localhost:3000
npm run build
npm run lint
npm run test:garment # deterministic cloth behavior tests
npm run test:product # catalog, variant, stock and price formatting tests
npm run test:cart    # bag merging, stock limits, persistence validation, totals
```

## Where things live

| Change | File |
| --- | --- |
| Copy, navigation, colours, intro timings, scroll length, shirt layout | `config/site.ts` |
| Existing intro master timeline | `components/home/Hero.tsx` |
| Pinned white → black scroll story | `components/home/ScrollTransition.tsx` |
| Canvas, frame scheduling, adaptive quality | `components/three/TShirtScene.tsx` |
| GLB loading and fallback | `components/three/TShirtModel.tsx` |
| Invisible suspension target, studio lighting and optional cotton maps | `components/three/tshirt/` |
| Fixed-step XPBD, anchors, stretch/shear, signed bending, tethers, air, collision and render binding | `components/three/tshirt/physics/` |
| Simulation lifecycle, pointer input and deformation transfer | `hooks/useGarmentPhysics.ts` |
| Cotton preset, physical scale and high/medium/low quality settings | `config/garmentPhysics.ts` |
| Procedural shirt, collar, cuff/hem rims and prints | `components/three/fallback/` |
| Scroll chapter lengths, explorer timings, roll and gesture tuning | `config/site.ts` (`scrollConfig`, `explorerConfig`) |
| Collection records (names, copy, order, visibility, images) | `data/collections.ts`, typed by `types/collection.ts` |
| Collection Explorer scene | `components/home/collections/` |
| Image roll state, single auto scheduler, pointer gesture | `hooks/useCollectionFilmRoll.ts`, `hooks/useCollectionRollScheduler.ts`, `hooks/usePointerRollGesture.ts` |
| Product catalog (seed), types and catalog/variant helpers | `data/products.ts`, `types/product.ts`, `lib/products.ts` |
| Product page route, metadata and not-found | `app/product/[slug]/` |
| Product page components and purchase logic | `components/product/` |
| Product page copy, stock threshold, shipping lines | `config/product.ts` |
| Size charts (cm, inches derived) | `config/sizeGuide.ts` |
| Bag store (variant lines, localStorage) | `hooks/useBag.ts` |
| Pure cart logic: validation, limits, count, subtotal | `lib/cart.ts` |
| Bag drawer, /cart page and cart rows | `components/cart/`, `app/cart/page.tsx` |
| Cart copy and checkout switch | `config/cart.ts` |
| Shared drawer (modal dialog, GSAP enter/exit) | `components/ui/Drawer.tsx` |
| Price formatting (INR / CAD / USD) | `lib/money.ts` |

## Physical motion

GSAP retains the Phase 1 curve and scroll story. It writes an invisible reference frame.
Only the collar and shoulder seams follow that frame; sleeves, torso and hem are free
cloth. Visible meshes receive their positions from the simulation every frame.

- **Suspension.** Only the shoulder/collar patches support the fabric. There is no
  invisible body inside it. The resting geometry has a narrow air gap and flattened
  sleeve openings, so it reads as an unworn garment.
- **Cotton behaviour.** Stretch is stiff and strain-limited; compression is nearly free,
  so fabric buckles into wrinkles. Signed dihedral bending is soft enough to crease.
- **Mouse.** Wherever the cursor's camera ray meets the fabric, a soft hand
  (`ClothPointer`) presses a dent and drags nearby fabric along with the stroke. When the
  cursor leaves, the cloth recovers on its own. Mouse and pen only; reduced motion
  disables it. Tune `pointer*` values in `config/garmentPhysics.ts`.
- **Solver.** Fixed 1/60 s ticks with 4–6 substeps and four iterations each. Complete ticks
  are interpolated for smooth presentation between physics updates. Sweep
  order alternates only between iterations; alternating it between substeps injects
  jitter. Air load is evaluated once per tick. Quality tiers change proxy density,
  substeps, DPR and shadows, and sustained slow frames lower the tier.
- **Lifecycle.** Rendering and simulation pause for a hidden tab, an offscreen canvas or
  the Collection Explorer. Resuming re-drapes briefly while the shirt is still invisible.

The fallback has two softly hanging panels, open hem/cuffs, a ribbed collar and prints.
Its sewn low-resolution physics mesh is generated directly, avoiding voxel collapse
of the thin sleeve panels. Nearby-particle collision remains an approximation rather
than continuous triangle self-collision.

## Collection Explorer

The scene after TURN AROUND lives inside the same pinned stage, so the black never
breaks. One pin (`ScrollTransition`) spans three chapters: the white → black story, a
handoff where the shirt sinks, dims and fades, and the explorer. Once the shirt is
invisible the canvas stops simulating and rendering; scrolling back resets the cloth
while still hidden and resumes.

- **Data first.** The UI is derived from `data/collections.ts`: enabled collections in
  `order`, each image in its own `order`. Counts such as `01 / 05` come from the data.
  "Explore collection" links to `/collection/[slug]`, which is not built yet.
- **Film roll.** Each frame sits on a strip with the next image parked directly below.
  A roll moves the strip exactly one frame up, so there is no gap or crossfade.
- **Scheduler.** One timer rolls one segment at a time. The centre collection always
  rolls first, then the choice is randomised without immediate repeats. It pauses
  offscreen, in hidden tabs, with reduced motion, and for 3–5 s after interaction.
- **Interaction.** Desktop: hover activates, click or a deliberate ~100 px vertical
  stroke rolls. Mobile (< 768 px): snap rail, tap activates then rolls, only the visible
  collection auto-rolls. Keyboard: Enter/Space activates; the `01/04` counter rolls.
- **Images.** Put photography at `public/images/collections/<slug>/<nn>.webp` (portrait
  crops work best; frames use `object-fit: cover`). Missing local files are dropped on
  the server; a collection without images and failed loads show a quiet placeholder.
  The current frames are generated placeholders:
  `node scripts/generate-collection-placeholders.mjs` (add `--force` to overwrite).

## Product detail page

`/product/[slug]` renders any catalog product; nothing is product-specific. Unknown
slugs call `notFound()` (real 404, branded page). Metadata (title, description,
canonical, Open Graph image) comes from the product. Set `NEXT_PUBLIC_SITE_URL` in
production so Open Graph URLs are absolute.

- **Data.** `Product` has typed images (`front` / `back` / `detail` / `model` /
  `lifestyle`, with optional focal point and crop zoom) and variants (colour × size,
  price, compare-at price, stock, enabled). All UI reads through `lib/products.ts`,
  whose async catalog functions are the seam for a future API or admin.
- **Imagery.** Seed products use their two campaign photographs plus a print close-up
  cropped from the first. A colour's tagged images replace the shared set. Missing
  local files are dropped on the server; failed loads show a quiet frame.
- **Purchase.** Colour and size are native radio groups. Sold-out or missing sizes
  are disabled. Without a size the CTA looks inactive but a click points to the
  sizes. Stock shows only "In stock" / "Low stock" (≤ 3, no counts) / "Sold out".
  Adding confirms in place ("Added ✓", link to the bag); no redirect or modal.
- **Bag.** `addItem`, `updateQuantity`, `removeItem` and `openBag` in `hooks/useBag.ts`.
  Lines are per variant and capped by stock. Older size-based lines migrate on read.
- **3D view.** Set `model3d: { glb: "/models/<file>.glb" }` on a product. The page
  reuses the homepage garment system (rig, lighting, loader, cloth physics) in a
  centred studio layout: drag or arrow keys rotate, the cursor pushes the cloth.
  If the file is missing it is skipped; if it fails to load the view hides itself
  rather than showing the homepage stand-in.
- **Phones.** Gallery becomes a native scroll-snap strip with an indicator; a compact
  add-to-bag bar appears once the main button scrolls away.

## Bag / cart

`BAG (N)` in the header shows total units and opens the bag drawer; `/cart` shows the
same contents as a page. Both render `CartContents`, `CartItem`, `CartQuantity`,
`CartSummary` and `EmptyCart`, so there is one set of cart markup.

- **One store.** `hooks/useBag.ts`: `addItem(productId, variantId, qty)`,
  `updateQuantity(itemId, qty)`, `removeItem(itemId)`, `clearCart()`, `openBag()`,
  plus `useCart()` for resolved lines, count and subtotal. An item id is its variant
  id, so the same variant always merges into one row. Only `{ productId, variantId,
  quantity }` is stored; product data is joined from the catalog.
- **Rules** (`lib/cart.ts`): quantity stays within 1…min(stock, 10); sold-out or
  unknown variants are dropped on read; invalid or duplicate stored data is repaired;
  subtotal is variant price × quantity. `validateCart()` is ready for checkout.
- **Drawer.** Shared `Drawer`: native modal dialog (aria-modal, inert page, ESC, Tab
  kept inside, focus returns to the opener), GSAP slide (x 100% → 0, power3.out) and
  overlay fade, overlay click closes, page and Lenis scroll locked while open.
  Portalled to `<body>`.
- **Checkout.** `/checkout` is not built. `cartConfig.checkoutEnabled` is `false`, so
  the Checkout button explains that it opens soon. Set it to `true` once the route
  exists; the button then links to `cartConfig.checkoutHref`.
- No discounts, taxes, shipping amounts or promo codes are shown until real logic exists.

## Adding the real T-shirt

1. Export the shirt facing **+Z**, upright **+Y**, at any scale, in its intended rest pose.
2. Save it as `public/models/tshirt.glb`. Geometry, material groups, UVs, maps, collar,
   seams and hem detail are preserved. Skinned rest poses are baked before binding.
3. Optionally provide `public/models/tshirt-physics.glb`: a clean, sewn, indexed proxy
   in **the same source coordinates** as the render GLB. Keep front/back panels separate
   and weld sewing seams. Aim for a few hundred particles, with detail near cuffs,
   armpits and collar. Meshes named `physics`, `collision` or `proxy` inside the main
   GLB can also supply the proxy and are hidden from rendering.
4. Without a supplied proxy, spatial clustering derives a bounded proxy from the actual
   garment. An authored proxy gives better seam topology than automatic clustering.
5. Optional UV-aligned maps belong at `public/textures/tshirt/basecolor.webp`,
   `normal.webp`, `roughness.webp`, and `ao.webp`. Missing maps retain the existing
   imported/procedural cotton material. Failed optional loads do not suspend the shirt.
6. Restart dev or rebuild after adding assets; asset discovery happens on the server.

A missing or invalid main GLB uses the existing procedural fallback. A missing/invalid
proxy derives one from the render geometry. Animation clips are not played over XPBD.
There is no main GLB in this checkout, so real-model asset validation remains necessary
when it is supplied. The fallback has a volumetric body, collar and open cuff/hem rims,
but is not a substitute for a production garment scan or authored pattern mesh.

## Verification

`npm run test:garment` covers fixed-timestep equivalence at 30/60/120 Hz, large delta
clamping, signed fold recovery, regional lag and settling, rapid reversals across all
quality tiers, render-detail transfer under rotation, the cursor dent and recovery, drag
along a stroke, resting jitter, unworn panel depth, and compression softness. Browser QA is still necessary
for a new garment or preset. In development, the canvas exposes batched `data-cloth-*`
counters for tier, proxy size, simulation time, recovery resets and average cloth CPU
work. These are diagnostic values, not a promise of display FPS.

### Lookbook + Brand Story

The next homepage chapter is a normal-flow sibling after the existing pinned hero/Collection Explorer. `components/home/lookbook/` separates the section animation, three lanes, individual Next/Image frames, and the story panel. Desktop uses a CSS-sticky composition over 190vh with three transform-only ScrollTrigger tracks. Tablet uses a static three-lane spread; mobile uses a keyboard-focusable horizontal image strip and stacked copy. Reduced motion removes the parallax, sticky hold, and reveal animation. GSAP contexts and matchMedia revert their triggers on updates/unmount; the existing Lenis provider is reused.

Edit `config/brandStory.ts` for all story copy. The CTA currently expands the short story in place; set `cta.href` to an implemented route later to render a link. No About route is created. Replace `data/lookbook.ts` records and `/public/images/lookbook/` files for the real campaign. These are **temporary stock photographs**, not actual BRAND garments or campaign models. Source links and photographer credits are retained in every image record. Local seed files total approximately 380 KB; Next/Image supplies responsive optimized variants and lazy loading.

### Shop

`/shop` continues the existing catalog in `data/products.ts` with an off-white editorial grid,
collection tabs, size/color/price/stock filters, sorting, and incremental loading. The third
featured result spans the desktop grid. Product previews use the shared native-dialog drawer;
the global bag supports size selection, quantity changes, removal, and local device persistence.
Components live in `components/shop/`, styles are scoped in `shop.module.css`, and display,
currency, pagination, and quantity settings live in `config/shop.ts`.

The catalog prices and availability are illustrative; campaign images are generated concepts.
The catalog, bag, checkout, Razorpay payments, orders and inventory now use the backend. See [Admin](README/admin.md) and [Settings](README/settings.md) for configuration and verification.
