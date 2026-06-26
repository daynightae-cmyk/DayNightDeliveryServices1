import { build } from "vite";

process.env.BASE_PATH ||= "/";
process.env.PORT ||= "3000";

try {
  await build({ configFile: "vite.config.ts" });
} catch (error) {
  console.error(error);
  process.exit(1);
}
