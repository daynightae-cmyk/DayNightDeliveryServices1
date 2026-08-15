import type { Merchant, Order, OrderStatusHistoryItem } from "../types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type NexusServiceBaseline = {
  key: string;
  shippingScope: string;
  serviceType: string;
  sampleSize: number;
  medianHours: number;
  p75Hours: number;
  p90Hours: number;
};

export type NexusRecoveryRisk = {
  orderId: string;
  reference: string;
  merchantName: string;
  receiverName: string;
  receiverPhone: string;
  destination: string;
  ageHours: number;
  lastUpdateHours: number;
  score: number;
  severity: "critical" | "warning" | "watch";
  observedBaselineHours: number | null;
  scheduledDueAt: string | null;
  reasonsAr: string[];
  reasonsEn: string[];
};

export type NexusMerchantPromise = {
  merchantId: string;
  merchantName: string;
  merchantCode: string;
  score: number;
  tier: "excellent" | "healthy" | "watch" | "risk";
  confidence: "strong" | "medium" | "limited";
  orders30: number;
  terminal30: number;
  deliverySuccessRate: number;
  frictionRate: number;
  repeatCustomerRate: number;
  medianDeliveryHours: number | null;
  signalAr: string;
  signalEn: string;
};

export type NexusFrictionSignal = {
  key: "returned" | "cancelled" | "postponed" | "review" | "failed";
  count: number;
  labelAr: string;
  labelEn: string;
};

