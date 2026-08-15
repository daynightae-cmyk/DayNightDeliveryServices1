import type { FinanceSummary, FinanceSummarySource } from "./adminData";
import { isInternationalAdminOrder, normalizeOrderStatus } from "./adminOrderLogic";
import type { Merchant, Order } from "../types";

export type NexusSeverity = "critical" | "warning" | "watch";
export type NexusActionTarget =
  | "all_orders"
  | "review"
  | "postponed"
  | "returned"
  | "finance_dashboard"
  | "live_drivers"
  | "external";

export type NexusRiskKind =
  | "unassigned"
  | "stale"
  | "financial_unposted"
  | "review"
  | "postponed"
  | "returned"
  | "cod_pending"
  | "driver_visibility";

export type NexusRiskSignal = {
  id: string;
  kind: NexusRiskKind;
  severity: NexusSeverity;
  orderId?: string;
  reference?: string;
  amount?: number;
  ageHours?: number;
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
  target: NexusActionTarget;
};

export type NexusAction = {
  id: string;
  kind: NexusRiskKind;
  severity: NexusSeverity;
  count: number;
  amount?: number;
  refs: string[];
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
  actionAr: string;
  actionEn: string;
  target: NexusActionTarget;
};

export type NexusMetrics = {
  totalOrders: number;
  ordersToday: number;
  deliveredToday: number;
  activeOrders: number;
  unassignedActive: number;
  staleActive: number;
  activeDrivers: number;
  liveDrivers: number;
  internationalActive: number;
  deliveredUnposted: number;
  activeMerchants: number;
  codPending: number;
  codCollected: number;
  merchantPayable: number;
  totalIncome: number;
  totalExpenses: number;
  netEstimate: number;
};

export type NexusSnapshot = {
  generatedAt: string;
  financeSource: FinanceSummarySource;
  metrics: NexusMetrics;
  signals: NexusRiskSignal[];
  actions: NexusAction[];
  criticalOrders: number;
  warningOrders: number;
  watchOrders: number;
  criticalSignals: number;
  warningSignals: number;
  watchSignals: number;
};

type OrderLike = Order & {
  driver_id?: string | null;
  assigned_driver_id?: string | null;
  collected_amount?: number | string | null;
};

const severityRank: Record<NexusSeverity, number> = {
  watch: 1,
  warning: 2,
  critical: 3,
};

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function orderReference(order: OrderLike) {
  return (
    text(order.tracking_number) ||
    text(order.tracking_code) ||
    text(order.invoice_number) ||
    text(order.coupon_number) ||
    text(order.id) ||
    "—"
  );
}

function validDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestOperationalDate(order: OrderLike) {
  const candidates = [
    validDate(order.updated_at),
    validDate(order.live_location_updated_at),
    validDate(order.driver_location_updated_at),
    ...(Array.isArray(order.status_history)
      ? order.status_history.map((item) =>
          validDate(item.updated_at || item.created_at || item.timestamp || item.date),
        )
      : []),
    validDate(order.created_at),
  ].filter(Boolean) as Date[];

  if (!candidates.length) return null;
  return candidates.reduce((latest, current) =>
    current.getTime() > latest.getTime() ? current : latest,
  );
}

function hoursSince(value: Date | null, now: Date) {
  if (!value) return 0;
  return Math.max(0, (now.getTime() - value.getTime()) / 3_600_000);
}

function dubaiDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function isSameDubaiDay(value: unknown, now: Date) {
  const date = validDate(value);
  return Boolean(date && dubaiDateKey(date) === dubaiDateKey(now));
}

function isTerminal(order: OrderLike) {
  const status = normalizeOrderStatus(order);
  return ["delivered", "cancelled", "returned"].includes(status);
}

function hasAssignedDriver(order: OrderLike) {
  return Boolean(
    text(order.driver_id) ||
      text(order.assigned_driver_id) ||
      text(order.driver_code) ||
      text(order.driver_name) ||
      text(order.driver_phone),
  );
}

