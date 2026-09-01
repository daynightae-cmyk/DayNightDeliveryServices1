import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import { fetchMerchants } from "../../lib/adminData";
import { fetchAdminOrdersResilient } from "../../lib/adminOrderRecovery";
import { matchesAdminSection, normalizeOrderStatus } from "../../lib/adminOrderLogic";
import { matchesSearchQuery } from "../../lib/searchNormalization";
import AdminOrderBulkOperations from "./AdminOrderBulkOperations";
import AdminInternationalOrdersWorkspace from "./AdminInternationalOrdersWorkspace";
import AdminSectionWorkspaceComplete from "./AdminSectionWorkspaceComplete";

const ORDER_PAGE_SIZE = 20;
const OPERATIONAL_REQUEST_TIMEOUT_MS = 8_000;

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

const PROFESSIONAL_ORDER_SECTIONS = new Set([
  "all_orders",
  "cancelled",
  "review",
  "postponed",
  "returned",
  "pickup",
  "abu_dhabi",
  "out_scope",
]);

type WorkspaceProps = ComponentProps<typeof AdminSectionWorkspaceComplete>;
type WorkspaceOrder = WorkspaceProps["orders"][number];
type AdminSectionWorkspaceProps = WorkspaceProps & {
  initialMerchantId?: string;
  onMerchantScopeChange?: (merchantId: string) => void;
};

type AdminOrderMutationDetail = {
  mutation?: unknown;
  order?: WorkspaceOrder;
  deletedId?: unknown;
  deletedReference?: unknown;
  orderId?: unknown;
  status?: unknown;
  driverId?: unknown;
  driverName?: unknown;
  driverCode?: unknown;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function orderId(order: WorkspaceOrder) {
  return clean(order.id || order.tracking_number || order.invoice_number || order.coupon_number);
}

function orderReferences(order: WorkspaceOrder) {
  return [
    order.id,
    order.tracking_number,
    order.invoice_number,
    order.coupon_number,
  ]
    .map(clean)
    .filter(Boolean);
}

function matchesOrderReference(order: WorkspaceOrder, reference: unknown) {
  const target = clean(reference);
  return Boolean(target && orderReferences(order).includes(target));
}

function upsertOrder(current: WorkspaceOrder[], incoming: WorkspaceOrder) {
  const incomingReferences = orderReferences(incoming);
  if (!incomingReferences.length) return current;

  const index = current.findIndex((row) =>
    orderReferences(row).some((reference) => incomingReferences.includes(reference)),
  );
  if (index < 0) return [incoming, ...current];

  const next = current.slice();
  next[index] = { ...current[index], ...incoming };
  return next;
}

function removeOrder(
  current: WorkspaceOrder[],
  deletedId: unknown,
  deletedReference: unknown,
) {
  const next = current.filter(
    (order) =>
      !matchesOrderReference(order, deletedId) &&
      !matchesOrderReference(order, deletedReference),
  );
  return next.length === current.length ? current : next;
}

function patchOrder(
  current: WorkspaceOrder[],
  reference: unknown,
  patch: Record<string, unknown>,
) {
  let changed = false;
  const next = current.map((order) => {
    if (!matchesOrderReference(order, reference)) return order;
    changed = true;
    return { ...order, ...patch } as WorkspaceOrder;
  });
  return changed ? next : current;
}

function orderSearchValues(order: WorkspaceOrder) {
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

function withOperationalTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`${label}_timeout`)),
      OPERATIONAL_REQUEST_TIMEOUT_MS,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (cause) => {
        window.clearTimeout(timer);
        reject(cause);
      },
    );
  });
}

async function withOperationalRetry<T>(task: () => Promise<T>, label: string): Promise<T> {
  let latest: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await withOperationalTimeout(task(), label);
    } catch (cause) {
      latest = cause;
      if (attempt < 2) await wait(500 * (attempt + 1));
    }
  }
  throw new Error(`${label}: ${latest instanceof Error ? latest.message : String(latest || "unknown failure")}`);
}

