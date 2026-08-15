import type { Order } from "../types";

export type InternationalShipment = {
  id: string;
  order_id: string;
  tracking_number?: string | null;
  public_tracking_number?: string | null;
  carrier_name?: string | null;
  normalized_status?: string | null;
  latest_description?: string | null;
  latest_location?: string | null;
  destination_city?: string | null;
  destination_country?: string | null;
  estimated_delivery_at?: string | null;
  latest_update_at?: string | null;
  last_synced_at?: string | null;
  last_webhook_at?: string | null;
  delivered_at?: string | null;
};

export type PredictiveEta = {
  orderId: string;
  reference: string;
  labelAr: string;
  labelEn: string;
  etaAt: string | null;
  etaHours: number | null;
  confidence: "high" | "medium" | "low";
  source: "carrier" | "operational" | "insufficient";
  reasonAr: string;
  reasonEn: string;
};

export type ProofIntegrity = {
  orderId: string;
  reference: string;
  score: number;
  tier: "complete" | "partial" | "weak";
  present: string[];
  missing: string[];
};

export type NexusAnomaly = {
  id: string;
  severity: "critical" | "warning" | "watch";
  reference: string;
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
};

export type CarrierWatch = {
  shipmentId: string;
  tracking: string;
  carrier: string;
  status: string;
  destination: string;
  etaAt: string | null;
  freshnessHours: number | null;
  state: "healthy" | "stale" | "critical";
  noteAr: string;
  noteEn: string;
};

export type NexusPhase3Snapshot = {
  generatedAt: string;
  predictiveEta: PredictiveEta[];
  proofIntegrity: ProofIntegrity[];
  anomalies: NexusAnomaly[];
  carrierWatch: CarrierWatch[];
  counters: {
    etaHighConfidence: number;
    proofComplete: number;
    anomaliesCritical: number;
    carriersStale: number;
  };
};

type LooseOrder = Order & Record<string, unknown>;

