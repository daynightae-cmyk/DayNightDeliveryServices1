const PROTECTED_PORTAL_PATTERN = /^\/(admin|auth)(?:\/|$)/i;
const ENTRY_MARKER = "__dn_entry";

export const config = {
  matcher: ["/admin/:path*", "/auth/:path*"],
};

function noStoreHeaders(headers?: HeadersInit) {
  const next = new Headers(headers);
  next.set("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
  next.set("CDN-Cache-Control", "no-store");
  next.set("Vercel-CDN-Cache-Control", "no-store");
  next.set("Pragma", "no-cache");
  next.set("Expires", "0");
  next.set("Clear-Site-Data", '"cache"');
  next.set("X-DAY-NIGHT-Portal-Fresh", "1");
  return next;
}

export default async function middleware(request: Request) {
  const requestedUrl = new URL(request.url);
  if (!PROTECTED_PORTAL_PATTERN.test(requestedUrl.pathname)) {
    return fetch(request);
  }

  // A clean /admin or /auth entry is redirected to a unique URL before the SPA
  // shell is returned. This defeats an old HTTP/app-shell cache without requiring
  // Ctrl+F5 and also prevents the browser back-forward cache from restoring an
  // obsolete admin bundle under the same address.
  if (!requestedUrl.searchParams.has(ENTRY_MARKER)) {
    requestedUrl.searchParams.set(ENTRY_MARKER, `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`);
    return new Response(null, {
      status: 307,
      headers: noStoreHeaders({ Location: requestedUrl.toString() }),
    });
  }

  const shellUrl = new URL("/index.html", request.url);
  shellUrl.searchParams.set("__dn_portal_shell", requestedUrl.searchParams.get(ENTRY_MARKER) || Date.now().toString(36));

  const shellResponse = await fetch(shellUrl, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      "X-DAY-NIGHT-Portal-Entry": "1",
    },
  });

  return new Response(shellResponse.body, {
    status: shellResponse.status,
    statusText: shellResponse.statusText,
    headers: noStoreHeaders(shellResponse.headers),
  });
}
