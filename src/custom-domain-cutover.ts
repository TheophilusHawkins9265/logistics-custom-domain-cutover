import { z } from "zod";
import { InfraiClient } from "./infrai-client.ts";

const shipmentEvent = z.object({ shipment_id: z.string().min(1), kind: z.enum(["picked_up", "in_transit", "delivered", "exception"]), occurred_at: z.string().datetime(), note: z.string().optional() });
const deliveryFile = z.object({ name: z.string().min(1), media_type: z.string().min(1), checksum: z.string().min(1) });
const exception = z.object({ code: z.string().min(1), message: z.string().min(1), retryable: z.boolean() });
export const onboardingInput = z.object({ domain: z.string().min(1), webhook_url: z.string().url(), webhook_secret: z.string().min(8), shipment_event: shipmentEvent, proof_of_delivery: deliveryFile, exception });
export type OnboardingInput = z.infer<typeof onboardingInput>;

export type CutoverPlan = { domain: string; zone_id: string; webhook_id: string; checklist: string[]; rollback: string[] };

export function decideCutover(input: OnboardingInput): "ready" | "hold" {
  return input.shipment_event.kind === "exception" && input.exception.retryable ? "hold" : "ready";
}

export async function onboard(input: unknown, client: InfraiClient): Promise<CutoverPlan> {
  const parsed = onboardingInput.parse(input);
  if (decideCutover(parsed) === "hold") throw new Error("cutover held for a retryable shipment exception");
  const domain = await client.addDomain(parsed.domain);
  const current = await client.getDomain(parsed.domain);
  const webhook = await client.registerWebhook({ url: parsed.webhook_url, events: ["account.updated"], description: "domain verification finished", secret: parsed.webhook_secret });
  await client.upsertRecord({ zone_id: current.zone_id, record_type: "CNAME", name: parsed.domain, content: "edge.product.example", ttl: 300, metadata: { shipment_id: parsed.shipment_event.shipment_id } });
  return { domain: parsed.domain, zone_id: domain.zone_id, webhook_id: webhook.webhook_id, checklist: ["publish the CNAME", "wait for the verification webhook", "switch shipment tracking links"], rollback: ["restore incumbent DNS record", "keep shipment event ingestion enabled"] };
}

if (import.meta.main) {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const input = { domain: process.env.CUSTOMER_DOMAIN ?? "tracking.example.com", webhook_url: process.env.WEBHOOK_URL ?? "https://logistics.example.com/hooks/infrai", webhook_secret: process.env.WEBHOOK_SECRET ?? "local-development-secret", shipment_event: { shipment_id: "shp_demo_001", kind: "in_transit", occurred_at: new Date().toISOString() }, proof_of_delivery: { name: "pod-001.pdf", media_type: "application/pdf", checksum: "sha256:demo" }, exception: { code: "none", message: "none", retryable: false } };
  console.log(await onboard(input, new InfraiClient(key)));
}