function text(value: unknown) { return String(value ?? "").trim(); }
function num(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function date(value: unknown) { if (!value) return null; const d = new Date(String(value)); return Number.isNaN(d.getTime()) ? null : d; }
function hoursBetween(a: Date, b: Date) { return Math.max(0, (b.getTime() - a.getTime()) / 3_600_000); }
function ref(order: LooseOrder) {
  return text(order.tracking_number) || text(order.tracking_code) || text(order.invoice_number) || text(order.coupon_number) || text(order.id) || "—";
}
function status(order: LooseOrder) { return text(order.status).toLowerCase(); }
function isTerminal(order: LooseOrder) { return ["delivered", "cancelled", "returned"].includes(status(order)); }
function latestOrderDate(order: LooseOrder) {
  return date(order.updated_at) || date(order.driver_location_updated_at) || date(order.live_location_updated_at) || date(order.created_at);
}

function buildEta(order: LooseOrder, shipment: InternationalShipment | undefined, now: Date): PredictiveEta | null {
  if (isTerminal(order)) return null;
  const reference = ref(order);
  if (shipment?.estimated_delivery_at) {
    const eta = date(shipment.estimated_delivery_at);
    if (eta) return {
      orderId: text(order.id), reference,
      labelAr: "موعد الناقل المتوقع", labelEn: "Carrier ETA",
      etaAt: eta.toISOString(), etaHours: Math.max(0, hoursBetween(now, eta)),
      confidence: "high", source: "carrier",
      reasonAr: `موعد قادم مباشرة من ${shipment.carrier_name || "الناقل الدولي"}.`,
      reasonEn: `ETA supplied directly by ${shipment.carrier_name || "the international carrier"}.`,
    };
  }

  const state = status(order);
  const baseline: Record<string, number> = {
    assigned: 6, confirmed: 8, picked_up: 5, pickedup: 5, in_transit: 4, out_for_delivery: 2,
    pending: 10, review: 12, postponed: 24,
  };
  const remaining = baseline[state];
  if (!remaining) return {
    orderId: text(order.id), reference,
    labelAr: "بيانات غير كافية", labelEn: "Insufficient data",
    etaAt: null, etaHours: null, confidence: "low", source: "insufficient",
    reasonAr: "لا توجد بيانات كافية لبناء ETA مسؤول.", reasonEn: "There is not enough data to produce a responsible ETA.",
  };

  const updated = latestOrderDate(order);
  const staleness = updated ? hoursBetween(updated, now) : 24;
  const workload = Math.max(0, Number(order.driver_active_orders || 0));
  const penalty = Math.min(6, staleness * 0.15 + workload * 0.35);
  const etaHours = Math.max(1, remaining + penalty);
  const eta = new Date(now.getTime() + etaHours * 3_600_000);
  const confidence: PredictiveEta["confidence"] = staleness <= 1 ? "medium" : "low";
  return {
    orderId: text(order.id), reference,
    labelAr: "تقدير تشغيلي", labelEn: "Operational estimate",
    etaAt: eta.toISOString(), etaHours, confidence, source: "operational",
    reasonAr: `تقدير محافظ مبني على الحالة الحالية (${state || "غير محددة"}) وحداثة التحديث، وليس وعد تسليم.`,
    reasonEn: `Conservative estimate based on current status (${state || "unknown"}) and update freshness; not a delivery promise.`,
  };
}

function buildProof(order: LooseOrder): ProofIntegrity | null {
  if (status(order) !== "delivered") return null;
  const checks = [
    ["photo", Boolean(text(order.delivery_photo_url) || text(order.delivery_photo) || text(order.proof_photo_url))],
    ["signature", Boolean(text(order.signature_url) || text(order.delivery_signature_url) || text(order.signature))],
    ["gps", num(order.delivered_lat) !== null && num(order.delivered_lng) !== null],
    ["time", Boolean(date(order.delivered_at) || date(order.updated_at))],
  ] as const;
  const present = checks.filter(([, ok]) => ok).map(([name]) => name);
  const missing = checks.filter(([, ok]) => !ok).map(([name]) => name);
  const score = Math.round((present.length / checks.length) * 100);
  return { orderId: text(order.id), reference: ref(order), score, tier: score >= 100 ? "complete" : score >= 50 ? "partial" : "weak", present, missing };
}

function buildAnomalies(order: LooseOrder, now: Date): NexusAnomaly[] {
  const out: NexusAnomaly[] = [];
  const reference = ref(order);
  const state = status(order);
  const updated = latestOrderDate(order);
  const age = updated ? hoursBetween(updated, now) : 999;
  if (!isTerminal(order) && age >= 12) out.push({ id:`stale:${order.id}`, severity: age >= 24 ? "critical" : "warning", reference,
    titleAr:"توقف تحديث تشغيلي", titleEn:"Operational update stalled",
    detailAr:`لا يوجد تحديث منذ ${Math.floor(age)} ساعة.`, detailEn:`No operational update for ${Math.floor(age)}h.` });
  if (state === "delivered" && !text(order.financial_posted_at)) out.push({ id:`posted:${order.id}`, severity:"critical", reference,
    titleAr:"تسليم بدون ترحيل مالي", titleEn:"Delivered without financial posting",
    detailAr:"الحالة مسلّم ولا يوجد financial_posted_at.", detailEn:"Order is delivered without financial_posted_at." });
  const cod = Number(order.cod_amount || 0); const collected = Number(order.collected_amount || 0);
  if (state === "delivered" && cod > 0 && collected + 0.01 < cod) out.push({ id:`cod:${order.id}`, severity:"critical", reference,
    titleAr:"فجوة تحصيل بعد التسليم", titleEn:"Collection gap after delivery",
    detailAr:`COD ${cod.toFixed(2)} مقابل محصل ${collected.toFixed(2)}.`, detailEn:`COD ${cod.toFixed(2)} vs collected ${collected.toFixed(2)}.` });
  return out;
}

function buildCarrierWatch(item: InternationalShipment, now: Date): CarrierWatch {
  const latest = date(item.latest_update_at) || date(item.last_webhook_at) || date(item.last_synced_at);
  const freshnessHours = latest ? hoursBetween(latest, now) : null;
  const normalized = text(item.normalized_status).toLowerCase();
  const delivered = normalized === "delivered" || Boolean(item.delivered_at);
  const state: CarrierWatch["state"] = delivered ? "healthy" : freshnessHours === null || freshnessHours >= 24 ? "critical" : freshnessHours >= 8 ? "stale" : "healthy";
  return {
    shipmentId: item.id,
    tracking: text(item.public_tracking_number) || text(item.tracking_number) || "—",
    carrier: text(item.carrier_name) || "Carrier",
    status: normalized || "unknown",
    destination: [text(item.destination_city), text(item.destination_country)].filter(Boolean).join(", ") || "—",
    etaAt: item.estimated_delivery_at || null,
    freshnessHours,
    state,
    noteAr: state === "healthy" ? "تحديثات الناقل ضمن النطاق الطبيعي." : state === "stale" ? "التحديث الدولي متأخر ويحتاج متابعة." : "لا توجد تحديثات حديثة كافية؛ راجع المزامنة/الناقل.",
    noteEn: state === "healthy" ? "Carrier updates are within the normal freshness window." : state === "stale" ? "International updates are delayed and should be reviewed." : "No sufficiently recent carrier update; review sync/carrier status.",
  };
}

export function buildNexusPhase3Snapshot(orders: Order[], shipments: InternationalShipment[], now = new Date()): NexusPhase3Snapshot {
  const loose = orders as LooseOrder[];
  const shipmentByOrder = new Map(shipments.map((item) => [text(item.order_id), item]));
  const predictiveEta = loose.map((order) => buildEta(order, shipmentByOrder.get(text(order.id)), now)).filter(Boolean) as PredictiveEta[];
  predictiveEta.sort((a,b) => (a.etaHours ?? 9999) - (b.etaHours ?? 9999));
  const proofIntegrity = loose.map(buildProof).filter(Boolean) as ProofIntegrity[];
  proofIntegrity.sort((a,b) => a.score - b.score);
  const anomalies = loose.flatMap((order) => buildAnomalies(order, now));
  const severity = { critical: 3, warning: 2, watch: 1 } as const;
  anomalies.sort((a,b) => severity[b.severity] - severity[a.severity]);
  const carrierWatch = shipments.map((item) => buildCarrierWatch(item, now));
  carrierWatch.sort((a,b) => ({critical:3, stale:2, healthy:1}[b.state] - {critical:3, stale:2, healthy:1}[a.state]));
  return {
    generatedAt: now.toISOString(), predictiveEta, proofIntegrity, anomalies, carrierWatch,
    counters: {
      etaHighConfidence: predictiveEta.filter((x) => x.confidence === "high").length,
      proofComplete: proofIntegrity.filter((x) => x.tier === "complete").length,
      anomaliesCritical: anomalies.filter((x) => x.severity === "critical").length,
      carriersStale: carrierWatch.filter((x) => x.state !== "healthy").length,
    },
  };
}
