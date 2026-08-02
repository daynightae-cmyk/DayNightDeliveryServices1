import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sourcePath = path.resolve('.github/scripts/final-preview-browser-acceptance.mjs');
const temporaryPath = path.resolve(
  `.github/scripts/.final-preview-browser-acceptance-${process.pid}.mjs`,
);

const source = fs.readFileSync(sourcePath, 'utf8');
const functionPattern = /async function openAdminFromInjectedSession\(page\) \{[\s\S]*?^\}/m;
const replacement = `async function openAdminFromInjectedSession(page) {
  const target = \`${'${base}'}/admin?nosplash=1&lang=ar&__dn_acceptance=final_preview\`;
  const shell = page.locator('.dncc-shell');

  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (await shell.waitFor({ state: 'visible', timeout: 45000 }).then(() => true).catch(() => false)) return;

  // Use the production login flow when a serialized browser session is still
  // hydrating or has been rejected. This guarantees that all subsequent admin
  // order reads use the same authenticated client instance as the application.
  await page.evaluate((key) => window.localStorage.removeItem(key), storageKey);
  await page.goto(\`${'${base}'}/auth?nosplash=1&lang=ar&__dn_acceptance=final_preview_login\`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });

  const intro = page.locator('.auth-clean__intro-cta');
  if (await intro.isVisible().catch(() => false)) await intro.click();

  const email = page.locator('#dn-admin-email');
  const password = page.locator('#dn-admin-password');
  await email.waitFor({ state: 'visible', timeout: 30000 });
  await password.waitFor({ state: 'visible', timeout: 30000 });
  await email.fill(adminEmail);
  await password.fill(adminPassword);
  await page.locator('button[type="submit"]').click();

  await shell.waitFor({ state: 'visible', timeout: 90000 });
}`;

const hardened = source.replace(functionPattern, replacement);
if (hardened === source) {
  throw new Error('final_preview_admin_session_function_not_found');
}

fs.writeFileSync(temporaryPath, hardened, 'utf8');
try {
  await import(`${pathToFileURL(temporaryPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(temporaryPath, { force: true });
}