function driverKey(order: OrderLike) {
  return (
    text(order.driver_id) ||
    text(order.assigned_driver_id) ||
    text(order.driver_code) ||
    text(order.driver_phone) ||
    text(order.driver_name)
  );
}

function hasCoordinate(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) > 0.00001;
}

function hasFreshDriverLocation(order: OrderLike, now: Date) {
  const hasLat =
    hasCoordinate(order.live_lat) ||
    hasCoordinate(order.driver_lat) ||
    hasCoordinate(order.current_lat);
  const hasLng =
    hasCoordinate(order.live_lng) ||
    hasCoordinate(order.driver_lng) ||
    hasCoordinate(order.current_lng);
  if (!hasLat || !hasLng) return false;
  const updated =
    validDate(order.live_location_updated_at) ||
    validDate(order.driver_location_updated_at) ||
    validDate(order.updated_at);
  if (!updated) return false;
  return hoursSince(updated, now) <= 0.5;
}

function signal(
  kind: NexusRiskKind,
  severity: NexusSeverity,
  order: OrderLike | null,
  target: NexusActionTarget,
  copy: {
    titleAr: string;
    titleEn: string;
    detailAr: string;
    detailEn: string;
    amount?: number;
    ageHours?: number;
  },
): NexusRiskSignal {
  const reference = order ? orderReference(order) : undefined;
  return {
    id: `${kind}:${order?.id || "global"}:${reference || "signal"}`,
    kind,
    severity,
    orderId: order?.id,
    reference,
    amount: copy.amount,
    ageHours: copy.ageHours,
    titleAr: copy.titleAr,
    titleEn: copy.titleEn,
    detailAr: copy.detailAr,
    detailEn: copy.detailEn,
    target,
  };
}