export type NexusPhase4Snapshot = {
  generatedAt: string;
  historicalWindowDays: number;
  counters: {
    deliveredSample90: number;
    medianDeliveryHours30: number | null;
    medianTrendPct: number | null;
    scheduledAdherenceRate30: number | null;
    scheduledAdherenceSample30: number;
    atRiskActive: number;
    criticalActive: number;
    returnCancelRate30: number;
    repeatCustomerRate90: number;
    repeatCustomers90: number;
    uniqueCustomers90: number;
  };
  baselines: NexusServiceBaseline[];
  recoveryQueue: NexusRecoveryRisk[];
  merchantPromise: NexusMerchantPromise[];
  friction: NexusFrictionSignal[];
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function normalizeStatus(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isDeliveredStatus(value: unknown) {
  const status = normalizeStatus(value);
  return status === "delivered" || status === "completed" || status === "complete" ||
    status.includes("تم_التسليم") || status.includes("تم_التوصيل") || status === "مسلم" || status === "مسلّم";
}

function isCancelledStatus(value: unknown) {
  const status = normalizeStatus(value);
  return status === "cancelled" || status === "canceled" || status.includes("ملغي") || status.includes("ملغى") || status.includes("الغاء") || status.includes("إلغاء");
}

function isReturnedStatus(value: unknown) {
  const status = normalizeStatus(value);
  return status === "returned" || status === "return" || status.includes("مرتجع") || status.includes("راجع_للتاجر");
}

function isTerminal(order: Order) {
  return isDeliveredStatus(order.status) || isCancelledStatus(order.status) || isReturnedStatus(order.status);
}

function isPostponedStatus(value: unknown) {
  const status = normalizeStatus(value);
  return status.includes("postpon") || status.includes("defer") || status.includes("تأجيل") || status.includes("مؤجل") || status.includes("موجل");
}

function isReviewStatus(value: unknown) {
  const status = normalizeStatus(value);
  return status.includes("review") || status.includes("مراجعة") || status.includes("قيد_المراجعة");
}

function isFailedStatus(value: unknown) {
  const status = normalizeStatus(value);
  return status === "failed" || status.includes("attempt_failed") || status.includes("فشل") || status.includes("تعذر");
}

function parseMs(value: unknown) {
  const ms = value ? new Date(String(value)).getTime() : NaN;
  return Number.isFinite(ms) ? ms : null;
}

function historyTimestamp(item: OrderStatusHistoryItem) {
  return parseMs(item.created_at || item.timestamp || item.date || item.updated_at);
}

function orderHistory(order: Order) {
  return Array.isArray(order.status_history) ? order.status_history : [];
}

function deliveredAt(order: Order) {
  const transitions = orderHistory(order)
    .filter((item) => isDeliveredStatus(item.status))
    .map(historyTimestamp)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  if (transitions.length) return transitions[0];
  if (!isDeliveredStatus(order.status)) return null;
  return parseMs(order.updated_at || order.delivery_date);
}

function deliveryCycleHours(order: Order) {
  const start = parseMs(order.created_at);
  const end = deliveredAt(order);
  if (start === null || end === null || end <= start) return null;
  const hours = (end - start) / HOUR_MS;
  return hours > 0 && hours < 24 * 120 ? hours : null;
}

function quantile(values: number[], percentile: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function baselineKey(order: Order) {
  const scope = String(order.shipping_scope || (order.destination_country ? "international" : "local")).trim().toLowerCase() || "local";
  const service = String(order.service_type || "standard").trim().toLowerCase() || "standard";
  return `${scope}::${service}`;
}

function buildBaselines(orders: Order[], nowMs: number) {
  const cutoff = nowMs - 90 * DAY_MS;
  const grouped = new Map<string, { scope: string; service: string; values: number[] }>();
  for (const order of orders) {
    const end = deliveredAt(order);
    const cycle = deliveryCycleHours(order);
    if (end === null || end < cutoff || cycle === null) continue;
    const key = baselineKey(order);
    const [scope, service] = key.split("::");
    const group = grouped.get(key) || { scope, service, values: [] };
    group.values.push(cycle);
    grouped.set(key, group);
  }
  return Array.from(grouped.entries())
    .map(([key, group]) => ({
      key,
      shippingScope: group.scope,
      serviceType: group.service,
      sampleSize: group.values.length,
      medianHours: round1(quantile(group.values, 0.5)),
      p75Hours: round1(quantile(group.values, 0.75)),
      p90Hours: round1(quantile(group.values, 0.9)),
    }))
    .filter((item) => item.sampleSize >= 3)
    .sort((a, b) => b.sampleSize - a.sampleSize || a.medianHours - b.medianHours);
}

function scopeFallback(orders: Order[], nowMs: number, scope: string): NexusServiceBaseline | null {
  const cutoff = nowMs - 90 * DAY_MS;
  const values = orders
    .filter((order) => baselineKey(order).startsWith(`${scope}::`))
    .filter((order) => (deliveredAt(order) ?? 0) >= cutoff)
    .map(deliveryCycleHours)
    .filter((value): value is number => value !== null);
  if (values.length < 5) return null;
  return {
    key: `${scope}::*`,
    shippingScope: scope,
    serviceType: "all observed services",
    sampleSize: values.length,
    medianHours: round1(quantile(values, 0.5)),
    p75Hours: round1(quantile(values, 0.75)),
    p90Hours: round1(quantile(values, 0.9)),
  };
}

function resolveBaseline(order: Order, baselines: NexusServiceBaseline[], orders: Order[], nowMs: number) {
  const exact = baselines.find((item) => item.key === baselineKey(order) && item.sampleSize >= 4);
  if (exact) return exact;
  const scope = baselineKey(order).split("::")[0];
  return scopeFallback(orders, nowMs, scope);
}

function lastOperationalUpdateMs(order: Order) {
  const history = orderHistory(order)
    .map(historyTimestamp)
    .filter((value): value is number => value !== null);
  const candidates = [parseMs(order.updated_at), parseMs(order.created_at), ...history]
    .filter((value): value is number => value !== null);
  return candidates.length ? Math.max(...candidates) : null;
}

function promisedByMs(order: Order) {
  const raw = String(order.delivery_date || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return parseMs(`${raw}T23:59:59+04:00`);
  return parseMs(raw);
}

function reference(order: Order) {
  return String(order.tracking_number || order.tracking_code || order.invoice_number || order.coupon_number || order.id || "—");
}

function customerPhone(order: Order) {
  const raw = String(order.receiver_phone || order.customer_phone || "").replace(/\D/g, "");
  return raw.length >= 7 ? raw : "";
}

function hasFrictionHistory(order: Order) {
  return orderHistory(order).some((item) => isPostponedStatus(item.status) || isReviewStatus(item.status) || isFailedStatus(item.status));
}

function buildRecoveryQueue(orders: Order[], baselines: NexusServiceBaseline[], nowMs: number) {
  const risks: NexusRecoveryRisk[] = [];
  for (const order of orders) {
    if (isTerminal(order)) continue;
    const created = parseMs(order.created_at);
    if (created === null) continue;
    const ageHours = Math.max(0, (nowMs - created) / HOUR_MS);
    const lastUpdate = lastOperationalUpdateMs(order) ?? created;
    const lastUpdateHours = Math.max(0, (nowMs - lastUpdate) / HOUR_MS);
    const baseline = resolveBaseline(order, baselines, orders, nowMs);
    const due = promisedByMs(order);
    const reasonsAr: string[] = [];
    const reasonsEn: string[] = [];
    let score = 0;

    if (due !== null && nowMs > due) {
      score += 75;
      reasonsAr.push("موعد التسليم المسجل مرّ بالفعل");
      reasonsEn.push("Recorded delivery promise is already overdue");
    } else if (due !== null && due - nowMs <= 6 * HOUR_MS) {
      score += 30;
      reasonsAr.push("موعد التسليم المسجل خلال أقل من 6 ساعات");
      reasonsEn.push("Recorded delivery promise is due within 6 hours");
    }

    if (baseline) {
      if (ageHours >= baseline.p90Hours) {
        score += 65;
        reasonsAr.push(`عمر الطلب تجاوز P90 المرصود (${baseline.p90Hours}س)`);
        reasonsEn.push(`Order age exceeded observed P90 (${baseline.p90Hours}h)`);
      } else if (ageHours >= baseline.p75Hours) {
        score += 45;
        reasonsAr.push(`عمر الطلب تجاوز P75 المرصود (${baseline.p75Hours}س)`);
        reasonsEn.push(`Order age exceeded observed P75 (${baseline.p75Hours}h)`);
      } else if (ageHours >= baseline.medianHours) {
        score += 25;
        reasonsAr.push(`عمر الطلب تجاوز الوسيط المرصود (${baseline.medianHours}س)`);
        reasonsEn.push(`Order age exceeded observed median (${baseline.medianHours}h)`);
      }
    }

    if (lastUpdateHours >= 8) {
      score += 20;
      reasonsAr.push("لا يوجد تحديث تشغيلي منذ 8 ساعات أو أكثر");
      reasonsEn.push("No operational update for 8 hours or more");
    }
    if (hasFrictionHistory(order)) {
      score += 15;
      reasonsAr.push("سجل الطلب يحتوي إشارة تأجيل/مراجعة/فشل محاولة");
      reasonsEn.push("Order history contains postponement/review/failed-attempt friction");
    }
    if (!order.driver_name && !order.driver_code && ageHours >= 2) {
      score += 10;
      reasonsAr.push("لا توجد هوية مندوب ظاهرة على الطلب");
      reasonsEn.push("No visible driver identity on the order");
    }

    score = clamp(Math.round(score));
    if (score < 25) continue;
    const severity: NexusRecoveryRisk["severity"] = score >= 70 ? "critical" : score >= 45 ? "warning" : "watch";
    risks.push({
      orderId: order.id,
      reference: reference(order),
      merchantName: String(order.merchant_name || order.sender_name || "DAY NIGHT Merchant"),
      receiverName: String(order.receiver_name || order.customer_name || "—"),
      receiverPhone: String(order.receiver_phone || order.customer_phone || "—"),
      destination: String(order.receiver_city || order.destination_country || "—"),
      ageHours: round1(ageHours),
      lastUpdateHours: round1(lastUpdateHours),
      score,
      severity,
      observedBaselineHours: baseline?.p75Hours ?? null,
      scheduledDueAt: due === null ? null : new Date(due).toISOString(),
      reasonsAr,
      reasonsEn,
    });
  }
  return risks.sort((a, b) => b.score - a.score || b.ageHours - a.ageHours);
}

function repeatCustomerStats(orders: Order[], cutoffMs: number) {
  const counts = new Map<string, number>();
  for (const order of orders) {
    const created = parseMs(order.created_at);
    if (created === null || created < cutoffMs) continue;
    const phone = customerPhone(order);
    if (!phone) continue;
    counts.set(phone, (counts.get(phone) || 0) + 1);
  }
  const unique = counts.size;
  const repeat = Array.from(counts.values()).filter((count) => count >= 2).length;
  return { unique, repeat, rate: unique ? repeat / unique : 0 };
}

function merchantIdentity(order: Order) {
  return String(order.merchant_id || order.merchant_code || order.merchant_name || order.sender_name || "unknown").trim() || "unknown";
}

function merchantName(order: Order, merchants: Merchant[]) {
  const merchant = merchants.find((item) => item.id === order.merchant_id || (order.merchant_code && item.merchant_code === order.merchant_code));
  return String(merchant?.trade_name || order.merchant_name || order.sender_name || "DAY NIGHT Merchant");
}

function merchantCode(order: Order, merchants: Merchant[]) {
  const merchant = merchants.find((item) => item.id === order.merchant_id || (order.merchant_code && item.merchant_code === order.merchant_code));
  return String(merchant?.merchant_code || order.merchant_code || "");
}

function buildMerchantPromise(orders: Order[], merchants: Merchant[], nowMs: number, globalMedian30: number | null) {
  const cutoff = nowMs - 30 * DAY_MS;
  const recent = orders.filter((order) => (parseMs(order.created_at) ?? 0) >= cutoff);
  const grouped = new Map<string, Order[]>();
  for (const order of recent) {
    const key = merchantIdentity(order);
    const rows = grouped.get(key) || [];
    rows.push(order);
    grouped.set(key, rows);
  }

  const result: NexusMerchantPromise[] = [];
  for (const [merchantId, rows] of grouped.entries()) {
    const terminal = rows.filter(isTerminal);
    const delivered = terminal.filter((order) => isDeliveredStatus(order.status));
    const failedTerminal = terminal.filter((order) => isCancelledStatus(order.status) || isReturnedStatus(order.status));
    const deliverySuccessRate = terminal.length ? delivered.length / terminal.length : 0;
    const frictionOrders = rows.filter((order) => hasFrictionHistory(order) || isCancelledStatus(order.status) || isReturnedStatus(order.status));
    const frictionRate = rows.length ? frictionOrders.length / rows.length : 0;
    const cycles = delivered.map(deliveryCycleHours).filter((value): value is number => value !== null);
    const medianDeliveryHours = cycles.length ? round1(quantile(cycles, 0.5)) : null;
    const repeat = repeatCustomerStats(rows, cutoff);

    const successScore = terminal.length ? deliverySuccessRate * 100 : 60;
    const frictionScore = (1 - frictionRate) * 100;
    const speedScore = medianDeliveryHours && globalMedian30
      ? clamp((globalMedian30 / medianDeliveryHours) * 100, 35, 100)
      : 65;
    const loyaltyScore = clamp(repeat.rate * 150, 0, 100);
    const score = Math.round(clamp(successScore * 0.5 + frictionScore * 0.2 + speedScore * 0.2 + loyaltyScore * 0.1));
    const tier: NexusMerchantPromise["tier"] = score >= 85 ? "excellent" : score >= 70 ? "healthy" : score >= 55 ? "watch" : "risk";
    const confidence: NexusMerchantPromise["confidence"] = rows.length >= 15 && terminal.length >= 8 ? "strong" : rows.length >= 6 && terminal.length >= 3 ? "medium" : "limited";

    let signalAr = "إشارات الخدمة مستقرة ضمن البيانات الحالية.";
    let signalEn = "Service signals are stable in the current data.";
    if (failedTerminal.length && terminal.length && failedTerminal.length / terminal.length >= 0.2) {
      signalAr = "نسبة المرتجع/الإلغاء مرتفعة وتحتاج مراجعة تجربة العميل.";
      signalEn = "Return/cancellation share is elevated and deserves customer-experience review.";
    } else if (frictionRate >= 0.25) {
      signalAr = "توجد إشارات احتكاك متكررة في رحلة الطلبات.";
      signalEn = "Repeated friction signals appear across the order journey.";
    } else if (medianDeliveryHours && globalMedian30 && medianDeliveryHours > globalMedian30 * 1.25) {
      signalAr = "زمن التسليم الوسيط أبطأ من الوسيط العام المرصود.";
      signalEn = "Median delivery cycle is slower than the observed network median.";
    } else if (repeat.rate >= 0.3 && deliverySuccessRate >= 0.8) {
      signalAr = "تكرار العملاء ونجاح التسليم يقدمان إشارة ولاء قوية.";
      signalEn = "Repeat customers and delivery success show a strong loyalty signal.";
    }

    result.push({
      merchantId,
      merchantName: merchantName(rows[0], merchants),
      merchantCode: merchantCode(rows[0], merchants),
      score,
      tier,
      confidence,
      orders30: rows.length,
      terminal30: terminal.length,
      deliverySuccessRate,
      frictionRate,
      repeatCustomerRate: repeat.rate,
      medianDeliveryHours,
      signalAr,
      signalEn,
    });
  }

  return result.sort((a, b) => a.score - b.score || b.orders30 - a.orders30);
}

function frictionSignals(orders: Order[], nowMs: number): NexusFrictionSignal[] {
  const cutoff = nowMs - 30 * DAY_MS;
  const recent = orders.filter((order) => (parseMs(order.created_at) ?? 0) >= cutoff);
  const countHistory = (predicate: (status: unknown) => boolean) => recent.filter((order) => orderHistory(order).some((item) => predicate(item.status))).length;
  return [
    { key: "returned", count: recent.filter((order) => isReturnedStatus(order.status)).length, labelAr: "مرتجعات", labelEn: "Returned" },
    { key: "cancelled", count: recent.filter((order) => isCancelledStatus(order.status)).length, labelAr: "إلغاءات", labelEn: "Cancelled" },
    { key: "postponed", count: countHistory(isPostponedStatus), labelAr: "تأجيلات", labelEn: "Postponed" },
    { key: "review", count: countHistory(isReviewStatus), labelAr: "قيد المراجعة", labelEn: "Review" },
    { key: "failed", count: countHistory(isFailedStatus), labelAr: "محاولات فاشلة", labelEn: "Failed attempts" },
  ].sort((a, b) => b.count - a.count);
}

export function buildNexusPhase4Snapshot(orders: Order[], merchants: Merchant[], now = new Date()): NexusPhase4Snapshot {
  const nowMs = now.getTime();
  const cutoff30 = nowMs - 30 * DAY_MS;
  const cutoff60 = nowMs - 60 * DAY_MS;
  const cutoff90 = nowMs - 90 * DAY_MS;
  const baselines = buildBaselines(orders, nowMs);
  const recoveryQueue = buildRecoveryQueue(orders, baselines, nowMs);

  const delivered90 = orders.filter((order) => {
    const end = deliveredAt(order);
    return end !== null && end >= cutoff90 && deliveryCycleHours(order) !== null;
  });
  const delivered30 = delivered90.filter((order) => (deliveredAt(order) ?? 0) >= cutoff30);
  const deliveredPrev30 = orders.filter((order) => {
    const end = deliveredAt(order);
    return end !== null && end >= cutoff60 && end < cutoff30 && deliveryCycleHours(order) !== null;
  });
  const cycles30 = delivered30.map(deliveryCycleHours).filter((value): value is number => value !== null);
  const cyclesPrev30 = deliveredPrev30.map(deliveryCycleHours).filter((value): value is number => value !== null);
  const median30 = cycles30.length ? round1(quantile(cycles30, 0.5)) : null;
  const medianPrev30 = cyclesPrev30.length ? round1(quantile(cyclesPrev30, 0.5)) : null;
  const medianTrendPct = median30 !== null && medianPrev30 && medianPrev30 > 0
    ? Math.round(((median30 - medianPrev30) / medianPrev30) * 100)
    : null;

  const scheduledDelivered30 = delivered30
    .map((order) => ({ order, due: promisedByMs(order), done: deliveredAt(order) }))
    .filter((item): item is { order: Order; due: number; done: number } => item.due !== null && item.done !== null);
  const scheduledOnTime = scheduledDelivered30.filter((item) => item.done <= item.due).length;
  const scheduledAdherenceRate30 = scheduledDelivered30.length ? scheduledOnTime / scheduledDelivered30.length : null;

  const recent30 = orders.filter((order) => (parseMs(order.created_at) ?? 0) >= cutoff30);
  const terminal30 = recent30.filter(isTerminal);
  const returnCancel30 = terminal30.filter((order) => isReturnedStatus(order.status) || isCancelledStatus(order.status));
  const repeat90 = repeatCustomerStats(orders, cutoff90);
  const merchantPromise = buildMerchantPromise(orders, merchants, nowMs, median30);

  return {
    generatedAt: now.toISOString(),
    historicalWindowDays: 90,
    counters: {
      deliveredSample90: delivered90.length,
      medianDeliveryHours30: median30,
      medianTrendPct,
      scheduledAdherenceRate30,
      scheduledAdherenceSample30: scheduledDelivered30.length,
      atRiskActive: recoveryQueue.length,
      criticalActive: recoveryQueue.filter((item) => item.severity === "critical").length,
      returnCancelRate30: terminal30.length ? returnCancel30.length / terminal30.length : 0,
      repeatCustomerRate90: repeat90.rate,
      repeatCustomers90: repeat90.repeat,
      uniqueCustomers90: repeat90.unique,
    },
    baselines,
    recoveryQueue,
    merchantPromise,
    friction: frictionSignals(orders, nowMs),
  };
}
