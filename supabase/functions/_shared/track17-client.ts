import { TRACK17_API_BASE_URL, TRACK17_TIMEOUT_MS } from "./track17-config.ts";

export type Track17Envelope<T = unknown> = {
  code: number;
  data?: T;
  message?: string;
};

export type Track17Result<T = unknown> = {
  httpStatus: number;
  durationMs: number;
  payload: Track17Envelope<T>;
};

export class Track17RequestError extends Error {
  readonly httpStatus: number;
  readonly providerCode: number | null;
  readonly payload: unknown;

  constructor(message: string, httpStatus: number, providerCode: number | null, payload: unknown) {
    super(message);
    this.name = "Track17RequestError";
    this.httpStatus = httpStatus;
    this.providerCode = providerCode;
    this.payload = payload;
  }
}

function apiKey() {
  const value = Deno.env.get("TRACK17_API_KEY")?.trim();
  if (!value) throw new Error("track17_api_key_missing");
  return value;
}

export async function track17Request<T = unknown>(operation: string, body: unknown = []): Promise<Track17Result<T>> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("track17_timeout"), TRACK17_TIMEOUT_MS);

  try {
    const response = await fetch(`${TRACK17_API_BASE_URL}/${operation}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "17token": apiKey(),
        "User-Agent": "DAY-NIGHT-Delivery-Services/17TRACK-v2.4",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload: Track17Envelope<T>;
    try {
      payload = text ? JSON.parse(text) as Track17Envelope<T> : { code: response.status };
    } catch {
      throw new Track17RequestError("track17_invalid_json", response.status, null, text.slice(0, 500));
    }

    if (!response.ok || Number(payload.code) !== 0) {
      throw new Track17RequestError(
        payload.message || `track17_request_failed_${operation}`,
        response.status,
        Number.isFinite(Number(payload.code)) ? Number(payload.code) : null,
        payload,
      );
    }

    return {
      httpStatus: response.status,
      durationMs: Date.now() - started,
      payload,
    };
  } catch (error) {
    if (error instanceof Track17RequestError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Track17RequestError("track17_timeout", 504, null, null);
    }
    throw new Track17RequestError(error instanceof Error ? error.message : "track17_network_error", 502, null, null);
  } finally {
    clearTimeout(timeout);
  }
}

export function acceptedRows(payload: Track17Envelope<any>) {
  return Array.isArray(payload?.data?.accepted) ? payload.data.accepted : [];
}

export function rejectedRows(payload: Track17Envelope<any>) {
  return Array.isArray(payload?.data?.rejected) ? payload.data.rejected : [];
}
