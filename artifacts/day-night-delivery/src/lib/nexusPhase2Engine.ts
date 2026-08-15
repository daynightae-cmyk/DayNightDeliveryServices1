import type { FinanceSummary } from "./adminData";
import { normalizeOrderStatus } from "./adminOrderLogic";
import type { Merchant, Order } from "../types";
import type { DriverLocation, DriverProfile } from "../types/driver";
import type { NexusSnapshot } from "./nexusRiskEngine";

export type NexusDispatchDriverScore = {
  driverId: string;
  driverName: string;
  score: number;
  distanceKm: number | null;
  activeOrders: number;
  deliveredToday: number;
  presence: "online" | "idle" | "offline" | "unknown";
  shiftStatus: string;
  areaMatch: boolean;
  reasonsAr: string[];
  reasonsEn: string[];
};

export type NexusDispatchRecommendation = {
  orderId: string;
  reference: string;
  destination: string;
  createdAgeHours: number;
  pickupCoordinatesAvailable: boolean;
  candidates: NexusDispatchDriverScore[];
  confidence: "high" | "medium" | "low";
};

export type NexusMerchantHealth = {
  merchantId: string;
  merchantName: string;
  merchantCode: string;
  score: number;
  tier: "excellent" | "healthy" | "watch" | "risk";
  orders30: number;
  orders7: number;
  previous7: number;
  growthPct: number;
  delivered30: number;
  returned30: number;
  cancelled30: number;
  deliveryRate: number;
  returnRate: number;
  cancellationRate: number;
  contribution30: number;
  cod30: number;
  signalAr: string;
  signalEn: string;
};

export type NexusProfitBucket = {
  key: string;
  label: string;
  deliveredOrders: number;
  contribution: number;
  discounts: number;
  averageContribution: number;
};

export type NexusProfitIntelligence = {
  windowDays: number;
  deliveredOrders: number;
  contributionBeforeSharedExpenses: number;
  discounts: number;
  averageContributionPerDelivered: number;
  authoritativeNetEstimate: number;
  topMerchants: NexusProfitBucket[];
  topRegions: NexusProfitBucket[];
};

export type NexusBriefItem = {
  id: string;
  tone: "critical" | "warning" | "positive" | "info";
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
};

export type NexusPhase2Snapshot = {
  generatedAt: string;
  dispatch: NexusDispatchRecommendation[];
  merchantHealth: NexusMerchantHealth[];
  merchantOpportunities: NexusMerchantHealth[];
  merchantAttention: NexusMerchantHealth[];
  profit: NexusProfitIntelligence;
  brief: NexusBriefItem[];
};

type NexusOrder = Order & {
  driver_id?: string | null;
  assigned_driver_id?: string | null;
};

const CLOSED = new Set(["delivered", "cancelled", "returned"]);

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function validDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function hoursSince(value: unknown, now: Date) {
  const date = validDate(value);
  if (!date) return 0;
  return Math.max(0, (now.getTime() - date.getTime()) / 3_600_000);
}

function daysSince(value: unknown, now: Date) {
  return hoursSince(value, now) / 24;
}

function orderReference(order: NexusOrder) {
  return (
    text(order.tracking_number) ||
    text(order.tracking_code) ||
    text(order.invoice_number) ||
    text(order.coupon_number) ||
    text(order.id) ||
    "—"
  );
}

function isActiveOrder(order: NexusOrder) {
  return !CLOSED.has(normalizeOrderStatus(order));
}

function isUnassigned(order: NexusOrder) {
  return !(
    text(order.driver_id) ||
    text(order.assigned_driver_id) ||
    text(order.driver_code) ||
    text(order.driver_phone) ||
    text(order.driver_name)
  );
}

function driverMatchesOrder(order: NexusOrder, driverId: string) {
  return text(order.driver_id) === driverId || text(order.assigned_driver_id) === driverId;
}

