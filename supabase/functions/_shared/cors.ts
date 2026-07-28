const allowedOrigins = [
  /^https:\/\/(?:www\.)?daynightae\.com$/i,
  /^https:\/\/day-night-delivery1\.vercel\.app$/i,
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/i,
  /^http:\/\/localhost(?::\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/i,
];

export function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = allowedOrigins.some((pattern) => pattern.test(origin));
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://www.daynightae.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function handleCors(req: Request) {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}
