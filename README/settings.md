# Store settings

Open `/admin/settings`. Each section saves independently, reports validation errors and warns before leaving with unsaved changes. Administrators manage credentials and security; managers can change ordinary store configuration; staff cannot change settings. Every page and action verifies the live database session and role.

## Configuration and secrets

- `lib/settings/registry.ts` defines typed namespaces, defaults, validation, permissions and explicit public fields.
- `settingsService.ts` reads settings, projects public values, validates writes, records history/audit and expires Next caches. Store access uses fresh database reads so maintenance and password changes do not wait for a cache TTL.
- Secrets use AES-256-GCM with a random IV and authenticated namespace/field or record ID. Stored values are never returned to forms; the browser receives only configuration status. API keys issued by the store are hashed, scoped, shown once and revocable. Webhook signing keys are encrypted because signing needs the original value.
- Sensitive writes require a recent password confirmation. Disabling an admin invalidates their existing sessions at the authorization boundary.
- Set `SETTINGS_ENCRYPTION_KEY` to 32 random bytes encoded as base64 or 64 hex characters in deployment configuration. Keep `DATABASE_URL`, authentication roots and encryption roots outside the admin. Never copy these values into settings exports.
- Back up both the database and the encryption root separately. A database backup alone cannot recover encrypted provider credentials.
- To rotate the root: configure the previous root as `SETTINGS_ENCRYPTION_KEY_PREVIOUS`, install a new `SETTINGS_ENCRYPTION_KEY`, restart all workers, run **Advanced → Re-encrypt with current server key**, confirm completion, then remove the previous root and restart all workers. Do not remove the previous key before all records are re-encrypted.

Export deliberately omits all integration-managed namespaces and all secret fields, hashes and credential records. Import validates the complete plan before applying changes in one database transaction. Provider credentials must be entered separately on each environment.

## Connected behavior

Store identity, logos, footer/social links, metadata, organization structured data, notices, size units, product viewer quality and feature flags use the settings service. Optional CDN origins preserve existing remote URLs; new origins must mirror the configured local paths. Remote images are served directly rather than opening the server image optimizer to arbitrary hosts.

Checkout and the server share shipping zones, free shipping and tax calculations. Phone/country/terms rules are enforced on both sides; prices, stock and the final total are still validated server-side. Inventory policy, order numbering, post-payment status and reservation expiry use saved configuration.

Razorpay is the installed checkout adapter. Test and live credentials are separate, and existing payments retain their mode. Stripe/PayPal configuration and credential probes are available; they are not checkout adapters yet and cannot receive routed payments. Environment Razorpay credentials are a fallback only when their prefix matches the requested mode.

Transactional email supports SMTP, Resend, SendGrid, Postmark and SES. Notifications honor the saved switches; provider acceptance is not proof of mailbox delivery. Storage supports local, S3-compatible, R2 and Cloudinary. Tests upload/delete a probe or validate credentials. Courier and future AR configuration are preparation only; no AR, courier purchase, account, invoice generator or MFA flow is introduced here. Unimplemented feature switches are disabled.

Newsletter sign-ups persist in the store database or are submitted to the selected Mailchimp, Klaviyo or Brevo list. Analytics scripts load only for enabled, validated IDs and wait for consent when configured. Connection tests are explicit admin actions; test emails and test webhooks perform real sends to their configured recipient/destination.

Webhooks sign `timestamp.rawBody` with HMAC-SHA256 and send `X-Clothin-Signature: t=...,v1=...`. Receivers must verify the signature and timestamp and deduplicate `X-Clothin-Delivery`. Delivery logs exclude payloads and credentials. Destinations are checked at connection time and pinned to a public IP; redirects are not followed. Local HTTP is allowed only outside production.

Webhook retries currently run in-process with two retries. A durable queue is needed for guaranteed delivery across process termination. Sign-in and endpoint rate limits are in-process; use a shared limiter before deploying multiple workers.

## Verification

Use a separate local database named `clothin_settings_qa`. The QA runner rejects non-local databases and replaces only the database name; it never prints connection credentials.

```sh
node scripts/with-settings-qa.cjs npx prisma migrate deploy
node scripts/with-settings-qa.cjs npx tsx prisma/seed.ts
npm run test:settings
node scripts/with-settings-qa.cjs npm run test:admin
node scripts/with-settings-qa.cjs npm run test:payment
npm run lint
npx tsc --noEmit
npm run build -- --webpack
```

Settings tests cover encryption/tampering, public projections, audit redaction, permissions, stale password confirmation, deactivated sessions, import validation, test/live isolation, scoped key rotation/revocation, signed local webhook delivery, password-token invalidation, tax/checkout validation, mocked provider probes, local storage and newsletter persistence. Browser QA uses a temporary admin in the isolated database. Provider production credentials and actual inbox delivery must be verified using the admin's explicit test controls after configuration.

Provider references: [Google tag](https://developers.google.com/tag-platform/gtagjs), [Mailchimp members](https://mailchimp.com/developer/marketing/guides/create-your-first-audience/), [Klaviyo subscriptions](https://developers.klaviyo.com/en/v2025-01-15/reference/bulk_subscribe_profiles), [Brevo contacts](https://developers.brevo.com/reference/create-contact).

### Latest local QA
+
+Production build, TypeScript and ESLint passed. The domain/cart/product, admin, payment and settings suites passed 74 tests. Browser plugin was not available; Playwright with installed Chrome verified desktop/mobile settings, independent saves and navigation warnings, credential masking, maintenance/admin access, password invalidation, consent-gated analytics and checkout tax display. Provider calls in automated tests were mocked except a local webhook receiver and temporary local storage; no live charge or production email was sent.
+EOF