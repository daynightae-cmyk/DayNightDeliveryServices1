from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "artifacts/day-night-delivery"
SRC = APP / "src"


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def write(rel: str, content: str) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def replace_required(source: str, old: str, new: str, label: str, count: int = 1) -> str:
    found = source.count(old)
    if found < count:
        raise SystemExit(f"{label}: expected at least {count}, found {found}")
    return source.replace(old, new, count)


def regex_required(source: str, pattern: str, replacement: str, label: str, count: int = 1) -> str:
    next_source, changed = re.subn(pattern, replacement, source, count=count, flags=re.MULTILINE | re.DOTALL)
    if changed < count:
        raise SystemExit(f"{label}: expected {count}, changed {changed}")
    return next_source


# ---------------------------------------------------------------------------
# Shared professional locale and diagnostic helpers.
# ---------------------------------------------------------------------------
write(
    "artifacts/day-night-delivery/src/lib/adminLocale.ts",
    '''export function adminNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatAdminMoney(
  value: unknown,
  isArabic: boolean,
  options: { absolute?: boolean; minimumFractionDigits?: number } = {},
) {
  const amount = options.absolute ? Math.abs(adminNumber(value)) : adminNumber(value);
  const digits = options.minimumFractionDigits ?? 2;
  const formatted = new Intl.NumberFormat("en-AE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: true,
  }).format(amount);
  return isArabic ? `${formatted} درهم` : `${formatted} AED`;
}

export function adminCurrencyLabel(isArabic: boolean) {
  return isArabic ? "درهم إماراتي" : "UAE dirham (AED)";
}
''',
)

