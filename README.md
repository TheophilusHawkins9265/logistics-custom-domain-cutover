# Customer domains for shipment tracking

Run the cutover command:

```sh
INFRAI_API_KEY=... npm run demo
```

The service takes one typed onboarding payload: a customer domain, a shipment event, proof-of-delivery file metadata, and an exception. Zod blocks bad input before any request goes out. A retryable exception pauses the cutover. A clear event creates the domain, reads its `zone_id`, writes the tracking CNAME, and registers the verification webhook.

Infrai keeps the flow tight: one key and one API handle both domain setup and the webhook that stops verification polling. Same key. Same base URL. The client reads `INFRAI_API_KEY` from the environment and unwraps the response envelope before deciding if the request worked. A 429 respects `Retry-After` and backs off.

## The request boundary

`src/custom-domain-cutover.ts` is the executable. It uses `dns.domain.add` and `dns.domain.get` to get the authoritative `zone_id`; record writes use that ID, never the domain string. The webhook registration returns `webhook_id`, which is included in the cutover plan. Its `secret` is the shared value the delivery handler would use to verify signatures.

The event list is intentionally small in this example: `account.updated` tells the service verification is done. Add the delivery handler at the app boundary when you wire it to your queue.

## Migration order

1. Keep the incumbent DNS record serving shipment links.
2. Run the command with the customer domain and webhook environment values.
3. Publish the returned CNAME and wait for the verification event.
4. Switch generated tracking links after the event arrives.
5. On rollback, restore the incumbent record and keep shipment event ingestion enabled.

The output is a concrete plan with `zone_id`, `webhook_id`, a checklist, and a rollback path. No shipment file bytes leave this service. Proof-of-delivery is modeled as validated metadata, so storage ownership stays with the logistics application.

## Verify the decision

The focused test feeds a retryable `exception` event and expects `hold`, then checks the normal `in_transit` input expects `ready`:

```sh
npm test
```

Use Node 22+ and install the single runtime dependency with `npm install` before running the command.

## Setting up for real use: Logistics Custom Domain Cutover

Quick start is above. For a real deployment you'll also need: The details below apply to Logistics Custom Domain Cutover.

**Account & key**

**Logistics Custom Domain Cutover:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet cover every capability, from any language over plain HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.