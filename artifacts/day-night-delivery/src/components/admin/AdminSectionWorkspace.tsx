import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import { matchesAdminSection, normalizeOrderStatus } from "../../lib/adminOrderLogic";
import AdminOrderBulkOperations from "./AdminOrderBulkOperations";
import AdminSectionWorkspaceComplete from "./AdminSectionWorkspaceComplete";

const PENDING_SCOPE_KEY = "dn-admin-pending-merchant-order-scope";
const SCOPE_TTL_MS = 60_000;

const ORDER_SECTIONS = new Set([
  "all_orders",
  "cancelled",
  "review",
  "postponed",
  "returned",
  "pickup",
  "abu_dhabi",
  "external",
  "out_scope",
]);

type WorkspaceProps = ComponentProps<typeof AdminSectionWorkspaceComplete>;

type MerchantScopeHint = {
  merchantCode: string;
  merchantName: string;
  capturedAt: number;
};

type ResolvedMerchantScope = {
  id: string;
  code: string;
  name: string;
};

declare global {
  interface Window {
    __dnAdminMerchantOrderScopeCaptureInstalled?: boolean;
  }
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalize(value: unknown) {
  return clean(value).toLocaleLowerCase();
}

function orderId(order: WorkspaceProps["orders"][number]) {
  return clean(order.id || order.tracking_number || order.invoice_number || order.coupon_number);
}

function orderSearchText(order: WorkspaceProps["orders"][number]) {
  return normalize(
    [
      order.id,
      order.tracking_number,
      order.invoice_number,
      order.coupon_number,
      order.merchant_id,
      order.merchant_code,
      order.merchant_name,
      order.sender_name,
      order.sender_phone,
      order.receiver_name,
      order.customer_name,
      order.receiver_phone,
      order.customer_phone,
      order.sender_city,
      order.receiver_city,
      order.destination_country,
      order.sender_address,
      order.receiver_address,
      order.driver_name,
      order.driver_phone,
      order.status,
      normalizeOrderStatus(order),
      order.cod_amount,
      order.delivery_price,
      order.notes,
    ].join(" "),
  );
}

function installMerchantOrderScopeCapture() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    window.__dnAdminMerchantOrderScopeCaptureInstalled
  ) {
    return;
  }

  window.__dnAdminMerchantOrderScopeCaptureInstalled = true;

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button") as HTMLButtonElement | null;
      if (!button) return;

      const buttonText = normalize(button.textContent);
      const isOpenMerchantOrders =
        buttonText.includes("فتح طلباته") ||
        buttonText.includes("open orders");

      if (!isOpenMerchantOrders) return;

      const detailsRoot = button.closest(".space-y-4") as HTMLElement | null;
      const merchantName = clean(detailsRoot?.querySelector("h3")?.textContent);
      const identityLine = clean(
        detailsRoot?.querySelector('p[dir="ltr"]')?.textContent,
      );
      const merchantCodeRaw = clean(identityLine.split("·")[0]);
      const merchantCode =
        normalize(merchantCodeRaw) === "no-code" ? "" : merchantCodeRaw;

      if (!merchantCode && !merchantName) return;

      const payload: MerchantScopeHint = {
        merchantCode,
        merchantName,
        capturedAt: Date.now(),
      };

      try {
        window.sessionStorage.setItem(PENDING_SCOPE_KEY, JSON.stringify(payload));
      } catch {
        // Fail closed in the workspace when browser storage is unavailable.
      }
    },
    true,
  );
}

installMerchantOrderScopeCapture();

function consumePendingScope(): MerchantScopeHint | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(PENDING_SCOPE_KEY);
    window.sessionStorage.removeItem(PENDING_SCOPE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<MerchantScopeHint>;
    const capturedAt = Number(parsed.capturedAt || 0);
    if (!capturedAt || Date.now() - capturedAt > SCOPE_TTL_MS) return null;

    const merchantCode = clean(parsed.merchantCode);
    const merchantName = clean(parsed.merchantName);
    if (!merchantCode && !merchantName) return null;

    return { merchantCode, merchantName, capturedAt };
  } catch {
    return null;
  }
}