write(
    "artifacts/day-night-delivery/src/lib/adminOrderActionFeedback.ts",
    '''type AdminOrderAction = "create" | "delete" | "status" | "save";

const clean = (value: unknown) => String(value ?? "").trim();

function detailFrom(error: unknown) {
  if (!error || typeof error !== "object") return clean(error);
  const record = error as Record<string, unknown>;
  return [record.code, record.message, record.details, record.hint]
    .map(clean)
    .filter(Boolean)
    .join(" | ");
}

function safeDiagnostic(value: string) {
  return clean(value)
    .replace(/bearer\s+[a-z0-9._~-]+/gi, "Bearer [hidden]")
    .replace(/eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/gi, "[token hidden]")
    .replace(/https?:\/\/[^\s|]+/gi, "[endpoint]")
    .replace(/\s+/g, " ")
    .slice(0, 520);
}

function feedbackCode(detail: string) {
  const databaseCode = detail.match(
    /\b(?:pgrst\d{3}|(?:22|23|25|28|40|42|53|55|57|58)[0-9a-z]{3})\b/i,
  )?.[0];
  const symbolicCode = detail.match(
    /\b(?:admin|order|merchant|financial|coupon|delivery|complete|status|delete)_[a-z0-9_]{3,}\b/i,
  )?.[0];
  return clean(databaseCode || symbolicCode || "ORDER_OPERATION_REJECTED").toUpperCase();
}

export function adminOrderActionFeedback(
  error: unknown,
  isArabic: boolean,
  action: AdminOrderAction,
) {
  const diagnostic = safeDiagnostic(detailFrom(error));
  const reason = diagnostic.toLowerCase();
  const code = feedbackCode(diagnostic);

  const actionAr = action === "create" ? "إنشاء الطلب" : action === "delete" ? "حذف الطلب" : action === "status" ? "تحديث حالة الطلب" : "حفظ الطلب";
  const actionEn = action === "create" ? "create the order" : action === "delete" ? "delete the order" : action === "status" ? "update the order status" : "save the order";

  let message = isArabic
    ? `تعذر ${actionAr}. لم يُحفظ أي تغيير جزئي.`
    : `Could not ${actionEn}. No partial change was stored.`;

  if (/jwt expired|invalid jwt|not_authenticated|refresh_token|session/.test(reason)) {
    message = isArabic
      ? "انتهت جلسة الإدارة. سجّل الدخول مجددًا ثم أعد العملية؛ لم يُحفظ أي تغيير جزئي."
      : "The admin session expired. Sign in again and retry; no partial change was stored.";
  } else if (/23505|duplicate key|unique constraint|coupon.*duplicate|duplicate.*coupon/.test(reason)) {
    message = isArabic
      ? "رقم الكوبون مستخدم بالفعل في طلب آخر. افتح الطلب الموجود أو أدخل رقمًا جديدًا."
      : "The coupon number is already used by another order. Open the existing order or enter a new number.";
  } else if (/23502|null value.*violates|not-null constraint|required/.test(reason)) {
    message = isArabic
      ? "يوجد حقل إلزامي ناقص. راجع الحقول المعلّمة بعلامة النجمة ثم أعد العملية."
      : "A required field is missing. Review the fields marked with an asterisk and retry.";
  } else if (/23503|foreign key|merchant.*not.*found|invalid_merchant|merchant_link/.test(reason)) {
    message = isArabic
      ? "التاجر أو السجل المرتبط بالطلب غير صالح أو لم يعد موجودًا. أعد اختيار السجل الصحيح."
      : "The merchant or related order record is invalid or no longer exists. Select the correct record.";
  } else if (/23514|check constraint|financial.*mismatch|invalid_delivery_fee|negative_financial/.test(reason)) {
    message = isArabic
      ? "إحدى القيم تخالف قاعدة تشغيل أو حساب معتمدة. راجع المبالغ وطريقة التحصيل وحالة الطلب."
      : "A value violates an approved business or financial rule. Review amounts, collection method, and status.";
  } else if (/financials_locked|posted financial|delivered settlements are locked/.test(reason)) {
    message = isArabic
      ? "الطلب مُسلّم أو مُرحّل ماليًا. عدّل البيانات العادية دون تغيير الحسابات، واستخدم التصحيح المالي المُدقّق للمبالغ."
      : "The order is delivered or financially posted. Edit ordinary details without changing accounting, and use the audited financial adjustment for amounts.";
  } else if (/permission denied|not_authorized|row-level security|rls/.test(reason)) {
    message = isArabic
      ? "الحساب الحالي لا يملك صلاحية تنفيذ هذه العملية. استخدم حساب مدير أو دعم معتمد."
      : "The current account is not authorized for this operation. Use an approved admin or support account.";
  } else if (/failed to fetch|network|timeout|connection|offline/.test(reason)) {
    message = isArabic
      ? "تعذر الوصول إلى قاعدة البيانات. تحقق من الاتصال ثم أعد المحاولة؛ لم يُحفظ أي تغيير جزئي."
      : "The database could not be reached. Check the connection and retry; no partial change was stored.";
  } else if (/40001|40p01|serialization|deadlock|concurrent/.test(reason)) {
    message = isArabic
      ? "تم تعديل الطلب من عملية أخرى في اللحظة نفسها. افتح أحدث نسخة من الطلب ثم أعد العملية."
      : "Another operation changed the order at the same time. Reopen the latest order version and retry.";
  } else if (/pgrst116|order_not_found|returned no rows|no rows/.test(reason)) {
    message = isArabic
      ? "لم يعد الطلب موجودًا بالمرجع الحالي أو لم يعد متاحًا لهذا الحساب. حدّث القائمة ثم افتحه من جديد."
      : "The order no longer exists under this reference or is no longer available to this account. Refresh and reopen it.";
  }

  return { code, diagnostic, message };
}
''',
)

