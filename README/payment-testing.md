# Payment testing (Razorpay test mode)

Checkout takes real payments through a provider-neutral layer (`lib/payments/`).
Razorpay is the first provider. Use **test mode** keys during development. Never use live keys.

## 1. Environment

Copy `.env.example` to `.env.local` and fill in:

| Variable | Where it comes from | Exposure |
| --- | --- | --- |
| `RAZORPAY_KEY_ID` | Dashboard → Account & Settings → API Keys (test mode, starts `rzp_test_`) | Server env. Returned to the browser only inside the payment session response, because Checkout.js needs it. |
| `RAZORPAY_KEY_SECRET` | Same screen, shown once | Server only. Never prefix with `NEXT_PUBLIC_`. |
| `RAZORPAY_WEBHOOK_SECRET` | A random string that you also enter when creating the webhook | Server only. |

Also required: `DATABASE_URL`, pointing at the Postgres database.

After changing env values or the Prisma schema, **restart `next dev`**. The running server keeps the old
Prisma client and env in memory.

```bash
docker start clothin-postgres          # local Postgres
npx prisma migrate deploy              # applies 20260918200000_payments
npx prisma generate
npm run dev
```

## 2. Pay in the browser

1. Add products to the bag, then go to `/checkout`.
2. Fill in the address and choose delivery, then press **Continue to payment**.
   The server re-prices the cart, reserves stock and creates a Razorpay order for the server-calculated total.
3. In the Razorpay window, which shows a "Test Mode" ribbon, choose one of:
   - **Netbanking** → any bank → a mock bank page opens → **Success** or **Failure**.
   - **Card**: a Razorpay test card from https://razorpay.com/docs/payments/payments/test-card-details/,
     with any future expiry, any CVV and any OTP.
   - **UPI**: `success@razorpay` or `failure@razorpay`.
4. On success the browser posts the signed callback to `/api/checkout/payment/verify`. The server:
   - checks the HMAC signature;
   - fetches the payment from Razorpay;
   - checks the amount and currency against the stored order;
   - captures the payment if it is only authorized;
   - finalizes the order and redirects to `/order/confirmation/<publicToken>`.
5. On failure, close the window. The order becomes `PAYMENT_FAILED`, the stock is released, and the bag
   stays as it was. **Try payment again** reuses the same order with a fresh Razorpay order.

## 3. Webhooks

Webhooks are the backstop for tabs that close after the customer pays.

- **URL:** `https://<public-host>/api/webhooks/payment`.
  Razorpay can't reach `localhost`, so use a tunnel such as `ngrok http 3000` or `cloudflared`.
- **Secret:** the same value as `RAZORPAY_WEBHOOK_SECRET`.
- **Events:** `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`.

To try it locally without a tunnel, send a signed request yourself. The secret is read from your env; don't
paste it anywhere.

```bash
set -a; . ./.env.local; set +a
BODY='{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_X","order_id":"order_X","amount":100,"currency":"INR","status":"captured"}}}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$RAZORPAY_WEBHOOK_SECRET" -hex | awk '{print $NF}')
curl -X POST localhost:3000/api/webhooks/payment -H "content-type: application/json" \
  -H "x-razorpay-signature: $SIG" -H "x-razorpay-event-id: evt_local_1" --data-binary "$BODY"
```

The webhook responds with:

| Status | Meaning |
| --- | --- |
| `200 {"ok":true,"duplicate":false}` | Processed. Unknown provider orders are acknowledged and ignored. |
| `200 {"duplicate":true}` | The same event id was delivered again. |
| `401` | Bad signature. |
| `503` | Webhook secret not configured. |
| `500` | Transient failure. Razorpay retries. |

## 4. Order and payment lifecycle

| Step | Order | Payment | Inventory |
| --- | --- | --- | --- |
| Continue to payment | `AWAITING_PAYMENT`, reservation `RESERVED` (30 min) | `CREATED` | `reserved += qty` |
| Attempt fails inside the window | unchanged | `FAILED` (with failure code and message) | still reserved, so the customer can retry |
| Window closed without paying | `PAYMENT_FAILED`, reservation `RELEASED` | `CANCELLED` or `FAILED` | `reserved -= qty` |
| Abandoned for over 30 min | `EXPIRED`, reservation `RELEASED` | `CANCELLED` | `reserved -= qty` |
| Verified success (callback or webhook) | `PAID`, `paidAt` set, reservation `COMMITTED` | `SUCCEEDED` | `quantity -= qty`, `reserved -= qty` |

On success, the checkout draft becomes `CONVERTED`. The cart becomes `CHECKED_OUT` and is detached from the
shopper's cookie, so their next visit starts with an empty bag. `finalizeSuccessfulPayment` is the only path
to `PAID`. It runs in one Serializable transaction and is idempotent, so callbacks, webhooks and retries
settle each order exactly once.

Abandoned reservations are released lazily before each new payment session. To release them on a schedule
as well, run this every few minutes:

```bash
npm run payments:expire
```

## 5. Automated tests

```bash
npm run test:payment
```

These run against the real database and the real Razorpay adapter. Every Razorpay HTTP call goes to an
in-memory mock, so no network or keys are needed. The tests create a temporary product and delete it
afterwards. They cover:
- server pricing and totals;
- session reuse;
- invalid and out-of-stock carts;
- signature validity;
- webhook and callback idempotency;
- amount and currency mismatches;
- duplicate success events;
- paid-order protection;
- one-time inventory and cart conversion;
- failure and cancellation;
- snapshot immutability;
- reservation expiry;
- rate limiting;
- origin checks.

## 6. Security notes

- The browser never sends an amount. Totals come from database prices and delivery methods, in paise.
- Payment mutations require a same-origin `Origin` header and a JSON body. The cart cookie is `SameSite=Lax`.
- Session creation is rate limited per cart session and per IP. The limiter is in-memory, so replace it
  with a shared store when you run multiple instances.
- Confirmation URLs use a 192-bit random `publicToken`. Order numbers and database ids unlock nothing.
- Webhook events store only the provider event id and type, never payloads, and are pruned after 30 days.
- Order confirmation email: `sendOrderConfirmation` is a stub until a provider is configured. It logs in
  development and never pretends to send.
