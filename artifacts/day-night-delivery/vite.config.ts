import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT || 3000);
const basePath = process.env.BASE_PATH || "/";
const appRoot = path.resolve(import.meta.dirname);

function productionManualChunk(id: string) {
  const normalized = id.replace(/\\/g, "/");
  if (!normalized.includes("/node_modules/")) return undefined;

  if (/\/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(normalized)) {
    return "vendor-react";
  }
  if (normalized.includes("/node_modules/@supabase/")) return "vendor-supabase";
  if (/\/node_modules\/(leaflet|react-leaflet)\//.test(normalized)) return "vendor-maps";
  if (/\/node_modules\/(jspdf|html2canvas|dompurify)\//.test(normalized)) return "vendor-documents";
  if (normalized.includes("/node_modules/recharts/") || normalized.includes("/node_modules/d3-")) return "vendor-charts";
  if (normalized.includes("/node_modules/framer-motion/") || normalized.includes("/node_modules/motion/")) return "vendor-motion";
  if (normalized.includes("/node_modules/lucide-react/") || normalized.includes("/node_modules/react-icons/")) return "vendor-icons";
  return undefined;
}

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(appRoot, "src"),
      "@assets": path.resolve(appRoot, "../../attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: appRoot,
  build: {
    outDir: path.resolve(appRoot, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: productionManualChunk,
      },
    },
  },
  server: {
    port,
    strictPort: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
  },
});