# ---------------------------------------------------------------------------
# Global history-backed native autocomplete. It binds dynamically mounted admin
# inputs through MutationObserver and provides previous names/numbers immediately.
# ---------------------------------------------------------------------------
write(
    "artifacts/day-night-delivery/src/components/admin/AdminHistoryAutocomplete.tsx",
    '''import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { Merchant, Order } from "../../types";
import "../../styles/dn-admin-final-order-ux.css";

type Props = {
  isArabic: boolean;
  orders: Order[];
  merchants: Merchant[];
  children: ReactNode;
  scope?: string;
};

type CatalogKey =
  | "all"
  | "references"
  | "names"
  | "phones"
  | "locations"
  | "packages"
  | "amounts"
  | "notes";

const clean = (value: unknown) => String(value ?? "").trim();

function unique(values: unknown[], limit = 220) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const text = clean(value);
    const key = text.toLocaleLowerCase("en");
    if (!text || text.length > 180 || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

function descriptor(input: HTMLInputElement) {
  return [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute("aria-label"),
    input.getAttribute("data-admin-complete-order-coupon"),
    input.getAttribute("data-admin-next-order-focus"),
    input.getAttribute("data-admin-personal-coupon"),
    input.getAttribute("data-admin-order-search"),
  ]
    .map(clean)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function catalogFor(input: HTMLInputElement): CatalogKey {
  const text = descriptor(input);
  if (/search|بحث/.test(text)) return "all";
  if (/coupon|tracking|invoice|reference|كوبون|تتبع|فاتور|مرجع/.test(text)) return "references";
  if (/phone|mobile|tel|هاتف|تليفون|جوال/.test(text)) return "phones";
  if (/name|merchant|sender|receiver|customer|اسم|تاجر|مرسل|مستلم|عميل/.test(text)) return "names";
  if (/address|street|location|city|area|emirate|destination|عنوان|شارع|موقع|مدينة|منطقة|إمارة|وجهة/.test(text)) return "locations";
  if (/package|content|description|shipment|parcel|محتوى|وصف|شحنة|طرد/.test(text)) return "packages";
  if (/amount|price|fee|discount|cod|goods|value|قيمة|سعر|رسوم|خصم|مبلغ|تحصيل/.test(text)) return "amounts";
  if (/note|reason|ملاحظ|سبب/.test(text)) return "notes";
  return "all";
}

export default function AdminHistoryAutocomplete({
  isArabic,
  orders,
  merchants,
  children,
  scope = "admin",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const safeScope = scope.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();

  const catalogs = useMemo(() => {
    const references = unique(
      orders.flatMap((order) => [
        order.coupon_number,
        order.tracking_number,
        order.invoice_number,
        order.id,
      ]),
    );
    const names = unique([
      ...orders.flatMap((order) => [
        order.merchant_name,
        order.sender_name,
        order.receiver_name,
        order.customer_name,
        order.driver_name,
      ]),
      ...merchants.flatMap((merchant) => [
        merchant.owner_name,
        merchant.trade_name,
        merchant.merchant_code,
      ]),
    ]);
    const phones = unique([
      ...orders.flatMap((order) => [
        order.sender_phone,
        order.receiver_phone,
        order.customer_phone,
        order.driver_phone,
      ]),
      ...merchants.map((merchant) => merchant.phone),
    ]);
    const locations = unique(
      orders.flatMap((order) => [
        order.sender_city,
        order.receiver_city,
        order.destination_country,
        order.sender_address,
        order.receiver_address,
      ]),
    );
    const packages = unique(
      orders.flatMap((order) => [order.package_type, order.package_description]),
    );
    const amounts = unique(
      orders.flatMap((order) => [
        order.cod_amount,
        order.goods_value,
        order.delivery_price,
        order.delivery_fee,
        order.discount_amount,
        order.customer_total,
        order.merchant_due,
      ]),
    );
    const notes = unique(orders.flatMap((order) => [order.notes, order.status]));
    const all = unique(
      [...references, ...names, ...phones, ...locations, ...packages, ...amounts, ...notes],
      420,
    );
    return { all, references, names, phones, locations, packages, amounts, notes };
  }, [merchants, orders]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const bind = () => {
      const inputs = root.querySelectorAll<HTMLInputElement>(
        'input:not([type="hidden"]):not([type="password"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="date"]):not([type="datetime-local"])',
      );
      for (const input of inputs) {
        if (input.dataset.adminSmartAutocompleteBound === "true") continue;
        if (input.getAttribute("list")) continue;
        const key = catalogFor(input);
        input.setAttribute("list", `${safeScope}-${key}-history`);
        input.setAttribute("autocomplete", "off");
        input.dataset.adminSmartAutocompleteBound = "true";
        input.dataset.adminSmartAutocomplete = key;
        input.title ||= isArabic
          ? "ابدأ بكتابة حرف أو رقم لإظهار القيم المشابهة المسجلة سابقًا."
          : "Type a letter or number to show similar values entered previously.";
      }
    };

    bind();
    const observer = new MutationObserver(bind);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [catalogs, isArabic, safeScope]);

  return (
    <div
      ref={rootRef}
      className="dn-admin-history-autocomplete"
      data-admin-google-suggestions="true"
      data-admin-suggestion-count={catalogs.all.length}
    >
      {children}
      {(Object.entries(catalogs) as Array<[CatalogKey, string[]]>).map(([key, values]) => (
        <datalist id={`${safeScope}-${key}-history`} key={key}>
          {values.map((value) => (
            <option value={value} key={`${key}:${value}`} />
          ))}
        </datalist>
      ))}
    </div>
  );
}
''',
)

