const PROTECTED_PORTAL_PATTERN = /^\/(admin|auth)(?:\/|$)/i;
const ENTRY_MARKER = "__dn_entry";

export const config = {
  matcher: ["/admin/:path*", "/auth/:path*"],
};

function protectedHeaders(headers?: HeadersInit) {
  const result = new Headers(headers);
  result.set("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
  result.set("CDN-Cache-Control", "no-store");
  result.set("Vercel-CDN-Cache-Control", "no-store");
  result.set("Pragma", "no-cache");
  result.set("Expires", "0");
  result.set("Clear-Site-Data", '"cache"');
  result.set("X-DAY-NIGHT-Portal-Fresh", "root-middleware-v1");
  return result;
}

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  if (!PROTECTED_PORTAL_PATTERN.test(url.pathname)) return fetch(request);

  if (!url.searchParams.has(ENTRY_MARKER)) {
    url.searchParams.set(ENTRY_MARKER, `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`);
    return new Response(null, {
      status: 307,
      headers: protectedHeaders({ Location: url.toString() }),
    });
  }

  const shellUrl = new URL("/index.html", request.url);
  shellUrl.searchParams.set("__dn_portal_shell", url.searchParams.get(ENTRY_MARKER) || Date.now().toString(36));

  const shell = await fetch(shellUrl, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      "X-DAY-NIGHT-Portal-Entry": "1",
    },
  });

  return new Response(shell.body, {
    status: shell.status,
    statusText: shell.statusText,
    headers: protectedHeaders(shell.headers),
  });
}