function buildOrderSignals(order: OrderLike, now: Date): NexusRiskSignal[] {
  const status = normalizeOrderStatus(order);
  const terminal = isTerminal(order);
  const updatedAt = latestOperationalDate(order);
  const age = hoursSince(updatedAt, now);
  const createdAge = hoursSince(validDate(order.created_at), now);
  const ref = orderReference(order);
  const result: NexusRiskSignal[] = [];

  if (!terminal && !hasAssignedDriver(order)) {
    const severity: NexusSeverity = createdAge >= 2 ? "critical" : "warning";
    result.push(
      signal("unassigned", severity, order, "all_orders", {
        titleAr: "طلب نشط بدون مندوب",
        titleEn: "Active order without a driver",
        detailAr:
          createdAge >= 2
            ? `${ref} بدون مندوب منذ ${Math.floor(createdAge)} ساعة.`
            : `${ref} ما زال يحتاج تعيين مندوب.`,
        detailEn:
          createdAge >= 2
            ? `${ref} has been unassigned for ${Math.floor(createdAge)}h.`
            : `${ref} still needs a driver assignment.`,
        ageHours: createdAge,
      }),
    );
  }

  if (!terminal && age >= 8) {
    const severity: NexusSeverity = age >= 24 ? "critical" : "warning";
    result.push(
      signal("stale", severity, order, "all_orders", {
        titleAr: "طلب نشط بدون تحديث حديث",
        titleEn: "Active order has gone stale",
        detailAr: `${ref} لم يسجل تحديثًا تشغيليًا منذ ${Math.floor(age)} ساعة.`,
        detailEn: `${ref} has had no operational update for ${Math.floor(age)}h.`,
        ageHours: age,
      }),
    );
  }

  if (status === "delivered" && !order.financial_posted_at) {
    const deliveredAge = age;
    result.push(
      signal(
        "financial_unposted",
        deliveredAge >= 2 ? "critical" : "warning",
        order,
        "finance_dashboard",
        {
          titleAr: "مسلّم غير مُرحّل ماليًا",
          titleEn: "Delivered but not financially posted",
          detailAr: `${ref} حالته مسلّم ولا يوجد financial_posted_at حتى الآن.`,
          detailEn: `${ref} is delivered but still has no financial_posted_at.`,
          ageHours: deliveredAge,
        },
      ),
    );
  }

  if (status === "review") {
    result.push(
      signal("review", "warning", order, "review", {
        titleAr: "طلب يحتاج قرار مراجعة",
        titleEn: "Order needs review decision",
        detailAr: `${ref} موجود في قائمة المراجعة ويحتاج تدخلًا بشريًا.`,
        detailEn: `${ref} is in the review queue and needs human attention.`,
      }),
    );
  }

  if (status === "postponed") {
    result.push(
      signal("postponed", "warning", order, "postponed", {
        titleAr: "طلب مؤجل يحتاج متابعة",
        titleEn: "Postponed order needs follow-up",
        detailAr: `${ref} مؤجل ويجب التأكد من موعد المتابعة التالي.`,
        detailEn: `${ref} is postponed and needs a confirmed next follow-up.`,
      }),
    );
  }

  if (status === "returned") {
    result.push(
      signal("returned", "watch", order, "returned", {
        titleAr: "طلب راجع",
        titleEn: "Returned order",
        detailAr: `${ref} راجع ويحتاج إغلاق مسار المعالجة أو التسوية.`,
        detailEn: `${ref} is returned and needs operational/financial closure.`,
      }),
    );
  }

  const cod = Math.max(0, numberValue(order.cod_amount, 0));
  const collectedRaw = order.collected_amount;
  if (status === "delivered" && cod > 0 && collectedRaw !== undefined && collectedRaw !== null) {
    const collected = Math.max(0, numberValue(collectedRaw, 0));
    const gap = Math.max(0, cod - collected);
    if (gap > 0.009) {
      result.push(
        signal("cod_pending", "critical", order, "finance_dashboard", {
          titleAr: "فجوة COD بعد التسليم",
          titleEn: "COD gap after delivery",
          detailAr: `${ref} لديه ${gap.toFixed(2)} درهم غير مكتملة في التحصيل المسجل.`,
          detailEn: `${ref} has AED ${gap.toFixed(2)} still missing from recorded collection.`,
          amount: gap,
        }),
      );
    }
  }

  return result;
}

