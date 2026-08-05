import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { adminStepUpRulePlugin } from "./scripts/admin-step-up-rule-plugin";
import { preciseFinancialRuleCompatiblePlugin } from "./scripts/precise-financial-rule-compatible-plugin";
import { friendlyErrorMessagePlugin } from "./scripts/friendly-error-message-plugin";
import { merchantStatementLayoutPlugin } from "./scripts/merchant-statement-layout-plugin";

const port = Number(process.env.PORT || 3000);
const basePath = process.env.BASE_PATH || "/";
const appRoot = path.resolve(import.meta.dirname);
const builtAt = new Date().toISOString();
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.DAY_NIGHT_BUILD_ID ||
  `local-${builtAt.replace(/[-:.TZ]/g, "")}`;

const approvedSupabaseUrl = "https://ngdwybpgacauorygoedi.supabase.co";
const publicSupabaseAnonKey = [
  process.env.SUPABASE_PUBLISHABLE_KEY,
  process.env.SUPABASE_ANON_KEY,
  process.env.VITE_SUPABASE_ANON_KEY,
]
  .map((value) => String(value || "").trim())
  .find(Boolean) || "";

process.env.VITE_SUPABASE_URL = approvedSupabaseUrl;
if (publicSupabaseAnonKey) {
  process.env.VITE_SUPABASE_ANON_KEY = publicSupabaseAnonKey;
}

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
            supabaseProject: "ngdwybpgacauorygoedi",
            supabaseKeyConfigured: Boolean(publicSupabaseAnonKey),
            supabaseConfigSource: "authoritative-vite-build-config",
            adminFinancialRule: "zero-goods-zero-delivery-merchant-v3",
            adminFinancialPreviewVerification: "exact-vercel-preview-browser-v3",
            adminStepUpRule: "sensitive-admin-actions-v1",
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
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(approvedSupabaseUrl),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(publicSupabaseAnonKey),
  },
  plugins: [
    adminStepUpRulePlugin(),
    preciseFinancialRuleCompatiblePlugin(),
    friendlyErrorMessagePlugin(),
    merchantStatementLayoutPlugin(),
    react(),
    tailwindcss(),
    buildMetadataPlugin(),
  ],
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
