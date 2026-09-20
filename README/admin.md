# Store admin

The store runs from `/admin`. Products, collections, images, variants, stock, orders and homepage copy
are all managed there, so none of them need code changes.

## First admin account

No accounts or passwords are built in. Create the first administrator from a terminal on the server:

```bash
npm run admin:create -- --email you@yourstore.com --name "Your Name"              # prompts for a password (hidden)
ADMIN_PASSWORD='…' npm run admin:create -- --email you@yourstore.com --name "…"    # non-interactive (CI / provisioning)
npm run admin:create -- --email staff@yourstore.com --name "…" --role STAFF         # a staff account
npm run admin:create -- --email you@yourstore.com --reset                           # change a password; signs out that account's sessions
```

Passwords must be at least 12 characters. They are stored as scrypt hashes.

## Roles

| Role | Can do |
| --- | --- |
| ADMIN | Everything |
| STAFF | View the catalog, adjust stock, fulfil orders. No catalog edits, content or settings. |

All permissions are defined in `lib/admin/authorization.ts` (`ROLE_PERMISSIONS`). To add a role, add it to
the `AdminRole` enum and that map.

## How access is enforced

- **Proxy:** `proxy.ts` redirects visitors without an admin cookie to `/admin/login`. This is a convenience,
  not the security boundary.
- **Session check:** every admin page and every server action checks the session against the database
  (`requireAdminPage` / `requireAdminAction`) and then checks the role. Hiding a link never grants or
  removes access.
- **Sessions:** server-side, stored in `admin_sessions` and valid for 12 hours. The cookie holds only a
  random token, and only its SHA-256 hash is stored.
- **Sign-in throttling:** 5 failed attempts per email, or 20 per IP, locks sign-in for 15 minutes.
  Successful sign-ins don't count.
- **Mutations:** server actions carry Next.js's built-in origin check. The upload route checks
  `Origin`/`Sec-Fetch-Site` itself.

## Everyday tasks

- **Products** (`/admin/products`): search, filter, sort, then open a product to edit.
  - The same form handles new and existing products. The slug fills in from the name until you edit it.
  - Products that appear in past orders can only be disabled, never deleted.
- **Images:** drag to reorder, or use the ↑/↓ buttons (keyboard friendly). The first image is the
  listing image. Each image has alt text, a type (front, back, detail…) and an optional colour.
- **Variants:** tick colour × size cells. Each variant has a SKU (**Generate** suggests one like
  `IMP-BLK-L`), an optional price override, a compare-at price and stock.
  - Unticking an existing variant disables it and keeps its history.
  - New colours are created from the matrix. Sizes are shared across all products.
- **Stock** (`/admin/inventory`): every change is a recorded adjustment (+/− with a reason), never an
  overwrite.
  - *Reserved* units belong to checkouts that are waiting on payment. Stock can't go below that number.
- **Collections:** drag to reorder. The order controls the homepage explorer and the shop filters.
  - Up to **5** collections can be featured on the homepage.
  - Reel images are the film-roll frames. Two or more make the roll animate.
- **Orders:** the allowed status changes are Paid → Processing → Shipped (optional carrier and tracking)
  → Delivered.
  - Unpaid and paid orders can be cancelled. Cancelling a paid order puts the stock back but **does not
    refund**; issue refunds in the Razorpay dashboard. There is deliberately no refund button yet.
  - The allowed changes are listed in `lib/domain/orderStatus.ts`.
- **Content:** hero lines, brand story, newsletter copy and the three lookbook lanes. Only the words and
  images can change, not the layout. Saved changes show on the homepage on its next visit.
- **Settings:** store name (header, footer, page titles, payment window), default currency for new
  products, support email, and the low-stock threshold. Secrets are never shown here.
  - The activity log lists recent admin changes (`admin_audit_logs`).

## Media storage

Uploads go through `lib/storage` and are checked by their file contents, not their extension:
- images: JPEG, PNG, WebP or AVIF, up to 10 MB
- 3D models: GLB, up to 30 MB

| `STORAGE_DRIVER` | Where files live |
| --- | --- |
| `local` (default) | `STORAGE_LOCAL_DIR` (default `.data/uploads`, git-ignored), served from `/media/…`. Fine for one server with a persistent disk. **Not suitable for serverless hosting.** |
| `s3` | Any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO). Set `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and `S3_PUBLIC_URL`. The public host is allowed in `next.config.ts` automatically. |

The database stores only URLs. Removing an image deletes the stored file once nothing else refers to it.
Bundled seed assets under `/public` are never deleted.

## Data notes

- Commerce data (products, variants, stock, orders) lives in normal database tables. Homepage copy
  is JSON in `site_content`, checked against a schema in `lib/content/schemas.ts`.
  - Missing or invalid values fall back to the launch copy in `config/`.
- Settings now use typed namespaces in `system_settings`; provider secrets are encrypted. See [Settings](settings.md) for configuration, permissions, integration capabilities, backups and QA.
- `npm run db:seed` only creates records that don't exist yet. It never overwrites admin edits or resets
  stock.
- `npm run test:admin` runs the admin checks against the database and restores anything it changes.