function locationPresence(location: DriverLocation | null | undefined, now: Date) {
  if (!location?.last_seen_at) return "unknown" as const;
  if (location.is_online === false) return "offline" as const;
  const ageMinutes = hoursSince(location.last_seen_at, now) * 60;
  if (ageMinutes <= 2) return "online" as const;
  if (ageMinutes <= 10) return "idle" as const;
  return "offline" as const;
}

function coordinate(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) > 0.00001 ? parsed : null;
}

function orderPickupPoint(order: NexusOrder) {
  const lat = coordinate(order.pickup_lat) ?? coordinate(order.sender_lat) ?? coordinate(order.delivery_lat) ?? coordinate(order.receiver_lat);
  const lng = coordinate(order.pickup_lng) ?? coordinate(order.sender_lng) ?? coordinate(order.delivery_lng) ?? coordinate(order.receiver_lng);
  return lat !== null && lng !== null ? { lat, lng } : null;
}

function driverPoint(location: DriverLocation | null | undefined) {
  const lat = coordinate(location?.lat ?? location?.latitude);
  const lng = coordinate(location?.lng ?? location?.longitude);
  return lat !== null && lng !== null ? { lat, lng } : null;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radius = 6371;
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function normalizedArea(value: unknown) {
  return text(value).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").trim();
}

function areasMatch(driver: DriverProfile, order: NexusOrder) {
  const driverAreas = [driver.work_area, driver.emirate, driver.address]
    .map(normalizedArea)
    .filter(Boolean);
  const orderAreas = [
    order.sender_city,
    order.sender_emirate,
    order.sender_area,
    order.receiver_city,
    order.receiver_emirate,
    order.receiver_area,
  ]
    .map(normalizedArea)
    .filter(Boolean);
  return driverAreas.some((driverArea) =>
    orderAreas.some((orderArea) => driverArea.includes(orderArea) || orderArea.includes(driverArea)),
  );
}

function driverName(driver: DriverProfile) {
  return text(driver.full_name) || text(driver.name) || text(driver.phone) || text(driver.id) || "Driver";
}

function distanceScore(distanceKm: number | null) {
  if (distanceKm === null) return 0;
  if (distanceKm <= 2) return 30;
  if (distanceKm <= 5) return 25;
  if (distanceKm <= 10) return 19;
  if (distanceKm <= 20) return 11;
  if (distanceKm <= 35) return 5;
  return 1;
}

function presenceScore(presence: NexusDispatchDriverScore["presence"]) {
  if (presence === "online") return 25;
  if (presence === "idle") return 17;
  if (presence === "offline") return 2;
  return 6;
}

function shiftScore(value: unknown) {
  const shift = text(value).toLowerCase();
  if (shift === "available") return 16;
  if (shift === "busy") return 5;
  if (shift === "paused" || shift === "offline") return -8;
  return 8;
}

function buildDispatchRecommendations(
  orders: NexusOrder[],
  drivers: DriverProfile[],
  locations: DriverLocation[],
  now: Date,
): NexusDispatchRecommendation[] {
  const activeOrders = orders.filter(isActiveOrder);
  const eligibleDrivers = drivers.filter((driver) => {
    const status = text(driver.status || "active").toLowerCase();
    return !/inactive|suspended|blocked/.test(status);
  });

  const unassigned = activeOrders
    .filter(isUnassigned)
    .sort((a, b) => hoursSince(b.created_at, now) - hoursSince(a.created_at, now))
    .slice(0, 8);

  return unassigned.map((order) => {
    const pickup = orderPickupPoint(order);
    const destination =
      text(order.receiver_area) || text(order.receiver_city) || text(order.receiver_emirate) || text(order.sender_city) || "—";

    const candidates = eligibleDrivers
      .map<NexusDispatchDriverScore>((driver) => {
        const location = locations.find((item) => item.driver_id === driver.id) || null;
        const presence = locationPresence(location, now);
        const active = activeOrders.filter((item) => driverMatchesOrder(item, driver.id)).length;
        const deliveredToday = orders.filter(
          (item) =>
            driverMatchesOrder(item, driver.id) &&
            normalizeOrderStatus(item) === "delivered" &&
            daysSince(item.updated_at || item.created_at, now) < 1,
        ).length;
        const point = driverPoint(location);
        const distanceKm = pickup && point ? haversineKm(point, pickup) : null;
        const areaMatch = areasMatch(driver, order);
        const workloadScore = Math.max(0, 22 - active * 5);
        const experienceScore = Math.min(6, deliveredToday * 1.5);
        const total = clamp(
          distanceScore(distanceKm) +
            presenceScore(presence) +
            shiftScore(driver.shift_status) +
            workloadScore +
            (areaMatch ? 12 : 0) +
            experienceScore,
        );
        const reasonsAr: string[] = [];
        const reasonsEn: string[] = [];
        if (distanceKm !== null) {
          reasonsAr.push(`يبعد ${distanceKm.toFixed(1)} كم عن نقطة الاستلام`);
          reasonsEn.push(`${distanceKm.toFixed(1)} km from pickup`);
        } else {
          reasonsAr.push("المسافة غير متاحة — لم تدخل في التقييم");
          reasonsEn.push("Distance unavailable — excluded from score");
        }
        reasonsAr.push(`الحضور: ${presence === "online" ? "متصل" : presence === "idle" ? "خامل حديثًا" : presence === "offline" ? "غير متصل" : "غير معروف"}`);
        reasonsEn.push(`Presence: ${presence}`);
        reasonsAr.push(`${active} مهام نشطة حاليًا`);
        reasonsEn.push(`${active} active missions`);
        if (areaMatch) {
          reasonsAr.push("تطابق منطقة العمل مع مسار الطلب");
          reasonsEn.push("Work-area match with order route");
        }
        return {
          driverId: driver.id,
          driverName: driverName(driver),
          score: Math.round(total),
          distanceKm,
          activeOrders: active,
          deliveredToday,
          presence,
          shiftStatus: text(driver.shift_status || "unknown"),
          areaMatch,
          reasonsAr,
          reasonsEn,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const top = candidates[0];
    const confidence: NexusDispatchRecommendation["confidence"] =
      top && pickup && top.distanceKm !== null && top.presence === "online" && top.score >= 70
        ? "high"
        : top && top.score >= 55
          ? "medium"
          : "low";

    return {
      orderId: order.id,
      reference: orderReference(order),
      destination,
      createdAgeHours: hoursSince(order.created_at, now),
      pickupCoordinatesAvailable: Boolean(pickup),
      candidates,
      confidence,
    };
  });
}

function merchantMatchesOrder(merchant: Merchant, order: NexusOrder) {
  if (text(order.merchant_id) && text(order.merchant_id) === merchant.id) return true;
  if (text(order.merchant_code) && text(merchant.merchant_code) && text(order.merchant_code) === text(merchant.merchant_code)) return true;
  return Boolean(text(order.merchant_name) && normalizedArea(order.merchant_name) === normalizedArea(merchant.trade_name));
}

function orderContribution(order: NexusOrder) {
  const revenue = numberValue(order.company_revenue, NaN);
  const fallback = numberValue(order.delivery_fee, numberValue(order.delivery_price, 0));
  const gross = Number.isFinite(revenue) ? revenue : fallback;
  const discount = Math.max(0, numberValue(order.discount_amount ?? order.discount, 0));
  return Math.max(0, gross - discount);
}

function merchantTier(score: number): NexusMerchantHealth["tier"] {
  if (score >= 85) return "excellent";
  if (score >= 70) return "healthy";
  if (score >= 50) return "watch";
  return "risk";
}

function growthPct(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function buildMerchantHealth(orders: NexusOrder[], merchants: Merchant[], now: Date) {
  return merchants
    .filter((merchant) => !/blocked|suspended/i.test(text(merchant.status || "active")))
    .map<NexusMerchantHealth>((merchant) => {
      const merchantOrders = orders.filter((order) => merchantMatchesOrder(merchant, order));
      const recent30 = merchantOrders.filter((order) => daysSince(order.created_at, now) <= 30);
      const current7 = merchantOrders.filter((order) => daysSince(order.created_at, now) <= 7);
      const previous7 = merchantOrders.filter((order) => {
        const days = daysSince(order.created_at, now);
        return days > 7 && days <= 14;
      });
      const delivered = recent30.filter((order) => normalizeOrderStatus(order) === "delivered");
      const returned = recent30.filter((order) => normalizeOrderStatus(order) === "returned");
      const cancelled = recent30.filter((order) => normalizeOrderStatus(order) === "cancelled");
      const total = recent30.length;
      const deliveryRate = total ? delivered.length / total : 0;
      const returnRate = total ? returned.length / total : 0;
      const cancellationRate = total ? cancelled.length / total : 0;
      const growth = growthPct(current7.length, previous7.length);
      const volumeBoost = Math.min(10, Math.log2(total + 1) * 2.5);
      const growthBoost = clamp(growth / 10, -10, 10);
      const score = total === 0
        ? 42
        : clamp(50 + deliveryRate * 35 - returnRate * 28 - cancellationRate * 22 + volumeBoost + growthBoost);
      const tier = merchantTier(score);
      const contribution30 = delivered.reduce((sum, order) => sum + orderContribution(order), 0);
      const cod30 = recent30.reduce((sum, order) => sum + Math.max(0, numberValue(order.cod_amount, 0)), 0);

      let signalAr = "أداء مستقر خلال آخر 30 يومًا.";
      let signalEn = "Stable performance over the last 30 days.";
      if (total === 0) {
        signalAr = "لا توجد طلبات خلال 30 يومًا — فرصة لإعادة تنشيط التاجر.";
        signalEn = "No orders in 30 days — reactivation opportunity.";
      } else if (growth >= 30 && score >= 70) {
        signalAr = `نمو ${Math.round(growth)}% مع صحة تشغيلية قوية — فرصة توسع.`;
        signalEn = `${Math.round(growth)}% growth with strong operational health — expansion opportunity.`;
      } else if (returnRate >= 0.15) {
        signalAr = `نسبة مرتجعات ${Math.round(returnRate * 100)}% تحتاج مراجعة.`;
        signalEn = `${Math.round(returnRate * 100)}% return rate needs review.`;
      } else if (cancellationRate >= 0.15) {
        signalAr = `نسبة إلغاء ${Math.round(cancellationRate * 100)}% تحتاج متابعة.`;
        signalEn = `${Math.round(cancellationRate * 100)}% cancellation rate needs follow-up.`;
      } else if (score >= 85) {
        signalAr = "تاجر ممتاز — حافظ على العلاقة وابحث عن زيادة الحجم.";
        signalEn = "Excellent merchant — protect the relationship and grow volume.";
      }

      return {
        merchantId: merchant.id,
        merchantName: text(merchant.trade_name) || text(merchant.owner_name) || merchant.id,
        merchantCode: text(merchant.merchant_code),
        score: Math.round(score),
        tier,
        orders30: total,
        orders7: current7.length,
        previous7: previous7.length,
        growthPct: Math.round(growth),
        delivered30: delivered.length,
        returned30: returned.length,
        cancelled30: cancelled.length,
        deliveryRate,
        returnRate,
        cancellationRate,
        contribution30,
        cod30,
        signalAr,
        signalEn,
      };
    })
    .sort((a, b) => b.score - a.score || b.orders30 - a.orders30);
}

function buildProfitBuckets(
  orders: NexusOrder[],
  labelFor: (order: NexusOrder) => { key: string; label: string },
) {
  const buckets = new Map<string, NexusProfitBucket>();
  orders.forEach((order) => {
    const { key, label } = labelFor(order);
    if (!key) return;
    const current = buckets.get(key) || {
      key,
      label,
      deliveredOrders: 0,
      contribution: 0,
      discounts: 0,
      averageContribution: 0,
    };
    current.deliveredOrders += 1;
    current.contribution += orderContribution(order);
    current.discounts += Math.max(0, numberValue(order.discount_amount ?? order.discount, 0));
    buckets.set(key, current);
  });
  return Array.from(buckets.values())
    .map((item) => ({
      ...item,
      contribution: Number(item.contribution.toFixed(2)),
      discounts: Number(item.discounts.toFixed(2)),
      averageContribution: item.deliveredOrders ? Number((item.contribution / item.deliveredOrders).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 6);
}

function buildProfitIntelligence(orders: NexusOrder[], finance: FinanceSummary, now: Date): NexusProfitIntelligence {
  const delivered30 = orders.filter(
    (order) => normalizeOrderStatus(order) === "delivered" && daysSince(order.updated_at || order.created_at, now) <= 30,
  );
  const contribution = delivered30.reduce((sum, order) => sum + orderContribution(order), 0);
  const discounts = delivered30.reduce(
    (sum, order) => sum + Math.max(0, numberValue(order.discount_amount ?? order.discount, 0)),
    0,
  );
  const merchants = buildProfitBuckets(delivered30, (order) => ({
    key: text(order.merchant_id) || normalizedArea(order.merchant_name) || "direct",
    label: text(order.merchant_name) || text(order.merchant_code) || "Direct / Personal",
  }));
  const regions = buildProfitBuckets(delivered30, (order) => ({
    key: normalizedArea(order.receiver_emirate || order.receiver_city || "unknown"),
    label: text(order.receiver_emirate) || text(order.receiver_city) || "Unknown",
  }));
  return {
    windowDays: 30,
    deliveredOrders: delivered30.length,
    contributionBeforeSharedExpenses: Number(contribution.toFixed(2)),
    discounts: Number(discounts.toFixed(2)),
    averageContributionPerDelivered: delivered30.length ? Number((contribution / delivered30.length).toFixed(2)) : 0,
    authoritativeNetEstimate: numberValue(finance.net_estimate, 0),
    topMerchants: merchants,
    topRegions: regions,
  };
}

function buildBrief(
  phase1: NexusSnapshot | null,
  dispatch: NexusDispatchRecommendation[],
  health: NexusMerchantHealth[],
  profit: NexusProfitIntelligence,
): NexusBriefItem[] {
  const items: NexusBriefItem[] = [];
  if (phase1 && phase1.criticalOrders > 0) {
    items.push({
      id: "critical-risk",
      tone: "critical",
      titleAr: "أولوية فورية: مخاطر حرجة",
      titleEn: "Immediate priority: critical risks",
      bodyAr: `${phase1.criticalOrders} طلبات حرجة و${phase1.criticalSignals} إشارات تحتاج تدخلًا الآن.`,
      bodyEn: `${phase1.criticalOrders} critical orders and ${phase1.criticalSignals} signals need attention now.`,
    });
  } else if (phase1) {
    items.push({
      id: "risk-clear",
      tone: "positive",
      titleAr: "لا توجد طلبات حرجة الآن",
      titleEn: "No critical orders right now",
      bodyAr: `${phase1.warningOrders} طلبات تحتاج انتباه و${phase1.watchOrders} تحت المراقبة.`,
      bodyEn: `${phase1.warningOrders} orders need attention and ${phase1.watchOrders} are under watch.`,
    });
  }

  const dispatchable = dispatch.filter((item) => item.candidates.length > 0);
  if (dispatchable.length) {
    const top = dispatchable[0];
    const driver = top.candidates[0];
    items.push({
      id: "dispatch",
      tone: top.confidence === "high" ? "positive" : "warning",
      titleAr: "اقتراح توزيع ذكي جاهز",
      titleEn: "Smart dispatch recommendation ready",
      bodyAr: `${dispatchable.length} طلبات بدون مندوب لديها توصيات. أفضل اقتراح حالي: ${top.reference} → ${driver.driverName} (${driver.score}%).`,
      bodyEn: `${dispatchable.length} unassigned orders have recommendations. Current top suggestion: ${top.reference} → ${driver.driverName} (${driver.score}%).`,
    });
  }

  const opportunity = health.find((item) => item.growthPct >= 30 && item.score >= 70);
  const attention = [...health].sort((a, b) => a.score - b.score).find((item) => item.orders30 > 0 && item.score < 65);
  if (opportunity) {
    items.push({
      id: "merchant-growth",
      tone: "positive",
      titleAr: "فرصة نمو مع تاجر",
      titleEn: "Merchant growth opportunity",
      bodyAr: `${opportunity.merchantName}: نمو ${opportunity.growthPct}% وصحة ${opportunity.score}/100 — مرشح لعرض تجاري أو زيادة حجم.`,
      bodyEn: `${opportunity.merchantName}: ${opportunity.growthPct}% growth and ${opportunity.score}/100 health — candidate for a growth offer.`,
    });
  } else if (attention) {
    items.push({
      id: "merchant-attention",
      tone: "warning",
      titleAr: "تاجر يحتاج تدخلًا",
      titleEn: "Merchant needs attention",
      bodyAr: `${attention.merchantName}: صحة ${attention.score}/100. ${attention.signalAr}`,
      bodyEn: `${attention.merchantName}: health ${attention.score}/100. ${attention.signalEn}`,
    });
  }

  items.push({
    id: "profit",
    tone: profit.authoritativeNetEstimate >= 0 ? "info" : "warning",
    titleAr: "ملخص الأداء المالي",
    titleEn: "Financial performance brief",
    bodyAr: `صافي التشغيل الموثوق: ${profit.authoritativeNetEstimate.toFixed(2)} درهم. مساهمة الطلبات المسلّمة قبل المصروفات المشتركة خلال 30 يومًا: ${profit.contributionBeforeSharedExpenses.toFixed(2)} درهم.`,
    bodyEn: `Authoritative net estimate: AED ${profit.authoritativeNetEstimate.toFixed(2)}. Delivered-order contribution before shared expenses over 30 days: AED ${profit.contributionBeforeSharedExpenses.toFixed(2)}.`,
  });

  return items.slice(0, 5);
}

export function buildNexusPhase2Snapshot(
  ordersInput: Order[] = [],
  merchants: Merchant[] = [],
  finance: FinanceSummary,
  driverProfiles: DriverProfile[] = [],
  driverLocations: DriverLocation[] = [],
  phase1: NexusSnapshot | null = null,
  now = new Date(),
): NexusPhase2Snapshot {
  const orders = ordersInput as NexusOrder[];
  const dispatch = buildDispatchRecommendations(orders, driverProfiles, driverLocations, now);
  const merchantHealth = buildMerchantHealth(orders, merchants, now);
  const profit = buildProfitIntelligence(orders, finance, now);
  return {
    generatedAt: now.toISOString(),
    dispatch,
    merchantHealth,
    merchantOpportunities: merchantHealth
      .filter((item) => (item.growthPct >= 25 && item.score >= 70) || (item.orders30 === 0 && item.score <= 50))
      .slice(0, 6),
    merchantAttention: [...merchantHealth]
      .filter((item) => item.orders30 > 0 && item.score < 70)
      .sort((a, b) => a.score - b.score)
      .slice(0, 6),
    profit,
    brief: buildBrief(phase1, dispatch, merchantHealth, profit),
  };
}
