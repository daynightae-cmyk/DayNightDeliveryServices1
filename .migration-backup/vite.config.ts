import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT || 5173)
  },
  preview: {
    host: "0.0.0.0",
    port: Number(process.env.PORT || 4173)
  },
  build: {
    outDir: "dist",
    sourcemap: false
  }
});
