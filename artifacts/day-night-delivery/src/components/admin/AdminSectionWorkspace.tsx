import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import { fetchAdminOrders, fetchMerchants } from "../../lib/adminData";
import { matchesAdminSection, normalizeOrderStatus } from "../../lib/adminOrderLogic";
import { matchesSearchQuery } from "../../lib/searchNormalization";
import AdminOrderBulkOperations from "./AdminOrderBulkOperations";
import AdminInternationalOrdersWorkspace from "./AdminInternationalOrdersWorkspace";
import AdminSectionWorkspaceComplete from "./AdminSectionWorkspaceComplete";

const ORDER_PAGE_SIZE = 20;

const ORDER_SECTIONS = new Set([
  "all_orders",
  "personal_orders",
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
type AdminSectionWorkspaceProps = WorkspaceProps & {
  initialMerchantId?: string;
  onMerchantScopeChange?: (merchantId: string) => void;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function orderId(order: WorkspaceProps["orders"][number]) {
  return clean(order.id || order.tracking_number || order.invoice_number || order.coupon_number);
}

function orderSearchValues(order: WorkspaceProps["orders"][number]) {
  return [
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
  ];
}

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function withOperationalRetry<T>(task: () => Promise<T>, label: string): Promise<T> {
  let latest: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await task();
    } catch (cause) {
      latest = cause;
      if (attempt < 2) await wait(500 * (attempt + 1));
    }
  }
  throw new Error(`${label}: ${latest instanceof Error ? latest.message : String(latest || "unknown failure")}`);
}

export default function AdminSectionWorkspace(props: AdminSectionWorkspaceProps) {
  const [merchantFilterId, setMerchantFilterId] = useState(() => clean(props.initialMerchantId));
  const [bulkQuery, setBulkQuery] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [orderPage, setOrderPage] = useState(0);
  const [recoveredOrders, setRecoveredOrders] = useState<WorkspaceProps["orders"]>([]);
  const [recoveredMerchants, setRecoveredMerchants] = useState<WorkspaceProps["merchants"]>([]);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");

  const showBulkConsole = ORDER_SECTIONS.has(props.id);
  const effectiveOrders = props.orders.length ? props.orders : recoveredOrders;
  const effectiveMerchants = props.merchants.length ? props.merchants : recoveredMerchants;

  useEffect(() => {
    setMerchantFilterId(props.id === "all_orders" ? clean(props.initialMerchantId) : "");
    setBulkQuery("");
    setSelectedOrderIds([]);
    setOrderPage(0);
  }, [props.id, props.initialMerchantId]);

  useEffect(() => {
    if (!showBulkConsole) return;
    const needOrders = !props.orders.length;
    const needMerchants = !props.merchants.length;
    if (!needOrders && !needMerchants) {
      setRecoveryError("");
      setRecoveryLoading(false);
      return;
    }

    let active = true;
    setRecoveryLoading(true);
    setRecoveryError("");

    void Promise.allSettled([
      needOrders
        ? withOperationalRetry(fetchAdminOrders, "orders recovery failed")
        : Promise.resolve(props.orders),
      needMerchants
        ? withOperationalRetry(fetchMerchants, "merchants recovery failed")
        : Promise.resolve(props.merchants),
    ]).then(([ordersResult, merchantsResult]) => {
      if (!active) return;
      const failures: string[] = [];

      if (ordersResult.status === "fulfilled") {
        setRecoveredOrders(Array.isArray(ordersResult.value) ? ordersResult.value : []);
      } else {
        failures.push(ordersResult.reason instanceof Error ? ordersResult.reason.message : String(ordersResult.reason));
      }

      if (merchantsResult.status === "fulfilled") {
        setRecoveredMerchants(Array.isArray(merchantsResult.value) ? merchantsResult.value : []);
      } else {
        failures.push(merchantsResult.reason instanceof Error ? merchantsResult.reason.message : String(merchantsResult.reason));
      }

      if (failures.length) {
        setRecoveryError(
          props.isArabic
            ? "تعذر استكمال تحميل الطلبات أو التجار بعد إعادة المحاولة. لم يتم عرض بيانات مختلطة."
            : "Orders or merchants could not be fully loaded after retrying. No mixed data was shown.",
        );
      }
      setRecoveryLoading(false);
    });

    return () => {
      active = false;
    };
  }, [props.id, props.isArabic, props.orders.length, props.merchants.length, showBulkConsole]);

  const scopedMerchant = useMemo(
    () => effectiveMerchants.find((merchant) => clean(merchant.id) === merchantFilterId) || null,
    [effectiveMerchants, merchantFilterId],
  );

  const filteredOrders = useMemo(() => {
    if (merchantFilterId && !scopedMerchant) return [];
    return effectiveOrders.filter((order) => {
      if (merchantFilterId && clean(order.merchant_id) !== merchantFilterId) return false;
      if (!matchesSearchQuery(orderSearchValues(order), bulkQuery)) return false;
      return true;
    });
  }, [bulkQuery, effectiveOrders, merchantFilterId, scopedMerchant]);

  const visibleSectionOrders = useMemo(
    () => filteredOrders.filter((order) => matchesAdminSection(order, props.id)),
    [filteredOrders, props.id],
  );

  const shouldPageWorkspace = showBulkConsole && props.id !== "external";
  const pageCount = Math.max(1, Math.ceil(visibleSectionOrders.length / ORDER_PAGE_SIZE));
  const safePage = Math.min(orderPage, pageCount - 1);
  const pagedSectionOrders = useMemo(
    () => visibleSectionOrders.slice(safePage * ORDER_PAGE_SIZE, (safePage + 1) * ORDER_PAGE_SIZE),
    [safePage, visibleSectionOrders],
  );

  useEffect(() => {
    if (orderPage !== safePage) setOrderPage(safePage);
  }, [orderPage, safePage]);

  useEffect(() => {
    const allowed = new Set(visibleSectionOrders.map(orderId).filter(Boolean));
    setSelectedOrderIds((current) => {
      const next = current.filter((id) => allowed.has(id));
      return next.length === current.length && next.every((id, index) => id === current[index])
        ? current
        : next;
    });
  }, [visibleSectionOrders]);

  const workspaceOrders = filteredOrders;
  const renderedWorkspaceOrders = shouldPageWorkspace ? pagedSectionOrders : workspaceOrders;

  return (
    <>
      {recoveryLoading && showBulkConsole && (
        <p
          data-admin-order-operational-recovery="true"
          className="mb-4 rounded-xl border border-brand-sky/25 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky"
          dir={props.isArabic ? "rtl" : "ltr"}
        >
          {props.isArabic
            ? "جاري تحميل الطلبات والتجار مباشرة من المصادر المحمية دون انتظار ملخص المالية..."
            : "Loading orders and merchants directly from protected sources without waiting for the finance summary..."}
        </p>
      )}

      {recoveryError && showBulkConsole && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-xs font-bold text-rose-200"
          dir={props.isArabic ? "rtl" : "ltr"}
        >
          {recoveryError}
        </p>
      )}

      {props.id === "all_orders" && merchantFilterId && (
        <div
          className="mb-4 flex flex-col gap-3 rounded-2xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-sm font-black text-white sm:flex-row sm:items-center sm:justify-between"
          dir={props.isArabic ? "rtl" : "ltr"}
        >
          <div>
            {scopedMerchant ? (
              <>
                <span className="text-brand-gold">
                  {props.isArabic ? "طلبات التاجر فقط:" : "Exact merchant orders:"}
                </span>{" "}
                <strong>{clean(scopedMerchant.owner_name) || clean(scopedMerchant.trade_name) || merchantFilterId}</strong>
                {scopedMerchant.merchant_code && (
                  <small className="mx-2 text-white/55" dir="ltr">
                    {scopedMerchant.merchant_code}
                  </small>
                )}
                <span className="mx-2 text-white/55">({filteredOrders.length})</span>
              </>
            ) : (
              <span className="text-rose-200">
                {props.isArabic
                  ? "معرّف التاجر المحدد غير موجود في القائمة الحالية؛ تم إخفاء كل الطلبات بدل عرض بيانات تاجر آخر."
                  : "The selected merchant UUID is not present in the current list; all orders were hidden instead of exposing another merchant's data."}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setMerchantFilterId("");
              props.onMerchantScopeChange?.("");
              setOrderPage(0);
            }}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-black text-white transition hover:border-brand-gold/40 hover:text-brand-gold"
          >
            {props.isArabic ? "عرض كافة الطلبات" : "Show all orders"}
          </button>
        </div>
      )}

      {showBulkConsole && (
        <div className="mb-4">
          <AdminOrderBulkOperations
            sectionId={props.id}
            isArabic={props.isArabic}
            orders={visibleSectionOrders}
            merchants={effectiveMerchants}
            merchantId={merchantFilterId}
            query={bulkQuery}
            selectedIds={selectedOrderIds}
            onMerchantChange={(merchantId) => {
              setMerchantFilterId(merchantId);
              props.onMerchantScopeChange?.(merchantId);
              setSelectedOrderIds([]);
              setOrderPage(0);
            }}
            onQueryChange={(query) => {
              setBulkQuery(query);
              setSelectedOrderIds([]);
              setOrderPage(0);
            }}
            onSelectionChange={setSelectedOrderIds}
          />
        </div>
      )}

      {shouldPageWorkspace && visibleSectionOrders.length > 0 && (
        <div className="dn-admin-order-pagination" dir={props.isArabic ? "rtl" : "ltr"}>
          <span>
            {props.isArabic ? "عرض" : "Showing"} {safePage * ORDER_PAGE_SIZE + 1}–{Math.min((safePage + 1) * ORDER_PAGE_SIZE, visibleSectionOrders.length)} / {visibleSectionOrders.length}
          </span>
          <div>
            <button type="button" disabled={safePage === 0} onClick={() => setOrderPage((value) => Math.max(0, value - 1))}>
              {props.isArabic ? "السابق" : "Previous"}
            </button>
            <strong>{safePage + 1} / {pageCount}</strong>
            <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setOrderPage((value) => Math.min(pageCount - 1, value + 1))}>
              {props.isArabic ? "التالي" : "Next"}
            </button>
          </div>
        </div>
      )}

      {props.id === "external" ? (
        <AdminInternationalOrdersWorkspace
          isArabic={props.isArabic}
          orders={renderedWorkspaceOrders}
          merchants={effectiveMerchants}
          onRefresh={props.onRefresh}
          searchManaged
        />
      ) : (
        <AdminSectionWorkspaceComplete
          {...props}
          orders={renderedWorkspaceOrders}
          merchants={effectiveMerchants}
          searchManaged={showBulkConsole}
        />
      )}
    </>
  );
}