write(
    "artifacts/day-night-delivery/src/styles/dn-admin-final-order-ux.css",
    '''.dn-admin-history-autocomplete {
  min-width: 0;
}

.dn-admin-history-autocomplete input[data-admin-smart-autocomplete-bound="true"] {
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease,
    background-color 160ms ease;
}

.dn-admin-history-autocomplete input[data-admin-smart-autocomplete-bound="true"]:focus {
  border-color: rgba(212, 175, 55, 0.72) !important;
  box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.1), 0 14px 38px rgba(0, 0, 0, 0.16) !important;
  transform: translateY(-1px);
}

.dn-admin-history-autocomplete input[data-admin-smart-autocomplete-bound="true"]::placeholder {
  opacity: 0.72;
}

form[data-admin-new-order-form="merchant"],
.dn-personal-order-form {
  isolation: isolate;
  position: relative;
  overflow: hidden;
}

form[data-admin-new-order-form="merchant"]::before,
.dn-personal-order-form::before {
  content: "";
  position: absolute;
  inset: -30% auto auto -12%;
  width: 320px;
  height: 320px;
  border-radius: 999px;
  background: rgba(38, 161, 220, 0.08);
  filter: blur(60px);
  pointer-events: none;
  z-index: -1;
}

.dn-admin-bulk-console,
.dn-section-table-card,
.dn-admin-action-modal {
  scroll-margin-top: 18px;
}

.dn-order-status-control select:focus,
.dn-admin-bulk-filter-grid input:focus,
.dn-admin-bulk-filter-grid select:focus {
  outline: none;
  border-color: rgba(212, 175, 55, 0.68) !important;
  box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.1);
}

@media (max-width: 760px) {
  .dn-admin-action-modal {
    border-radius: 22px !important;
    max-height: 97dvh !important;
  }

  .dn-admin-bulk-filter-grid {
    grid-template-columns: minmax(0, 1fr) !important;
  }
}
''',
)

