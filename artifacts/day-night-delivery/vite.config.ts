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

/**
 * DAY NIGHT production configuration is intentionally authoritative here.
 *
 * Vercel currently contains duplicated URL variables with different environment
 * scopes. A stale VITE_SUPABASE_URL must never disconnect the browser client
 * from the approved production database. The project URL is therefore fixed,
 * while the public anon/publishable key is selected from server-side build
 * variables and then injected into the Vite bundle.
 *
 * Never add SUPABASE_SERVICE_ROLE_KEY to this list: service-role credentials
 * must not be exposed to browser code.
 */
const approvedSupabaseUrl = "https://ngdwybpgacauorygoedi.supabase.co";
const publicSupabaseAnonKey = [
  process.env.SUPABASE_PUBLISHABLE_KEY,
  process.env.SUPABASE_ANON_KEY,
  process.env.VITE_SUPABASE_ANON_KEY,
]
  .map((value) => String(value || "").trim())
  .find(Boolean) || "";

// Keep Vite's normal env pipeline aligned with the explicit compile-time values.
process.env.VITE_SUPABASE_URL = approvedSupabaseUrl;
if (publicSupabaseAnonKey) {
  process.env.VITE_SUPABASE_ANON_KEY = publicSupabaseAnonKey;
}

function replaceRequired(
  source: string,
  pattern: string | RegExp,
  replacement: string,
  label: string,
) {
  const next = source.replace(pattern, replacement);
  if (next === source) {
    throw new Error(`DAY NIGHT build rule could not apply: ${label}`);
  }
  return next;
}

/**
 * Authoritative admin accounting UX rule.
 *
 * This pre-transform keeps the operational screens aligned with the accounting
 * engine while the large legacy admin components are being decomposed. It is
 * intentionally fail-closed: if a target component changes and a rule can no
 * longer be applied, the production build fails instead of silently restoring
 * the incorrect zero-value behavior.
 */
