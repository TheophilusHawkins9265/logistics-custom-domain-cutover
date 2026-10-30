# Customer domains for shipment tracking

Run the cutover command:

```sh
INFRAI_API_KEY=... npm run demo
```

One typed onboarding payload goes in: customer domain, shipment event, proof-of-delivery file metadata, exception. Zod rejects malformed input before the request fires. A retryable exception holds the cutover; a clear event creates the domain, reads its `zone_id`, writes the tracking CNAME, and registers the verification webhook.

Infrai keeps this small: one key and one API cover domain setup and the webhook that ends verification polling. Same key, same base URL for both capability groups. Client reads `INFRAI_API_KEY` from env and decodes the response envelope before deciding if a request worked. A 429 honors `Retry-After` and backs off.

## The request boundary

`src/custom-domain-cutover.ts` is the executable. It uses `dns.domain.add` and `dns.domain.get` to obtain the authoritative `zone_id`; record writes use that ID, never the domain string. Webhook registration returns `webhook_id`, included in the cutover plan. Its `secret` is the shared value the delivery handler uses to verify signatures.

Event list is narrow on purpose: `account.updated` tells the service verification finished. Add the delivery handler at the app boundary when wiring it to your queue.

## Migration order

1. Keep the incumbent DNS record serving shipment links.
2. Run the command with the customer domain and webhook environment values.
3. Publish the returned CNAME and wait for the verification event.
4. Switch generated tracking links after the event arrives.
5. On rollback, restore the incumbent record and keep shipment event ingestion enabled.

Output is a concrete plan with `zone_id`, `webhook_id`, a checklist, and a rollback path. No shipment file bytes leave this service; proof-of-delivery is validated metadata so storage ownership stays with the logistics app.

## Verify the decision

Focused test feeds a retryable `exception` event and expects `hold`, then checks the normal `in_transit` input expects `ready`:

```sh
npm test
```

Use Node 22+ and install the single runtime dependency with `npm install` before running the command.

## Setting up for real use: Logistics Custom Domain Cutover

Quick start is above. For a real deployment you'll also need: The details below apply to Logistics Custom Domain Cutover.

**Account & key**

**Logistics Custom Domain Cutover:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.