export default function AdminSectionWorkspace(props: WorkspaceProps) {
  const [scopeHint, setScopeHint] = useState<MerchantScopeHint | null>(null);
  const [merchantFilterId, setMerchantFilterId] = useState("");
  const [bulkQuery, setBulkQuery] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  useLayoutEffect(() => {
    if (props.id !== "all_orders") {
      setScopeHint(null);
      return;
    }

    setScopeHint(consumePendingScope());
  }, [props.id]);

  useEffect(() => {
    setMerchantFilterId("");
    setBulkQuery("");
    setSelectedOrderIds([]);
  }, [props.id]);

  const resolution = useMemo(() => {
    if (!scopeHint) {
      return {
        merchant: null as ResolvedMerchantScope | null,
        orders: props.orders,
        error: "",
      };
    }

    const byCode = scopeHint.merchantCode
      ? props.merchants.filter(
          (merchant) =>
            normalize(merchant.merchant_code) === normalize(scopeHint.merchantCode),
        )
      : [];

    const candidates =
      byCode.length > 0
        ? byCode
        : props.merchants.filter(
            (merchant) =>
              normalize(merchant.trade_name) === normalize(scopeHint.merchantName),
          );

    if (candidates.length !== 1) {
      return {
        merchant: null as ResolvedMerchantScope | null,
        orders: [],
        error:
          candidates.length > 1
            ? "merchant_scope_ambiguous"
            : "merchant_scope_not_found",
      };
    }

    const selectedMerchant = candidates[0];
    const merchantId = clean(selectedMerchant.id);
    if (!merchantId) {
      return {
        merchant: null as ResolvedMerchantScope | null,
        orders: [],
        error: "merchant_id_missing",
      };
    }

    const exactOrders = props.orders.filter(
      (order) => clean(order.merchant_id) === merchantId,
    );

    return {
      merchant: {
        id: merchantId,
        code: clean(selectedMerchant.merchant_code),
        name:
          clean(selectedMerchant.owner_name) ||
          clean(selectedMerchant.trade_name) ||
          merchantId,
      },
      orders: exactOrders,
      error: "",
    };
  }, [props.merchants, props.orders, scopeHint]);

  const filteredOrders = useMemo(() => {
    const query = normalize(bulkQuery);
    return resolution.orders.filter((order) => {
      if (merchantFilterId && clean(order.merchant_id) !== merchantFilterId) return false;
      if (query && !orderSearchText(order).includes(query)) return false;
      return true;
    });
  }, [bulkQuery, merchantFilterId, resolution.orders]);

  const visibleSectionOrders = useMemo(
    () => filteredOrders.filter((order) => matchesAdminSection(order, props.id)),
    [filteredOrders, props.id],
  );

  useEffect(() => {
    const allowed = new Set(visibleSectionOrders.map(orderId).filter(Boolean));
    setSelectedOrderIds((current) => {
      const next = current.filter((id) => allowed.has(id));
      return next.length === current.length && next.every((id, index) => id === current[index])
        ? current
        : next;
    });
  }, [visibleSectionOrders]);

  const selectedOrders = useMemo(() => {
    if (!selectedOrderIds.length) return [];
    const selected = new Set(selectedOrderIds);
    return visibleSectionOrders.filter((order) => selected.has(orderId(order)));
  }, [selectedOrderIds, visibleSectionOrders]);

  const workspaceOrders = selectedOrders.length ? selectedOrders : filteredOrders;
  const showBulkConsole = ORDER_SECTIONS.has(props.id);

  return (
    <>
      {scopeHint && (
        <div
          className="mb-4 flex flex-col gap-3 rounded-2xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-sm font-black text-white sm:flex-row sm:items-center sm:justify-between"
          dir={props.isArabic ? "rtl" : "ltr"}
        >
          <div>
            {resolution.merchant ? (
              <>
                <span className="text-brand-gold">
                  {props.isArabic ? "طلبات التاجر فقط:" : "Exact merchant orders:"}
                </span>{" "}
                <strong>{resolution.merchant.name}</strong>
                {resolution.merchant.code && (
                  <small className="mx-2 text-white/55" dir="ltr">
                    {resolution.merchant.code}
                  </small>
                )}
                <span className="mx-2 text-white/55">
                  ({resolution.orders.length})
                </span>
              </>
            ) : (
              <span className="text-rose-200">
                {props.isArabic
                  ? "تعذر تحديد التاجر بمعرّف واحد؛ تم إخفاء كل الطلبات بدل عرض بيانات تاجر آخر."
                  : "The merchant could not be resolved uniquely; all orders were hidden instead of exposing another merchant's data."}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setScopeHint(null)}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-black text-white transition hover:border-brand-gold/40 hover:text-brand-gold"
          >
            {props.isArabic ? "عرض كافة الطلبات" : "Show all orders"}
          </button>
        </div>
      )}

      {showBulkConsole && (
        <div className="mb-4">
          <AdminOrderBulkOperations
            isArabic={props.isArabic}
            orders={visibleSectionOrders}
            merchants={props.merchants}
            merchantId={merchantFilterId}
            query={bulkQuery}
            selectedIds={selectedOrderIds}
            onMerchantChange={(merchantId) => {
              setMerchantFilterId(merchantId);
              setSelectedOrderIds([]);
            }}
            onQueryChange={(query) => {
              setBulkQuery(query);
              setSelectedOrderIds([]);
            }}
            onSelectionChange={setSelectedOrderIds}
          />
        </div>
      )}

      <AdminSectionWorkspaceComplete {...props} orders={workspaceOrders} />
    </>
  );
}
