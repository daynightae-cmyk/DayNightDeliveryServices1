import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import { matchesAdminSection, normalizeOrderStatus } from "../../lib/adminOrderLogic";
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
  onClearMerchantScope?: () => void;
};

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

export default function AdminSectionWorkspace(props: AdminSectionWorkspaceProps) {
  const [merchantFilterId, setMerchantFilterId] = useState(() => clean(props.initialMerchantId));
  const [bulkQuery, setBulkQuery] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [orderPage, setOrderPage] = useState(0);

  useEffect(() => {
    setMerchantFilterId(props.id === "all_orders" ? clean(props.initialMerchantId) : "");
    setBulkQuery("");
    setSelectedOrderIds([]);
    setOrderPage(0);
  }, [props.id, props.initialMerchantId]);

  const scopedMerchant = useMemo(
    () => props.merchants.find((merchant) => clean(merchant.id) === merchantFilterId) || null,
    [merchantFilterId, props.merchants],
  );

  const filteredOrders = useMemo(() => {
    const query = normalize(bulkQuery);
    if (merchantFilterId && !scopedMerchant) return [];
    return props.orders.filter((order) => {
      if (merchantFilterId && clean(order.merchant_id) !== merchantFilterId) return false;
      if (query && !orderSearchText(order).includes(query)) return false;
      return true;
    });
  }, [bulkQuery, merchantFilterId, props.orders, scopedMerchant]);

  const visibleSectionOrders = useMemo(
    () => filteredOrders.filter((order) => matchesAdminSection(order, props.id)),
    [filteredOrders, props.id],
  );

  const showBulkConsole = ORDER_SECTIONS.has(props.id);
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

  const selectedOrders = useMemo(() => {
    if (!selectedOrderIds.length) return [];
    const selected = new Set(selectedOrderIds);
    return visibleSectionOrders.filter((order) => selected.has(orderId(order)));
  }, [selectedOrderIds, visibleSectionOrders]);

  const workspaceOrders = filteredOrders;
  const renderedWorkspaceOrders = shouldPageWorkspace ? pagedSectionOrders : workspaceOrders;

  return (
    <>
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
              props.onClearMerchantScope?.();
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
            merchants={props.merchants}
            merchantId={merchantFilterId}
            query={bulkQuery}
            selectedIds={selectedOrderIds}
            onMerchantChange={(merchantId) => {
              setMerchantFilterId(merchantId);
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
          merchants={props.merchants}
          onRefresh={props.onRefresh}
        />
      ) : (
        <AdminSectionWorkspaceComplete {...props} orders={renderedWorkspaceOrders} />
      )}
    </>
  );
}
