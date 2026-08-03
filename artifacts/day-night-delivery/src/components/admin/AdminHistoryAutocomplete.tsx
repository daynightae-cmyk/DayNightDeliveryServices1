import { useEffect, useMemo, useRef, type ReactNode } from "react";
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
        input.setAttribute("data-admin-smart-autocomplete-bound", "true");
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
