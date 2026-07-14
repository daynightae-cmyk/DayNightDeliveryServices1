import type { Order } from "../types";
import type { AdminSectionId } from "../components/admin/AdminSectionRegistry";

export type CanonicalOrderStatus =
  | "pending"
  | "review"
  | "confirmed"
  | "assigned"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "postponed"
  | "returned"
  | "cancelled"
  | "out_of_zone"
  | "international";

export type AdminOrderBucket =
  | "all_orders"
  | "cancelled"
  | "review"
  | "postponed"
  | "returned"
  | "pickup"
  | "abu_dhabi"
  | "external"
  | "out_scope";

export type AdminSectionStats = Record<AdminOrderBucket, number>;

type OrderLike = Order & Record<string, unknown>;

const UAE_COUNTRY_RE =
  /^(|uae|u\.a\.e|united arab emirates|emirates|الإمارات|الامارات|دولة الإمارات|دولة الامارات)$/i;
const INTERNATIONAL_RE =
  /international|external|gcc|world|worldwide|global|saudi|ksa|kuwait|qatar|bahrain|oman|usa|uk|europe|canada|australia|دولي|خارجي|خليجي|عالمي|السعودية|الكويت|قطر|البحرين|عمان/;
const ABU_DHABI_RE =
  /abu\s*dhabi|mussafah|khalifa|mbz|mohammed\s*bin\s*zayed|baniyas|shahama|al\s*ain|أبوظبي|ابوظبي|العين|مصفح|خليفة|محمد بن زايد|بني ياس|الشهامة/;
const OTHER_EMIRATES_RE =
  /dubai|sharjah|ajman|umm\s*al\s*quwain|ras\s*al\s*khaimah|fujairah|khor\s*fakkan|دبي|الشارقة|عجمان|أم القيوين|ام القيوين|رأس الخيمة|راس الخيمة|الفجيرة|خورفكان/;

export function cleanAdminText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[ـ]/g, "")
    .trim();
}

export function normalizeAdminKey(value: unknown) {
  return cleanAdminText(value).replace(/[\s-]+/g, "_");
}

function field(order: OrderLike, key: string) {
  return String(order[key] ?? "").trim();
}

export function normalizeOrderStatus(
  orderOrStatus: Order | string | null | undefined,
): CanonicalOrderStatus {
  const value =
    typeof orderOrStatus === "object" && orderOrStatus
      ? (orderOrStatus as Order).status
      : orderOrStatus;
  const key = normalizeAdminKey(value);
  const raw = cleanAdminText(value);
  const text = `${key} ${raw}`;

  if (!key) return "pending";
  if (/^international$|^gcc$|^worldwide$|^global$|دولي|خليجي|عالمي/.test(text))
    return "international";
  if (/out_of_zone|out_of_scope|unsupported|خارج_النطاق/.test(text))
    return "out_of_zone";
  if (
    /order_cancelled|cancelled|canceled|cancel|failed|fail|ملغي|ملغية|الغاء|إلغاء|كنسل|مكنسل|مرفوض|رفض/.test(
      text,
    )
  )
    return "cancelled";
  if (
    /return_to_merchant|returned|return|راجع|راجعة|مرتجع|مرتجعة|ارجاع|إرجاع|استرجاع/.test(
      text,
    )
  )
    return "returned";
  if (
    /postponed|postpone|deferred|defer|scheduled|schedule|later|مؤجل|مؤجلة|تأجيل|تاجيل/.test(
      text,
    )
  )
    return "postponed";
  if (
    /under_review|needs_review|manual_review|manual_approval|review|hold|مراجعة|قيد_المراجعة|تحت_المراجعة|تحتاج_قرار/.test(
      text,
    )
  )
    return "review";
  if (
    /order_delivered|delivered|complete|completed|تم_التسليم|مسلم|تسليم/.test(
      text,
    )
  )
    return "delivered";
  if (
    /in_transit|out_for_delivery|transit|on_route|on_the_way|في_الطريق|جاري_التوصيل|بالطريق/.test(
      text,
    )
  )
    return "in_transit";
  if (
    /picked_up|pickup|collecting|collected|collect|تم_الإحضار|تم_الاحضار|قيد_الإحضار|قيد_الاحضار|إحضار|احضار/.test(
      text,
    )
  )
    return "picked_up";
  if (
    /driver_assigned|assigned|assign|تم_تعيين|تعيين_مندوب|مندوب|معين/.test(text)
  )
    return "assigned";
  if (
    /confirmed|accepted|approved|تم_التأكيد|تم_التاكيد|مؤكد|اعتماد|معتمد/.test(
      text,
    )
  )
    return "confirmed";
  if (
    /order_pending|pending|new|waiting|قيد_الانتظار|انتظار|جديد|طلب_جديد/.test(
      text,
    )
  )
    return "pending";
  return "pending";
}

