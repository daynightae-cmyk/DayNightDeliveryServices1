import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve(process.cwd(), "dist");
const indexPath = path.join(distDir, "index.html");

if (!fs.existsSync(indexPath)) {
  console.error("Missing dist/index.html. Run the Vite build before creating SPA route fallbacks.");
  process.exit(1);
}

const indexHtml = fs.readFileSync(indexPath, "utf8");

const spaRoutes = [
  "about",
  "services",
  "uae-delivery",
  "international-shipping",
  "international-advanced",
  "ecommerce",
  "corporate",
  "pricing",
  "request",
  "tracking",
  "faq",
  "contact",
  "policy",
  "privacy",
  "terms",
  "shipping-policy",
  "refund-policy",
  "trust",
  "qr",
  "gallery",
  "auth",
  "driver",
  "customer",
  "admin"
];

for (const route of spaRoutes) {
  const routeDir = path.join(distDir, route);
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(path.join(routeDir, "index.html"), indexHtml, "utf8");
  fs.writeFileSync(path.join(distDir, `${route}.html`), indexHtml, "utf8");
}

fs.writeFileSync(path.join(distDir, "404.html"), indexHtml, "utf8");

console.log(`SPA route fallbacks created for ${spaRoutes.length} routes.`);
