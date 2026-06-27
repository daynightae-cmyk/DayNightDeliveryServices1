import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT || 3000);
const basePath = process.env.BASE_PATH || "/";

function dayNightLuxuryShells() {
  return {
    name: "day-night-luxury-shells",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!id.endsWith("src/App.tsx")) return null;
      return code
        .replace('const AdminPanel = lazy(() => import("./components/AdminPanel"));', 'const AdminPanel = lazy(() => import("./components/AdminPanelLuxury"));')
        .replace('const CustomerDashboard = lazy(() => import("./components/customer/CustomerDashboard"));', 'const CustomerDashboard = lazy(() => import("./components/customer/CustomerDashboardLuxury"));');
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [dayNightLuxuryShells(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
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
