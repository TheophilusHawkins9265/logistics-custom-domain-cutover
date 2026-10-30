import test from "node:test";
import assert from "node:assert/strict";
import { decideCutover, onboardingInput } from "./custom-domain-cutover.ts";

const base = { domain: "tracking.example.com", webhook_url: "https://example.com/hook", webhook_secret: "eight-character-secret", shipment_event: { shipment_id: "shp_1", kind: "in_transit", occurred_at: "2026-01-01T00:00:00.000Z" }, proof_of_delivery: { name: "pod.pdf", media_type: "application/pdf", checksum: "sha256:x" }, exception: { code: "none", message: "none", retryable: false } } as const;

test("a retryable shipment exception holds the DNS cutover", () => {
  const input = onboardingInput.parse({ ...base, shipment_event: { ...base.shipment_event, kind: "exception" }, exception: { code: "address_check", message: "carrier needs a new address", retryable: true } });
  assert.equal(decideCutover(input), "hold");
  assert.equal(decideCutover(onboardingInput.parse(base)), "ready");
});