function adminFinancialRulePlugin(): Plugin {
  return {
    name: "day-night-admin-financial-rule-v2",
    enforce: "pre",
    transform(source, id) {
      const normalized = id.replace(/\\/g, "/").split("?")[0];

      if (normalized.endsWith("/src/lib/adminOperationsData.ts")) {
        const code = replaceRequired(
          source,
          'if (input.price_mode === "manual" && manual !== null) {',
          'if (input.price_mode === "manual" && manual !== null && manual > 0) {',
          "manual zero delivery falls back to system pricing",
        );
        return { code, map: null };
      }

      if (normalized.endsWith("/src/lib/orderFinancialOperations.ts")) {
        const code = replaceRequired(
          source,
          ': `Due to merchant ${financials.merchantDue.toFixed(2)} AED`;',
          ': `Merchant net ${financials.merchantDue.toFixed(2)} AED`;',
          "remove ambiguous due-to-merchant wording from finance notes",
        );
        return { code, map: null };
      }

      if (normalized.endsWith("/src/components/admin/AdminNewOrderComplete.tsx")) {
        let code = source;
        code = replaceRequired(
          code,
          /function merchantSettlement\(value: number, isArabic: boolean\) \{[\s\S]*?\n\}\n\nfunction FinancialMetric/,
          `function merchantSettlement(value: number, isArabic: boolean) {
  const dueFromMerchant = value <= 0;
  return {
    label: isArabic
      ? dueFromMerchant
        ? "مستحق على التاجر"
        : "صافي حساب التاجر"
      : dueFromMerchant
        ? "Due from merchant"
        : "Merchant net",
    amount: value,
  };
}

function FinancialMetric`,
          "new-order merchant settlement wording and signed amount",
        );
        code = replaceRequired(
          code,
          /  const authoritativeDeliveryFeeMode =\n    form\.payment_method === "merchant_pays" \|\| form\.payment_method === "sender_pays"\n      \? "deduct_from_merchant"\n      : form\.delivery_fee_mode;/,
          `  const goodsValueIsZero = form.goods_value !== "" && Number(form.goods_value) === 0;
  const authoritativeDeliveryFeeMode =
    goodsValueIsZero ||
    form.payment_method === "merchant_pays" ||
    form.payment_method === "sender_pays"
      ? "deduct_from_merchant"
      : form.delivery_fee_mode;`,
          "zero goods selects merchant-paid delivery in new order",
        );
        code = replaceRequired(
          code,
          /  function setField<K extends keyof FinancialOpsOrderInput>\(key: K, value: FinancialOpsOrderInput\[K\]\) \{[\s\S]*?\n  \}\n\n  function setPaymentMethod/,
          `  function setField<K extends keyof FinancialOpsOrderInput>(key: K, value: FinancialOpsOrderInput[K]) {
    setForm((current) => {
      const currentZeroGoods = current.goods_value !== "" && Number(current.goods_value) === 0;

      if (key === "goods_value") {
        const nextZeroGoods = value !== "" && Number(value) === 0;
        const invalidManualFee =
          current.price_mode === "manual" && Number(current.manual_delivery_price || 0) <= 0;
        return {
          ...current,
          [key]: value,
          ...(nextZeroGoods
            ? {
                delivery_fee_mode: "deduct_from_merchant" as const,
                payment_method: "merchant_pays",
                price_mode: invalidManualFee ? ("system" as const) : current.price_mode,
                manual_delivery_price: invalidManualFee ? "" : current.manual_delivery_price,
                cod_amount: 0,
              }
            : {}),
        } as FinancialOpsOrderInput;
      }

      if (currentZeroGoods && key === "delivery_fee_mode") {
        return {
          ...current,
          delivery_fee_mode: "deduct_from_merchant",
          payment_method: "merchant_pays",
        } as FinancialOpsOrderInput;
      }

      if (currentZeroGoods && key === "payment_method") {
        return {
          ...current,
          payment_method: "merchant_pays",
          delivery_fee_mode: "deduct_from_merchant",
        } as FinancialOpsOrderInput;
      }

      if (
        currentZeroGoods &&
        key === "manual_delivery_price" &&
        (value === "" || Number(value) <= 0)
      ) {
        return {
          ...current,
          price_mode: "system",
          manual_delivery_price: "",
          payment_method: "merchant_pays",
          delivery_fee_mode: "deduct_from_merchant",
        } as FinancialOpsOrderInput;
      }

      return { ...current, [key]: value } as FinancialOpsOrderInput;
    });
    setSource("pending");
    setMessage("");
    setError("");
  }

  function setPaymentMethod`,
          "new-order zero-goods field synchronization",
        );
        code = replaceRequired(
          code,
          /  function setPaymentMethod\(value: string\) \{[\s\S]*?\n  \}\n\n  function setDeliveryFeeMode/,
          `  function setPaymentMethod(value: string) {
    setForm((current) => {
      const zeroGoods = current.goods_value !== "" && Number(current.goods_value) === 0;
      return {
        ...current,
        payment_method: zeroGoods ? "merchant_pays" : value,
        delivery_fee_mode:
          zeroGoods || value === "merchant_pays" || value === "sender_pays"
            ? "deduct_from_merchant"
            : "customer_pays",
      };
    });
    setSource("pending");
    setMessage("");
    setError("");
  }

  function setDeliveryFeeMode`,
          "new-order zero-goods payment synchronization",
        );
        code = replaceRequired(
          code,
          /  function setDeliveryFeeMode\(value: "customer_pays" \| "deduct_from_merchant"\) \{[\s\S]*?\n  \}\n\n  function chooseMerchant/,
          `  function setDeliveryFeeMode(value: "customer_pays" | "deduct_from_merchant") {
    setForm((current) => {
      const zeroGoods = current.goods_value !== "" && Number(current.goods_value) === 0;
      return {
        ...current,
        delivery_fee_mode:
          zeroGoods || current.payment_method === "merchant_pays" || current.payment_method === "sender_pays"
            ? "deduct_from_merchant"
            : value,
        payment_method: zeroGoods ? "merchant_pays" : current.payment_method,
      };
    });
    setSource("pending");
    setMessage("");
    setError("");
  }

  function chooseMerchant`,
          "new-order zero-goods delivery-mode lock",
        );
        return { code, map: null };
      }

      if (normalized.endsWith("/src/components/admin/AdminOrderEditModalComplete.tsx")) {
        let code = source;
        code = replaceRequired(
          code,
          '    payment_method: order.payment_method === "sender_pays" ? "merchant_pays" : order.payment_method || "cod",',
          `    payment_method:
      finance.deliveryFeeMode === "deduct_from_merchant"
        ? "merchant_pays"
        : order.payment_method === "sender_pays"
          ? "merchant_pays"
          : order.payment_method || "cod",`,
          "edit form selects merchant account for merchant-paid orders",
        );
        if (code.includes('    price_mode: personal ? "system" : manual ? "manual" : "system",')) {
          code = replaceRequired(
            code,
            '    price_mode: personal ? "system" : manual ? "manual" : "system",',
            '    price_mode: personal ? "system" : manual && !(finance.goodsValue === 0 && currentPrice <= 0) ? "manual" : "system",',
            "edit personal order form rejects zero manual delivery pricing",
          );
        } else {
          code = replaceRequired(
            code,
            '    price_mode: manual ? "manual" : "system",',
            '    price_mode: manual && !(finance.goodsValue === 0 && currentPrice <= 0) ? "manual" : "system",',
            "edit form rejects zero manual delivery pricing",
          );
        }
        code = replaceRequired(
          code,
          /  function setField<K extends keyof FinancialOpsOrderInput>\(key: K, value: FinancialOpsOrderInput\[K\]\) \{[\s\S]*?\n  \}\n\n  function chooseMerchant/,
          `  function setField<K extends keyof FinancialOpsOrderInput>(key: K, value: FinancialOpsOrderInput[K]) {
    setForm((current) => {
      if (!current) return current;
      const currentZeroGoods = current.goods_value !== "" && Number(current.goods_value) === 0;

      if (key === "goods_value") {
        const nextZeroGoods = value !== "" && Number(value) === 0;
        const invalidManualFee =
          current.price_mode === "manual" && Number(current.manual_delivery_price || 0) <= 0;
        return {
          ...current,
          [key]: value,
          ...(nextZeroGoods
            ? {
                delivery_fee_mode: "deduct_from_merchant" as const,
                payment_method: "merchant_pays",
                price_mode: invalidManualFee ? ("system" as const) : current.price_mode,
                manual_delivery_price: invalidManualFee ? "" : current.manual_delivery_price,
                cod_amount: 0,
              }
            : {}),
        } as FinancialOpsOrderInput;
      }

      if (currentZeroGoods && key === "delivery_fee_mode") {
        return {
          ...current,
          delivery_fee_mode: "deduct_from_merchant",
          payment_method: "merchant_pays",
        } as FinancialOpsOrderInput;
      }

      if (currentZeroGoods && key === "payment_method") {
        return {
          ...current,
          payment_method: "merchant_pays",
          delivery_fee_mode: "deduct_from_merchant",
        } as FinancialOpsOrderInput;
      }

      if (
        currentZeroGoods &&
        key === "manual_delivery_price" &&
        (value === "" || Number(value) <= 0)
      ) {
        return {
          ...current,
          price_mode: "system",
          manual_delivery_price: "",
          payment_method: "merchant_pays",
          delivery_fee_mode: "deduct_from_merchant",
        } as FinancialOpsOrderInput;
      }

      return { ...current, [key]: value } as FinancialOpsOrderInput;
    });
    setMessage("");
    setError("");
  }

  function chooseMerchant`,
          "edit zero-goods field synchronization",
        );
        code = replaceRequired(
          code,
          /<Metric label=\{financials\.merchantDue < 0 \? \(isArabic \? "مستحق على التاجر" : "Due from merchant"\) : \(isArabic \? "مستحق للتاجر" : "Due to merchant"\)\} value=\{Math\.abs\(financials\.merchantDue\)\} \/>/,
          `<Metric
                    label={
                      financials.merchantDue <= 0
                        ? isArabic
                          ? "مستحق على التاجر"
                          : "Due from merchant"
                        : isArabic
                          ? "صافي حساب التاجر"
                          : "Merchant net"
                    }
                    value={financials.merchantDue}
                  />`,
          "edit settlement wording and signed amount",
        );
        if (!code.includes('? "حفظ التعديلات الآن"')) {
          code = replaceRequired(
            code,
            '                    ? "تحديث الطلب الآن"',
            '                    ? "حفظ التحديث الآن"',
            "Arabic update button label",
          );
        }
        if (!code.includes(': "Save changes now"}')) {
          code = replaceRequired(
            code,
            '                    : "Update order now"}',
            '                    : "Save order updates"}',
            "English update button label",
          );
        }
        return { code, map: null };
      }

      return null;
    },
  };
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
            adminFinancialRule: "zero-goods-auto-merchant-v2",
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
  plugins: [adminFinancialRulePlugin(), react(), tailwindcss(), buildMetadataPlugin()],
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
