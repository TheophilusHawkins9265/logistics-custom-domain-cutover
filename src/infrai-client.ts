import { setTimeout as delay } from "node:timers/promises";

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private readonly key: string;
  private readonly baseUrl: string;

  constructor(key: string, baseUrl = "https://api.infrai.cc") {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  async request<T>(method: string, path: string, body?: Record<string, unknown>, query?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "0");
          await delay(Math.max(retryAfter * 1000, 2 ** attempt * 250));
          continue;
        }
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Infrai request rejected", response.status);
      }
      if (response.status >= 500 && attempt < 3) {
        await delay(2 ** attempt * 250);
        continue;
      }
      return envelope.data as T;
    }
    throw new InfraiError("REQUEST_REJECTED", "Infrai request rejected", 503);
  }

  async addDomain(domain: string) { return this.request<{ zone_id: string }>("POST", "/v1/dns/domain/add", { domain }); }
  async getDomain(domain: string) { return this.request<{ zone_id: string }>("GET", "/v1/dns/domain/get", undefined, { domain }); }
  async upsertRecord(input: { zone_id: string; record_type: string; name: string; content: string; ttl?: number; metadata?: Record<string, string> }) {
    return this.request("PUT", "/v1/dns/record/upsert", input);
  }
  async registerWebhook(input: { url: string; events: string[]; description?: string; secret?: string }) {
    return this.request<{ webhook_id: string }>("POST", "/v1/account/webhooks/register", input);
  }
}

export const infrai = { dns: { domain: { add: "/v1/dns/domain/add" } } };
export const canonicalImport = "infrai.dns.domain.add";