function actionCopy(kind: NexusRiskKind) {
  const map: Record<
    NexusRiskKind,
    {
      titleAr: string;
      titleEn: string;
      detailAr: string;
      detailEn: string;
      actionAr: string;
      actionEn: string;
      target: NexusActionTarget;
    }
  > = {
    unassigned: {
      titleAr: "طلبات بدون مندوب",
      titleEn: "Unassigned active orders",
      detailAr: "أولوية توزيع: افتح الطلبات وحدد أقرب مندوب متاح.",
      detailEn: "Dispatch priority: open orders and assign the best available driver.",
      actionAr: "فتح الطلبات",
      actionEn: "Open orders",
      target: "all_orders",
    },
    stale: {
      titleAr: "طلبات بدون تحديث حديث",
      titleEn: "Stale active orders",
      detailAr: "تحتاج مراجعة الحالة أو التواصل مع المندوب قبل أن تتحول لمشكلة عميل.",
      detailEn: "Review status or contact the driver before these become customer issues.",
      actionAr: "مراجعة الطلبات",
      actionEn: "Review orders",
      target: "all_orders",
    },
    financial_unposted: {
      titleAr: "مسلّم غير مُرحّل ماليًا",
      titleEn: "Delivered not financially posted",
      detailAr: "تأكد من الترحيل المالي قبل إغلاق اليوم أو إصدار التسويات.",
      detailEn: "Verify financial posting before daily close or settlements.",
      actionAr: "فتح المالية",
      actionEn: "Open finance",
      target: "finance_dashboard",
    },
    review: {
      titleAr: "قائمة المراجعة تحتاج قرارًا",
      titleEn: "Review queue needs decisions",
      detailAr: "طلبات متوقفة على قرار إداري أو تحقق يدوي.",
      detailEn: "Orders are waiting for an admin decision or manual verification.",
      actionAr: "فتح المراجعة",
      actionEn: "Open review",
      target: "review",
    },
    postponed: {
      titleAr: "طلبات مؤجلة",
      titleEn: "Postponed orders",
      detailAr: "راجع مواعيد المتابعة ولا تترك الطلب المؤجل خارج الرادار.",
      detailEn: "Confirm follow-up dates and keep postponed orders visible.",
      actionAr: "فتح المؤجلة",
      actionEn: "Open postponed",
      target: "postponed",
    },
    returned: {
      titleAr: "طلبات راجعة",
      titleEn: "Returned orders",
      detailAr: "أغلق مسار المرتجع والتسوية مع التاجر والمندوب.",
      detailEn: "Close the return workflow and merchant/driver settlement.",
      actionAr: "فتح الراجعة",
      actionEn: "Open returns",
      target: "returned",
    },
    cod_pending: {
      titleAr: "تحصيل COD معلق",
      titleEn: "Pending COD collection",
      detailAr: "راجع التحصيلات غير المكتملة قبل التسوية والإغلاق المالي.",
      detailEn: "Review incomplete collections before settlement and financial close.",
      actionAr: "فتح المالية",
      actionEn: "Open finance",
      target: "finance_dashboard",
    },
    driver_visibility: {
      titleAr: "رؤية المندوبين تحتاج تحديثًا",
      titleEn: "Driver visibility needs attention",
      detailAr: "هناك مهام بمندوبين معينين لكن لا توجد مواقع حديثة خلال آخر 30 دقيقة.",
      detailEn: "Assigned missions exist but no fresh driver location was seen in the last 30 minutes.",
      actionAr: "فتح المندوبين",
      actionEn: "Open live drivers",
      target: "live_drivers",
    },
  };
  return map[kind];
}

function aggregateActions(signals: NexusRiskSignal[]): NexusAction[] {
  const byKind = new Map<NexusRiskKind, NexusRiskSignal[]>();
  signals.forEach((item) => {
    const current = byKind.get(item.kind) || [];
    current.push(item);
    byKind.set(item.kind, current);
  });

  return Array.from(byKind.entries())
    .map(([kind, items]) => {
      const template = actionCopy(kind);
      const severity = items.reduce<NexusSeverity>((highest, item) =>
        severityRank[item.severity] > severityRank[highest] ? item.severity : highest,
      "watch");
      return {
        id: `action:${kind}`,
        kind,
        severity,
        count: items.length,
        amount: items.reduce((sum, item) => sum + numberValue(item.amount, 0), 0) || undefined,
        refs: Array.from(new Set(items.map((item) => item.reference).filter(Boolean) as string[])).slice(0, 4),
        titleAr: template.titleAr,
        titleEn: template.titleEn,
        detailAr: template.detailAr,
        detailEn: template.detailEn,
        actionAr: template.actionAr,
        actionEn: template.actionEn,
        target: template.target,
      };
    })
    .sort((a, b) => {
      const severityDelta = severityRank[b.severity] - severityRank[a.severity];
      if (severityDelta) return severityDelta;
      return b.count - a.count;
    });
}

function highestSeverityByOrder(signals: NexusRiskSignal[]) {
  const orderRisks = new Map<string, NexusSeverity>();
  signals.forEach((item) => {
    if (!item.orderId) return;
    const current = orderRisks.get(item.orderId);
    if (!current || severityRank[item.severity] > severityRank[current]) {
      orderRisks.set(item.orderId, item.severity);
    }
  });
  return orderRisks;
}

