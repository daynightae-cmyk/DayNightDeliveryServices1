import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT || 3000);
const basePath = process.env.BASE_PATH || "/";
const appRoot = path.resolve(import.meta.dirname);
const builtAt = new Date().toISOString();
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.DAY_NIGHT_BUILD_ID ||
  `local-${builtAt.replace(/[-:.TZ]/g, "")}`;

function buildMetadataPlugin(): Plugin {
  return {
    name: "day-night-build-metadata",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify(
          {
            app: "DAY NIGHT DELIVERY SERVICES",
            buildId,
            builtAt,
          },
          null,
          2,
        ),
      });
    },
  };
}

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
  define: {
    __DAY_NIGHT_BUILD_ID__: JSON.stringify(buildId),
    __DAY_NIGHT_BUILT_AT__: JSON.stringify(builtAt),
  },
  plugins: [react(), tailwindcss(), buildMetadataPlugin()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(appRoot, "src") },
      { find: "@assets", replacement: path.resolve(appRoot, "../../attached_assets") },
      {
        find: "./components/AdminPanelLuxury",
        replacement: path.resolve(
          appRoot,
          "src/components/admin/command-center/AdminPanelCommandCenter.tsx",
        ),
      },
    ],
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