function locationText(order: OrderLike) {
  return [
    field(order, "shipping_scope"),
    field(order, "order_type"),
    field(order, "service_type"),
    field(order, "destination_country"),
    field(order, "sender_city"),
    field(order, "receiver_city"),
    field(order, "pickup_city"),
    field(order, "delivery_city"),
    field(order, "sender_emirate"),
    field(order, "receiver_emirate"),
    field(order, "pickup_emirate"),
    field(order, "delivery_emirate"),
    field(order, "route"),
    field(order, "zone"),
  ].join(" ");
}

export function isInternationalAdminOrder(order: Order) {
  const o = order as OrderLike;
  const scope = normalizeAdminKey(
    o.shipping_scope || o.order_type || o.service_type,
  );
  const country = cleanAdminText(o.destination_country);
  if (["international", "gcc", "worldwide", "global"].includes(scope))
    return true;
  if (country && !UAE_COUNTRY_RE.test(country)) return true;
  return INTERNATIONAL_RE.test(cleanAdminText(locationText(o)));
}

export function isAbuDhabiAdminOrder(order: Order) {
  return (
    !isInternationalAdminOrder(order) &&
    ABU_DHABI_RE.test(cleanAdminText(locationText(order as OrderLike)))
  );
}

export function isOtherEmiratesAdminOrder(order: Order) {
  const text = cleanAdminText(locationText(order as OrderLike));
  return (
    !isInternationalAdminOrder(order) &&
    !isAbuDhabiAdminOrder(order) &&
    OTHER_EMIRATES_RE.test(text)
  );
}

export function matchesAdminSection(
  order: Order,
  sectionId: AdminSectionId | AdminOrderBucket,
) {
  if (["all_orders", "reports", "print"].includes(sectionId)) return true;
  const status = normalizeOrderStatus(order);
  if (sectionId === "cancelled") return status === "cancelled";
  if (sectionId === "review") return status === "review";
  if (sectionId === "postponed") return status === "postponed";
  if (sectionId === "returned") return status === "returned";
  if (sectionId === "pickup")
    return status === "assigned" || status === "picked_up";
  if (sectionId === "abu_dhabi") return isAbuDhabiAdminOrder(order);
  if (sectionId === "external") return isInternationalAdminOrder(order);
  if (sectionId === "out_scope") return isOtherEmiratesAdminOrder(order);
  return true;
}

export function buildAdminSectionStats(orders: Order[]): AdminSectionStats {
  return {
    all_orders: orders.length,
    cancelled: orders.filter((order) => matchesAdminSection(order, "cancelled"))
      .length,
    review: orders.filter((order) => matchesAdminSection(order, "review"))
      .length,
    postponed: orders.filter((order) => matchesAdminSection(order, "postponed"))
      .length,
    returned: orders.filter((order) => matchesAdminSection(order, "returned"))
      .length,
    pickup: orders.filter((order) => matchesAdminSection(order, "pickup"))
      .length,
    abu_dhabi: orders.filter((order) => matchesAdminSection(order, "abu_dhabi"))
      .length,
    external: orders.filter((order) => matchesAdminSection(order, "external"))
      .length,
    out_scope: orders.filter((order) => matchesAdminSection(order, "out_scope"))
      .length,
  };
}