# ---------------------------------------------------------------------------
# Admin shell: global suggestions + correct Arabic currency + order history prop.
# ---------------------------------------------------------------------------
panel_path = "artifacts/day-night-delivery/src/components/AdminPanelLuxury.tsx"
panel = read(panel_path)
panel = replace_required(
    panel,
    'import { supabase } from "../supabase";\n',
    'import { supabase } from "../supabase";\nimport { formatAdminMoney } from "../lib/adminLocale";\nimport AdminHistoryAutocomplete from "./admin/AdminHistoryAutocomplete";\n',
    "panel imports",
)
panel = replace_required(
    panel,
    '''function money(value: number) {
  return `${Number(value || 0).toFixed(2)} AED`;
}
''',
    '''function money(value: number, isArabic: boolean) {
  return formatAdminMoney(value, isArabic);
}
''',
    "panel money formatter",
)
panel = panel.replace("cod: money(metrics.codTotal),", "cod: money(metrics.codTotal, isArabic),")
panel = panel.replace("income: money(metrics.income),", "income: money(metrics.income, isArabic),")
panel = panel.replace("value: money(metrics.codTotal),", "value: money(metrics.codTotal, isArabic),")
panel = panel.replace("value: money(metrics.income),", "value: money(metrics.income, isArabic),")
panel = panel.replace("money(Number(financeSummary.cod_pending || 0))", "money(Number(financeSummary.cod_pending || 0), false)")
panel = replace_required(
    panel,
    '''          <AdminNewOrder
            isArabic={isArabic}
            merchants={merchants}
''',
    '''          <AdminNewOrder
            isArabic={isArabic}
            merchants={merchants}
            orders={orders}
''',
    "new order history prop",
)
panel = replace_required(
    panel,
    '''  return (
    <div className="dn-admin-fullscreen" dir={isArabic ? "rtl" : "ltr"}>
''',
    '''  return (
    <AdminHistoryAutocomplete
      isArabic={isArabic}
      orders={orders}
      merchants={merchants}
      scope="admin-global"
    >
      <div className="dn-admin-fullscreen" dir={isArabic ? "rtl" : "ltr"}>
''',
    "admin global autocomplete wrapper open",
)
panel = replace_required(
    panel,
    '''      </div>
    </div>
  );
}
''',
    '''        </div>
      </div>
    </AdminHistoryAutocomplete>
  );
}
''',
    "admin global autocomplete wrapper close",
)
write(panel_path, panel)

# ---------------------------------------------------------------------------
# New-order props, professional errors and Arabic currency.
# ---------------------------------------------------------------------------
guard_path = "artifacts/day-night-delivery/src/components/admin/AdminNewOrderCouponGuard.tsx"
guard = read(guard_path)
guard = replace_required(
    guard,
    '''  merchants: Merchant[];
  onSaved?: (order: Order) => void;
''',
    '''  merchants: Merchant[];
  orders: Order[];
  onSaved?: (order: Order) => void;
''',
    "coupon guard orders prop",
)
write(guard_path, guard)

new_order_path = "artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx"
new_order = read(new_order_path)
new_order = replace_required(
    new_order,
    'import { calculateOpsOrderPrice, opsErrorDetail, type OpsDataSource } from "../../lib/adminOperationsData";\n',
    'import { calculateOpsOrderPrice, type OpsDataSource } from "../../lib/adminOperationsData";\nimport { formatAdminMoney } from "../../lib/adminLocale";\nimport { adminOrderActionFeedback } from "../../lib/adminOrderActionFeedback";\n',
    "new order imports",
)
new_order = replace_required(
    new_order,
    '''function FinancialMetric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
''',
    '''function FinancialMetric({ label, value, isArabic, accent = false }: { label: string; value: number; isArabic: boolean; accent?: boolean }) {
''',
    "new order metric props",
)
new_order = replace_required(
    new_order,
    '''        {value.toFixed(2)} AED
''',
    '''        {formatAdminMoney(value, isArabic)}
''',
    "new order metric currency",
)
new_order = re.sub(r"<FinancialMetric(?!\s+isArabic=)", "<FinancialMetric isArabic={isArabic}", new_order)
new_order = new_order.replace(
    "{activeDeliveryFee.toFixed(2)} AED",
    "{formatAdminMoney(activeDeliveryFee, isArabic)}",
)
new_order = replace_required(
    new_order,
    '''  merchants: Merchant[];
  onSaved?: (order: Order) => void;
''',
    '''  merchants: Merchant[];
  orders?: Order[];
  onSaved?: (order: Order) => void;
''',
    "new order complete orders prop",
)
new_order = replace_required(
    new_order,
    '''    } catch (cause) {
      const detail = opsErrorDetail(cause);
      setSource("none");
      setError(
        isArabic
          ? `تعذر حفظ الطلب المالي الحقيقي.${detail ? ` السبب: ${detail}` : ""}`
          : `The real financial order could not be saved.${detail ? ` Reason: ${detail}` : ""}`,
      );
    } finally {
''',
    '''    } catch (cause) {
      const feedback = adminOrderActionFeedback(cause, isArabic, "create");
      setSource("none");
      setError(`${feedback.message} ${isArabic ? "رمز العملية" : "Operation code"}: ${feedback.code}`);
      console.error("DAY NIGHT order creation rejected:", feedback.diagnostic || cause);
    } finally {
''',
    "new order professional error",
)
write(new_order_path, new_order)