export function buildNexusSnapshot(
  ordersInput: Order[] = [],
  merchants: Merchant[] = [],
  finance: FinanceSummary,
  financeSource: FinanceSummarySource,
  now = new Date(),
): NexusSnapshot {
  const orders = ordersInput as OrderLike[];
  const active = orders.filter((order) => !isTerminal(order));
  const activeDriverKeys = new Set(active.map(driverKey).filter(Boolean));
  const liveDriverKeys = new Set(
    active.filter((order) => hasFreshDriverLocation(order, now)).map(driverKey).filter(Boolean),
  );

  const signals = orders.flatMap((order) => buildOrderSignals(order, now));
  const assignedActive = active.filter(hasAssignedDriver);
  if (assignedActive.length > 0 && liveDriverKeys.size === 0) {
    signals.push(
      signal("driver_visibility", "watch", null, "live_drivers", {
        titleAr: "لا توجد مواقع مندوبين حديثة",
        titleEn: "No fresh driver locations",
        detailAr: "توجد مهام معينة لمندوبين لكن آخر نافذة رؤية حية لا تحتوي موقعًا حديثًا خلال 30 دقيقة.",
        detailEn: "Assigned missions exist, but no driver location is fresh within the last 30 minutes.",
      }),
    );
  }

  if (finance.cod_pending > 0.009 && !signals.some((item) => item.kind === "cod_pending")) {
    signals.push(
      signal("cod_pending", finance.cod_pending >= 1000 ? "critical" : "warning", null, "finance_dashboard", {
        titleAr: "تحصيل COD معلق",
        titleEn: "Pending COD collection",
        detailAr: `ملخص المالية يسجل ${finance.cod_pending.toFixed(2)} درهم COD معلق.`,
        detailEn: `Finance reports AED ${finance.cod_pending.toFixed(2)} in pending COD.`,
        amount: finance.cod_pending,
      }),
    );
  }

  const metrics: NexusMetrics = {
    totalOrders: orders.length,
    ordersToday: orders.filter((order) => isSameDubaiDay(order.created_at, now)).length,
    deliveredToday: orders.filter(
      (order) => normalizeOrderStatus(order) === "delivered" && isSameDubaiDay(order.updated_at || order.created_at, now),
    ).length,
    activeOrders: active.length,
    unassignedActive: active.filter((order) => !hasAssignedDriver(order)).length,
    staleActive: active.filter((order) => hoursSince(latestOperationalDate(order), now) >= 8).length,
    activeDrivers: activeDriverKeys.size,
    liveDrivers: liveDriverKeys.size,
    internationalActive: active.filter((order) => isInternationalAdminOrder(order)).length,
    deliveredUnposted: orders.filter(
      (order) => normalizeOrderStatus(order) === "delivered" && !order.financial_posted_at,
    ).length,
    activeMerchants: merchants.filter(
      (merchant) => !/paused|inactive|blocked|suspended/i.test(text(merchant.status || "active")),
    ).length,
    codPending: Math.max(0, numberValue(finance.cod_pending, 0)),
    codCollected: Math.max(0, numberValue(finance.cod_collected, 0)),
    merchantPayable: Math.max(0, numberValue(finance.merchant_payable, 0)),
    totalIncome: numberValue(finance.total_income, 0),
    totalExpenses: numberValue(finance.total_expenses, 0),
    netEstimate: numberValue(finance.net_estimate, 0),
  };

  const riskOrders = highestSeverityByOrder(signals);
  const counts = Array.from(riskOrders.values()).reduce(
    (acc, value) => {
      acc[value] += 1;
      return acc;
    },
    { critical: 0, warning: 0, watch: 0 } as Record<NexusSeverity, number>,
  );

  return {
    generatedAt: now.toISOString(),
    financeSource,
    metrics,
    signals: [...signals].sort((a, b) => severityRank[b.severity] - severityRank[a.severity]),
    actions: aggregateActions(signals),
    criticalOrders: counts.critical,
    warningOrders: counts.warning,
    watchOrders: counts.watch,
    criticalSignals: signals.filter((item) => item.severity === "critical").length,
    warningSignals: signals.filter((item) => item.severity === "warning").length,
    watchSignals: signals.filter((item) => item.severity === "watch").length,
  };
}
