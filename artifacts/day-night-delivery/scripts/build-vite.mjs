import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");

process.env.BASE_PATH ||= "/";
process.env.PORT ||= "3000";

try {
  await build({
    root: appRoot,
    configFile: path.join(appRoot, "vite.config.ts"),
  });
} catch (error) {
  console.error(error);
  process.exit(1);
}