personal_path = "artifacts/day-night-delivery/src/components/admin/AdminPersonalOrderForm.tsx"
personal = read(personal_path)
personal = replace_required(
    personal,
    'import { opsErrorDetail } from "../../lib/adminOperationsData";\n',
    'import { formatAdminMoney } from "../../lib/adminLocale";\nimport { adminOrderActionFeedback } from "../../lib/adminOrderActionFeedback";\n',
    "personal form imports",
)
personal = replace_required(
    personal,
    '''    } catch (cause) {
      const detail = opsErrorDetail(cause);
      setError(
        isArabic
          ? `تعذر إنشاء الطلب الشخصي الحقيقي.${detail ? ` السبب: ${detail}` : ""}`
          : `The personal order could not be created.${detail ? ` Reason: ${detail}` : ""}`,
      );
    } finally {
''',
    '''    } catch (cause) {
      const feedback = adminOrderActionFeedback(cause, isArabic, "create");
      setError(`${feedback.message} ${isArabic ? "رمز العملية" : "Operation code"}: ${feedback.code}`);
      console.error("DAY NIGHT personal order creation rejected:", feedback.diagnostic || cause);
    } finally {
''',
    "personal professional error",
)
personal = replace_required(
    personal,
    '''          <strong className="text-2xl font-black text-brand-gold" dir="ltr">
            25.00 AED
          </strong>
''',
    '''          <strong
            className="text-2xl font-black text-brand-gold"
            dir={isArabic ? "rtl" : "ltr"}
          >
            {formatAdminMoney(PERSONAL_ORDER_DELIVERY_FEE, isArabic)}
          </strong>
''',
    "personal fixed currency",
)
write(personal_path, personal)

# ---------------------------------------------------------------------------
# Edit modal currency: the save diagnostics were already hardened in PR #340.
# ---------------------------------------------------------------------------
edit_path = "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx"
edit = read(edit_path)
edit = replace_required(
    edit,
    'import { opsErrorDetail } from "../../lib/adminOperationsData";\n',
    'import { opsErrorDetail } from "../../lib/adminOperationsData";\nimport { formatAdminMoney } from "../../lib/adminLocale";\n',
    "edit locale import",
)
edit = replace_required(
    edit,
    '''function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
''',
    '''function Metric({
  label,
  value,
  isArabic,
  accent = false,
}: {
  label: string;
  value: number;
  isArabic: boolean;
  accent?: boolean;
}) {
''',
    "edit metric props",
)
edit = replace_required(
    edit,
    '''        {Math.abs(value).toFixed(2)} AED
''',
    '''        {formatAdminMoney(value, isArabic, { absolute: true })}
''',
    "edit metric currency",
)
edit = re.sub(r"<Metric(?!\s+isArabic=)", "<Metric isArabic={isArabic}", edit)
edit = edit.replace(
    "{activeDeliveryFee.toFixed(2)} AED",
    "{formatAdminMoney(activeDeliveryFee, isArabic)}",
)
write(edit_path, edit)