export default function AdminSectionWorkspace(props: AdminSectionWorkspaceProps) {
  const showBulkConsole = ORDER_SECTIONS.has(props.id);
  const useProfessionalOrderRegister = PROFESSIONAL_ORDER_SECTIONS.has(props.id);
  // The new order register owns selection/search/export for its sections. Keep the
  // legacy bulk console only for the specialized International workspace so Admin
  // never renders two competing selection/export systems on the same page.
  const showLegacyBulkUi = showBulkConsole && !useProfessionalOrderRegister;
  const [merchantFilterId, setMerchantFilterId] = useState(() => clean(props.initialMerchantId));
  const [bulkQuery, setBulkQuery] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [orderPage, setOrderPage] = useState(0);
  const [localOrders, setLocalOrders] = useState<WorkspaceProps["orders"]>(() => props.orders);
  const [recoveredOrders, setRecoveredOrders] = useState<WorkspaceProps["orders"]>([]);
  const [recoveredMerchants, setRecoveredMerchants] = useState<WorkspaceProps["merchants"]>([]);
  const [authoritativeReady, setAuthoritativeReady] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(showBulkConsole);
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryNonce, setRecoveryNonce] = useState(0);

  useEffect(() => {
    setLocalOrders(props.orders);
  }, [props.orders]);

  // Parent data is already loaded through the protected admin data layer. Keep
  // it visible while an independent refresh runs, then atomically replace both
  // lists only after the same refresh succeeds. This prevents a slow finance or
  // auth request from hiding a valid merchant filter without ever mixing owners.
  const effectiveOrders = showBulkConsole && authoritativeReady ? recoveredOrders : localOrders;
  const effectiveMerchants = showBulkConsole && authoritativeReady ? recoveredMerchants : props.merchants;

  useEffect(() => {
    const applyToVisibleStores = (
      mutation: (current: WorkspaceOrder[]) => WorkspaceOrder[],
    ) => {
      setLocalOrders((current) => mutation(current));
      setRecoveredOrders((current) => mutation(current));
    };

    const handleOrdersUpdated = (event: Event) => {
      const detail = (event as CustomEvent<AdminOrderMutationDetail>).detail || {};
      if (detail.order && typeof detail.order === "object") {
        applyToVisibleStores((current) => upsertOrder(current, detail.order as WorkspaceOrder));
        return;
      }

      if (
        clean(detail.mutation).toLowerCase() === "delete" ||
        clean(detail.deletedId) ||
        clean(detail.deletedReference)
      ) {
        applyToVisibleStores((current) =>
          removeOrder(current, detail.deletedId, detail.deletedReference),
        );
      }
    };

    const handleStatusChange = (event: Event) => {
      const detail = (event as CustomEvent<AdminOrderMutationDetail>).detail || {};
      const orderReference = detail.orderId;
      const status = clean(detail.status);
      if (!clean(orderReference) || !status) return;
      applyToVisibleStores((current) =>
        patchOrder(current, orderReference, { status }),
      );
    };

    const handleAssignmentChange = (event: Event) => {
      const detail = (event as CustomEvent<AdminOrderMutationDetail>).detail || {};
      const orderReference = detail.orderId;
      const driverId = clean(detail.driverId);
      if (!clean(orderReference) || !driverId) return;
      applyToVisibleStores((current) =>
        patchOrder(current, orderReference, {
          driver_id: driverId,
          assigned_driver_id: driverId,
          driver_name: clean(detail.driverName),
          driver_code: clean(detail.driverCode),
        }),
      );
    };

    window.addEventListener("dn-admin-orders-updated", handleOrdersUpdated);
    window.addEventListener("dn-admin-order-status-change", handleStatusChange);
    window.addEventListener("dn-admin-order-assignment-change", handleAssignmentChange);
    return () => {
      window.removeEventListener("dn-admin-orders-updated", handleOrdersUpdated);
      window.removeEventListener("dn-admin-order-status-change", handleStatusChange);
      window.removeEventListener("dn-admin-order-assignment-change", handleAssignmentChange);
    };
  }, []);

  useEffect(() => {
    setMerchantFilterId(props.id === "all_orders" ? clean(props.initialMerchantId) : "");
    setBulkQuery("");
    setSelectedOrderIds([]);
    setOrderPage(0);
  }, [props.id, props.initialMerchantId]);

  useEffect(() => {
    if (!showBulkConsole) {
      setAuthoritativeReady(false);
      setRecoveryLoading(false);
      setRecoveryError("");
      return;
    }

    let active = true;
    setRecoveryLoading(true);
    setRecoveryError("");

    void Promise.allSettled([
      fetchAdminOrdersResilient(),
      withOperationalRetry(fetchMerchants, "merchants recovery failed"),
    ]).then(([ordersResult, merchantsResult]) => {
      if (!active) return;

      if (ordersResult.status === "fulfilled" && merchantsResult.status === "fulfilled") {
        setRecoveredOrders(Array.isArray(ordersResult.value) ? ordersResult.value : []);
        setRecoveredMerchants(Array.isArray(merchantsResult.value) ? merchantsResult.value : []);
        setAuthoritativeReady(true);
        setRecoveryError("");
      } else {
        setAuthoritativeReady(false);
        setRecoveryError(
          props.isArabic
            ? "تعذر تحديث الطلبات أو التجار بعد إعادة المحاولة. استمر عرض البيانات المحمية المحملة مسبقاً، ولم يتم عرض بيانات مختلطة."
            : "Orders or merchants could not be refreshed after retrying. Previously loaded protected data remains visible, and no mixed data was shown.",
        );
      }
      setRecoveryLoading(false);
    });

    return () => {
      active = false;
    };
  }, [props.id, props.isArabic, recoveryNonce, showBulkConsole]);

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

  const shouldPageWorkspace = showLegacyBulkUi && props.id !== "external";
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

  async function refreshCurrentWorkspace() {
    if (showBulkConsole) {
      setRecoveryNonce((value) => value + 1);
      return;
    }
    await props.onRefresh?.();
  }

  return (
    <section
      data-admin-order-data-source={authoritativeReady ? "refreshed" : "protected-parent"}
      data-admin-order-count={effectiveOrders.length}
      data-admin-merchant-count={effectiveMerchants.length}
      data-admin-actions-stay-in-place="true"
    >
      {recoveryLoading && showBulkConsole && (
        <p
          data-admin-order-operational-recovery="true"
          className="mb-4 rounded-xl border border-brand-sky/25 bg-brand-sky/10 px-4 py-3 text-xs font-black text-brand-sky"
          dir={props.isArabic ? "rtl" : "ltr"}
        >
          {props.isArabic
            ? "جاري تحديث الطلبات والتجار مباشرة من المصادر المحمية دون إخفاء البيانات الحالية..."
            : "Refreshing orders and merchants directly from protected sources without hiding current data..."}
        </p>
      )}

      {recoveryError && showBulkConsole && (
        <div
          role="alert"
          className="mb-4 flex flex-col gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-xs font-bold text-rose-200 sm:flex-row sm:items-center sm:justify-between"
          dir={props.isArabic ? "rtl" : "ltr"}
        >
          <span>{recoveryError}</span>
          <button
            type="button"
            onClick={() => setRecoveryNonce((value) => value + 1)}
            className="rounded-lg border border-rose-200/30 bg-rose-100/10 px-3 py-2 font-black text-rose-100"
          >
            {props.isArabic ? "إعادة المحاولة" : "Retry"}
          </button>
        </div>
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

      {showLegacyBulkUi && (
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
          onRefresh={refreshCurrentWorkspace}
          searchManaged
        />
      ) : (
        <AdminSectionWorkspaceComplete
          {...props}
          orders={renderedWorkspaceOrders}
          allOrders={visibleSectionOrders}
          merchants={effectiveMerchants}
          onRefresh={refreshCurrentWorkspace}
          searchManaged={showLegacyBulkUi}
        />
      )}
    </section>
  );
}
