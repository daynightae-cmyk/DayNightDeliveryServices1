const baseUrl = String(
  process.env.ADMIN_PERFORMANCE_BASE_URL || 'https://daynightae.com',
).replace(/\/$/, '');
const marker = String(
  process.env.ADMIN_PERFORMANCE_DEPLOYMENT_MARKER || 'phase4-20260730-1',
).trim();
const maxAttempts = Number(process.env.ADMIN_PERFORMANCE_DEPLOYMENT_ATTEMPTS || 40);
const intervalMs = Number(process.env.ADMIN_PERFORMANCE_DEPLOYMENT_INTERVAL_MS || 15000);

if (!marker) throw new Error('ADMIN_PERFORMANCE_DEPLOYMENT_MARKER is required.');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function stylesheetUrls(html, origin) {
  const urls = new Set();
  const pattern = /(?:href|src)=["']([^"']+\.css(?:\?[^"']*)?)["']/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      urls.add(new URL(match[1], origin).href);
    } catch {
      // Ignore malformed non-production asset references.
    }
  }
  return [...urls];
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const cacheBust = `${Date.now()}-${attempt}`;
  const response = await fetch(`${baseUrl}/?dnPerformanceRelease=${cacheBust}`, {
    headers: { 'cache-control': 'no-cache' },
    redirect: 'follow',
  });
  const html = await response.text();
  const stylesheets = stylesheetUrls(html, response.url || baseUrl);
  let found = false;

  for (const stylesheet of stylesheets) {
    const cssResponse = await fetch(
      `${stylesheet}${stylesheet.includes('?') ? '&' : '?'}dnPerformanceRelease=${cacheBust}`,
      { headers: { 'cache-control': 'no-cache' } },
    );
    if (!cssResponse.ok) continue;
    const css = await cssResponse.text();
    if (css.includes(marker)) {
      found = true;
      break;
    }
  }

  if (found) {
    console.log(`Verified production admin performance release marker: ${marker}`);
    process.exit(0);
  }

  console.log(
    `Production marker not available yet (${attempt}/${maxAttempts}); checked ${stylesheets.length} stylesheet(s).`,
  );
  if (attempt < maxAttempts) await sleep(intervalMs);
}

throw new Error(
  `Production deployment did not expose admin performance marker ${marker} within the acceptance window.`,
);