# ---------------------------------------------------------------------------
# Delete diagnostics become precise without exposing secrets.
# ---------------------------------------------------------------------------
delete_path = "artifacts/day-night-delivery/src/components/admin/AdminOrderDeleteModal.tsx"
delete_modal = read(delete_path)
delete_modal = replace_required(
    delete_modal,
    'import { deleteAdminOrderImmediately } from "../../lib/adminOrderDeleteData";\n',
    'import { deleteAdminOrderImmediately } from "../../lib/adminOrderDeleteData";\nimport { adminOrderActionFeedback } from "../../lib/adminOrderActionFeedback";\n',
    "delete feedback import",
)
delete_modal = replace_required(
    delete_modal,
    '''      } catch (cause) {
        console.error("DAY NIGHT order deletion failed", cause);
        setBusy(false);
        setError(
          isArabic
            ? "تعذر الحذف الآن. اضغط إعادة المحاولة."
            : "Deletion could not be completed. Press retry.",
        );
      }
''',
    '''      } catch (cause) {
        const feedback = adminOrderActionFeedback(cause, isArabic, "delete");
        console.error("DAY NIGHT order deletion failed", feedback.diagnostic || cause);
        setBusy(false);
        setError(`${feedback.message} ${isArabic ? "رمز العملية" : "Operation code"}: ${feedback.code}`);
      }
''',
    "delete professional feedback",
)
write(delete_path, delete_modal)

# ---------------------------------------------------------------------------
# Bulk export/print currency uses Arabic "درهم" instead of exposing AED in RTL.
# ---------------------------------------------------------------------------
bulk_path = "artifacts/day-night-delivery/src/components/admin/AdminOrderBulkOperations.tsx"
bulk = read(bulk_path)
bulk = replace_required(
    bulk,
    'import { normalizeOrderStatus } from "../../lib/adminOrderLogic";\n',
    'import { normalizeOrderStatus } from "../../lib/adminOrderLogic";\nimport { formatAdminMoney } from "../../lib/adminLocale";\n',
    "bulk locale import",
)
bulk = bulk.replace(
    '`${orders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0).toFixed(2)} AED`',
    'formatAdminMoney(orders.reduce((sum, order) => sum + Number(order.cod_amount || 0), 0), isArabic)',
)
bulk = bulk.replace(
    '`${orders.reduce((sum, order) => sum + Number(order.delivery_price || order.delivery_fee || 0), 0).toFixed(2)} AED`',
    'formatAdminMoney(orders.reduce((sum, order) => sum + Number(order.delivery_price || order.delivery_fee || 0), 0), isArabic)',
)
bulk = bulk.replace(
    'cod: `${Number(order.cod_amount || 0).toFixed(2)} AED`,',
    'cod: formatAdminMoney(order.cod_amount, isArabic),',
)
bulk = bulk.replace(
    '${Number(order.cod_amount || 0).toFixed(2)} AED</td>',
    '${escapeHtml(formatAdminMoney(order.cod_amount, isArabic))}</td>',
)
write(bulk_path, bulk)

