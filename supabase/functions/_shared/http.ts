import { corsHeaders } from "./cors.ts";

export function jsonResponse(req: Request, body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(req),
      ...extraHeaders,
    },
  });
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  const raw = await req.text();
  if (!raw.trim()) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("invalid_json_body");
  }
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "unknown_error");
}