# ---------------------------------------------------------------------------
# Dashboard PDF/KPI currency and a static final order lifecycle gate.
# ---------------------------------------------------------------------------
write(
    "artifacts/day-night-delivery/scripts/admin-order-lifecycle-final-gate.mjs",
    '''import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.resolve(root, relative), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(`admin_order_lifecycle_final_gate_failed: ${message}`);
};

const panel = read("src/components/AdminPanelLuxury.tsx");
const newOrder = read("src/components/admin/AdminNewOrderComplete.tsx");
const couponGuard = read("src/components/admin/AdminNewOrderCouponGuard.tsx");
const personal = read("src/components/admin/AdminPersonalOrderForm.tsx");
const edit = read("src/components/admin/AdminOrderEditModalComplete.tsx");
const persistence = read("src/lib/adminOrderEditPersistence.ts");
const deleteModal = read("src/components/admin/AdminOrderDeleteModal.tsx");
const deleteData = read("src/lib/adminOrderDeleteData.ts");
const workspace = read("src/components/admin/AdminSectionWorkspaceCompleteLegacy.tsx");
const bulk = read("src/components/admin/AdminOrderBulkOperations.tsx");
const autocomplete = read("src/components/admin/AdminHistoryAutocomplete.tsx");
const locale = read("src/lib/adminLocale.ts");
const feedback = read("src/lib/adminOrderActionFeedback.ts");

assert(newOrder.includes("createFinancialOpsOrder"), "merchant order creation path missing");
assert(personal.includes("createPersonalOpsOrder"), "personal order creation path missing");
assert(couponGuard.includes("findCouponConflict"), "coupon uniqueness preflight missing");
assert(persistence.includes("admin_update_order_complete_verified_v2"), "verified complete edit RPC missing");
assert(persistence.includes("saveAdminLockedMerchantCoreEdit"), "delivered core-data edit path missing");
assert(edit.includes("saveAdminLockedMerchantCoreEdit") && edit.includes("saveAdminOrderEdit"), "editor does not route ordinary and audited edits separately");
assert(deleteData.includes("deleteAdminOrderImmediately"), "admin delete implementation missing");
assert(deleteModal.includes('mutation: "delete"') && deleteModal.includes("dn-admin-orders-updated"), "deleted rows are not removed locally");
assert(workspace.includes("updateExistingOrderStatus") && workspace.includes("تسليم وترحيل"), "status and delivered posting path missing");
assert(workspace.includes("financial_posted_at"), "posted settlement visibility missing");

assert(panel.includes("AdminHistoryAutocomplete") && panel.includes('scope="admin-global"'), "global history autocomplete is not mounted");
assert(autocomplete.includes("MutationObserver") && autocomplete.includes("data-admin-smart-autocomplete-bound"), "dynamic first-character suggestions are incomplete");
assert(autocomplete.includes("coupon") && autocomplete.includes("phone") && autocomplete.includes("merchant") && autocomplete.includes("amount"), "suggestion catalogs do not cover names, numbers and amounts");

assert(locale.includes('isArabic ? `${formatted} درهم` : `${formatted} AED`'), "professional Arabic currency formatter missing");
assert(newOrder.includes("formatAdminMoney") && edit.includes("formatAdminMoney") && personal.includes("formatAdminMoney") && bulk.includes("formatAdminMoney"), "order surfaces do not share the currency formatter");
assert(!personal.includes("25.00 AED"), "personal Arabic price still exposes AED literally");
assert(!newOrder.includes("{value.toFixed(2)} AED"), "new-order metric still exposes AED literally");
assert(!edit.includes("{Math.abs(value).toFixed(2)} AED"), "edit metric still exposes AED literally");

assert(feedback.includes("adminOrderActionFeedback"), "professional action feedback helper missing");
assert(newOrder.includes('adminOrderActionFeedback(cause, isArabic, "create")'), "new-order errors are not classified");
assert(personal.includes('adminOrderActionFeedback(cause, isArabic, "create")'), "personal-order errors are not classified");
assert(deleteModal.includes('adminOrderActionFeedback(cause, isArabic, "delete")'), "delete errors are not classified");

console.log(JSON.stringify({
  result: "PASS",
  creation: true,
  couponIntegrity: true,
  editPersistence: true,
  deliveredCoreEdit: true,
  deletion: true,
  statusPosting: true,
  firstCharacterSuggestions: true,
  professionalArabicCurrency: true,
  professionalActionErrors: true,
}, null, 2));
''',
)

package_path = "artifacts/day-night-delivery/package.json"
package = read(package_path)
package = replace_required(
    package,
    '    "admin-order-save-localization:gate": "node scripts/admin-order-save-localization-gate.mjs"\n',
    '    "admin-order-save-localization:gate": "node scripts/admin-order-save-localization-gate.mjs",\n    "admin-order-lifecycle:gate": "node scripts/admin-order-lifecycle-final-gate.mjs"\n',
    "package lifecycle script",
)
write(package_path, package)

# Final source-level safety checks before CI.
for rel in [panel_path, new_order_path, personal_path, edit_path, delete_path, bulk_path]:
    text = read(rel)
    if "ايد" in text:
        raise SystemExit(f"literal Arabic AED transliteration remains in {rel}")

print("PASS: final admin order lifecycle, autocomplete, currency and feedback changes applied")
