import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { Building2, Globe2, Loader2, LockKeyhole, Mail, MessageCircle, Phone, ShieldCheck, Store } from "lucide-react";
import { useAppContext } from "../../lib/AppContext";
import companyMeta from "../../data/companyMeta";
import { calculateDeliveryPrice, supabase } from "../../supabase";
import type { Merchant, Order, OrderStatusHistoryItem } from "../../types";
import TrackingMap from "../tracking/TrackingMap";
import { exportOrderPDF } from "../../lib/exportUtils";
import { buildAdminCsv, buildAdminPdf } from "../../lib/adminPdfExport";
import {
  MerchantPortalShell,
  MerchantSectionRenderer,
  type MerchantAddressBookEntryViewModel,
  type MerchantAnalyticsViewModel,
  type MerchantBranchViewModel,
  type MerchantCodSummaryViewModel,
  type MerchantCodTransactionViewModel,
  type MerchantConnectionViewModel,
  type MerchantDocumentViewModel,
  type MerchantIntegrationViewModel,
  type MerchantInvoiceViewModel,
  type MerchantMetricViewModel,
  type MerchantNavigate,
  type MerchantNavigationPayloadMap,
  type MerchantNotificationViewModel,
  type MerchantOrderFormDraft,
  type MerchantOrderViewModel,
  type MerchantPickupRequestViewModel,
  type MerchantPortalCallbacks,
  type MerchantPortalData,
  type MerchantProfileViewModel,
  type MerchantSectionId,
  type MerchantSettlementViewModel,
  type MerchantStatementViewModel,
  type MerchantSupportTicketViewModel,
  type MerchantTeamMemberViewModel,
  type MerchantTimelineEventViewModel,
  type MerchantTransactionViewModel,
  type MerchantWalletViewModel,
} from "../../portal-designs/merchant";
import "../../styles/dn-merchant-command-center.css";
import "../../styles/dn-merchant-figma.css";

type MerchantRecord = Merchant & Record<string, unknown>;
type OrderRecord = Order & Record<string, unknown>;
type BusinessCenterPayload = {
  generated_at?: string;
  branches?: MerchantBranchViewModel[];
  pickup_requests?: MerchantPickupRequestViewModel[];
  address_book?: MerchantAddressBookEntryViewModel[];
  documents?: MerchantDocumentViewModel[];
  team?: MerchantTeamMemberViewModel[];
  support_tickets?: MerchantSupportTicketViewModel[];
  cod_collections?: Array<Record<string, unknown>>;
  statement_entries?: Array<Record<string, unknown>>;
  notifications?: MerchantNotificationViewModel[];
  import_batches?: Array<Record<string, unknown>>;
};

const ACTIVE = new Set(["pending", "confirmed", "assigned", "accepted", "heading_to_pickup", "arrived_at_pickup", "picked_up", "in_transit", "out_for_delivery", "arrived_at_customer"]);
const CLOSED = new Set(["delivered", "cancelled", "returned", "failed", "delivery_failed"]);
const clean = (value: unknown) => String(value ?? "").trim();
const numberOrNull = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? n : null; };
const statusOf = (value: unknown) => clean(value).toLowerCase().replace(/[\s-]+/g, "_") || "pending";
const errorMessage = (error: unknown, isArabic: boolean) => {
  const raw = error instanceof Error ? error.message : clean((error as { message?: unknown })?.message || error);
  if (/invalid login|credentials|password/i.test(raw)) return isArabic ? "بيانات الدخول غير صحيحة." : "The sign-in details are not correct.";
  if (/merchant_profile_not_found/i.test(raw)) return isArabic ? "لا يوجد ملف تاجر مرتبط بهذا الحساب." : "No merchant profile is linked to this account.";
  if (/merchant_identity_ambiguous/i.test(raw)) return isArabic ? "بيانات الحساب مرتبطة بأكثر من متجر. تواصل مع الدعم." : "This identity matches more than one store. Contact support.";
  if (/not_authenticated|jwt|session/i.test(raw)) return isArabic ? "انتهت الجلسة. سجّل الدخول مرة أخرى." : "Your session expired. Please sign in again.";
  return isArabic ? "تعذر إكمال العملية حالياً. أعد المحاولة." : "The operation could not be completed. Please retry.";
};

function recordFrom(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function arrayFrom<T>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values;
}

function parseMerchantCsv(text: string, columnMapping: Record<string, string>) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  const targetFor = (header: string) => columnMapping[header] || columnMapping[header.toLowerCase()] || header;
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      const target = targetFor(header);
      if (target) row[target] = cells[index] || "";
      return row;
    }, {});
  });
}
function reference(order: OrderRecord) { return clean(order.tracking_code || order.tracking_number || order.invoice_number || order.id); }
function orderAmount(order: OrderRecord) { return numberOrNull(order.total_price ?? order.total ?? order.total_amount ?? order.amount ?? order.delivery_price); }
function codAmount(order: OrderRecord) { return numberOrNull(order.cod_amount ?? order.cash_on_delivery ?? order.cod); }
function collectedAmount(order: OrderRecord) { const explicit = numberOrNull(order.collected_amount); if (explicit !== null) return explicit; return statusOf(order.status) === "delivered" || order.financial_posted_at ? codAmount(order) : 0; }

function mapMerchant(merchant: MerchantRecord): MerchantProfileViewModel {
  return {
    id: merchant.id,
    merchantCode: clean(merchant.merchant_code),
    tradeName: clean(merchant.trade_name) || "DAY NIGHT Merchant",
    ownerName: clean(merchant.owner_name),
    logoUrl: clean(merchant.logo_url),
    phone: clean(merchant.phone),
    alternatePhone: clean(merchant.alt_phone),
    email: clean(merchant.email),
    businessType: clean(merchant.business_type),
    emirate: clean(merchant.emirate),
    city: clean(merchant.city),
    address: clean(merchant.address),
    pickupAddress: clean(merchant.pickup_address),
    licenseNumber: clean(merchant.license_number),
    licenseExpiry: clean(merchant.license_expiry),
    trn: clean(merchant.trn || merchant.tax_number),
    bankName: clean(merchant.bank_name),
    maskedIban: clean(merchant.iban),
    settlementCycle: clean(merchant.settlement_cycle),
    defaultPaymentMethod: clean(merchant.default_payment_method),
    status: clean(merchant.status) || "active",
    portalAccessStatus: clean(merchant.portal_access_status) || "active",
    codEnabled: merchant.cod_enabled !== false,
    notes: clean(merchant.notes),
    createdAt: clean(merchant.created_at),
    updatedAt: clean(merchant.updated_at),
  };
}


function mapBranch(row: Record<string, unknown>): MerchantBranchViewModel {
  return {
    id: clean(row.id),
    name: clean(row.name),
    code: clean(row.code),
    contactName: clean(row.contact_name ?? row.contactName),
    phone: clean(row.phone),
    email: clean(row.email),
    emirate: clean(row.emirate),
    city: clean(row.city),
    address: clean(row.address),
    workingHours: clean(row.working_hours ?? row.workingHours),
    pickupInstructions: clean(row.pickup_instructions ?? row.pickupInstructions),
    isDefault: Boolean(row.is_default ?? row.isDefault),
    active: row.active !== false,
  };
}

function mapPickupRequest(row: Record<string, unknown>): MerchantPickupRequestViewModel {
  return {
    id: clean(row.id),
    branchName: clean(row.branch_name ?? row.branchName),
    pickupAddress: clean(row.pickup_address ?? row.pickupAddress),
    requestedDate: clean(row.requested_date ?? row.requestedDate),
    timeWindow: clean(row.time_window ?? row.timeWindow),
    shipmentCount: numberOrNull(row.shipment_count ?? row.shipmentCount) ?? undefined,
    pieceCount: numberOrNull(row.piece_count ?? row.pieceCount) ?? undefined,
    status: statusOf(row.status),
    driverName: clean(row.driver_name ?? row.driverName),
    notes: clean(row.notes),
    updatedAt: clean(row.updated_at ?? row.updatedAt),
  };
}

function mapAddressBookEntry(row: Record<string, unknown>): MerchantAddressBookEntryViewModel {
  return {
    id: clean(row.id),
    recipientName: clean(row.recipient_name ?? row.recipientName),
    phone: clean(row.phone),
    alternatePhone: clean(row.alternate_phone ?? row.alternatePhone),
    email: clean(row.email),
    emirate: clean(row.emirate),
    city: clean(row.city),
    area: clean(row.area),
    address: clean(row.address),
    building: clean(row.building),
    floor: clean(row.floor),
    landmark: clean(row.landmark),
    notes: clean(row.notes),
    tags: arrayFrom<string>(row.tags),
  };
}

function documentStatus(value: unknown): MerchantDocumentViewModel["status"] {
  const status = statusOf(value);
  return ["valid", "expiring_soon", "expired", "under_review", "rejected", "missing"].includes(status)
    ? status as MerchantDocumentViewModel["status"]
    : "under_review";
}

function mapDocument(row: Record<string, unknown>): MerchantDocumentViewModel {
  return {
    id: clean(row.id),
    type: clean(row.document_type ?? row.type),
    number: clean(row.document_number ?? row.number),
    issueDate: clean(row.issue_date ?? row.issueDate),
    expiryDate: clean(row.expiry_date ?? row.expiryDate),
    status: documentStatus(row.status),
    fileUrl: clean(row.file_url ?? row.fileUrl ?? row.file_path),
    reviewNote: clean(row.review_note ?? row.reviewNote),
  };
}

function mapTeamMember(row: Record<string, unknown>): MerchantTeamMemberViewModel {
  return {
    id: clean(row.id),
    name: clean(row.name),
    email: clean(row.email),
    phone: clean(row.phone),
    role: clean(row.role) || "viewer",
    status: statusOf(row.status),
    lastActiveAt: clean(row.last_active_at ?? row.lastActiveAt),
    branchNames: arrayFrom<string>(row.branch_names ?? row.branchNames),
    permissions: arrayFrom<string>(row.permissions),
  };
}

function mapSupportTicket(row: Record<string, unknown>): MerchantSupportTicketViewModel {
  return {
    id: clean(row.id),
    category: clean(row.category),
    priority: clean(row.priority) || "normal",
    subject: clean(row.subject),
    message: clean(row.message),
    status: statusOf(row.status),
    createdAt: clean(row.created_at ?? row.createdAt),
    updatedAt: clean(row.updated_at ?? row.updatedAt),
    orderId: clean(row.order_id ?? row.orderId),
    settlementId: clean(row.settlement_id ?? row.settlementId),
    response: clean(row.response ?? row.public_response),
  };
}

function mapNotification(row: Record<string, unknown>): MerchantNotificationViewModel {
  return {
    id: clean(row.id),
    type: clean(row.type ?? row.notification_type) || "system",
    titleAr: clean(row.titleAr ?? row.title_ar),
    titleEn: clean(row.titleEn ?? row.title_en),
    messageAr: clean(row.messageAr ?? row.message_ar),
    messageEn: clean(row.messageEn ?? row.message_en),
    createdAt: clean(row.createdAt ?? row.created_at),
    read: Boolean(row.read ?? row.read_at),
    priority: (clean(row.priority) || "normal") as MerchantNotificationViewModel["priority"],
    relatedEntityId: clean(row.relatedEntityId ?? row.related_entity_id),
  };
}

function mapOrder(order: OrderRecord): MerchantOrderViewModel {
  return {
    id: order.id,
    trackingNumber: reference(order),
    invoiceNumber: clean(order.invoice_number || order.invoiceNumber),
    couponNumber: clean(order.coupon_number),
    merchantReference: clean(order.merchant_reference || order.reference_number),
    status: statusOf(order.status),
    recipientName: clean(order.receiver_name || order.customer_name) || "—",
    recipientPhone: clean(order.receiver_phone || order.customer_phone),
    recipientAlternatePhone: clean(order.receiver_alt_phone),
    recipientEmail: clean(order.receiver_email),
    deliveryEmirate: clean(order.receiver_emirate || order.delivery_emirate),
    deliveryCity: clean(order.receiver_city),
    deliveryArea: clean(order.receiver_area || order.delivery_area),
    deliveryAddress: clean(order.receiver_address),
    deliveryLandmark: clean(order.receiver_landmark),
    pickupBranch: clean(order.pickup_branch || order.branch_name),
    pickupAddress: clean(order.sender_address),
    senderName: clean(order.sender_name),
    senderPhone: clean(order.sender_phone),
    serviceType: clean(order.service_type),
    packageType: clean(order.package_type),
    packageDescription: clean(order.package_description),
    pieces: numberOrNull(order.pieces) ?? undefined,
    weight: numberOrNull(order.weight) ?? undefined,
    fragile: Boolean(order.fragile),
    sensitive: Boolean(order.temperature_sensitive || order.sensitive),
    paymentMethod: clean(order.payment_method),
    codAmount: codAmount(order),
    collectedAmount: collectedAmount(order),
    deliveryFee: numberOrNull(order.delivery_fee ?? order.delivery_price),
    merchantDue: numberOrNull(order.merchant_due),
    goodsValue: numberOrNull(order.goods_value ?? order.product_value),
    currency: clean(order.currency) || "AED",
    driverName: clean(order.driver_name),
    driverPhone: clean(order.driver_phone),
    createdAt: clean(order.created_at),
    updatedAt: clean(order.updated_at),
    lastLocationAt: clean(order.driver_location_updated_at || order.live_location_updated_at) || null,
    pickupLat: numberOrNull(order.pickup_lat ?? order.sender_lat),
    pickupLng: numberOrNull(order.pickup_lng ?? order.sender_lng),
    deliveryLat: numberOrNull(order.delivery_lat ?? order.receiver_lat),
    deliveryLng: numberOrNull(order.delivery_lng ?? order.receiver_lng),
    driverLat: numberOrNull(order.driver_lat ?? order.current_lat ?? order.live_lat),
    driverLng: numberOrNull(order.driver_lng ?? order.current_lng ?? order.live_lng),
    notes: clean(order.notes),
  };
}

function mapTimeline(order?: OrderRecord | null): MerchantTimelineEventViewModel[] {
  const history = arrayFrom<OrderStatusHistoryItem>(order?.status_history);
  if (history.length) return history.map((entry, index) => ({ id: entry.id || `${order?.id}-${index}`, status: statusOf(entry.status), labelAr: statusOf(entry.status), labelEn: statusOf(entry.status).replaceAll("_", " "), note: entry.note || null, timestamp: entry.created_at || entry.updated_at || entry.timestamp || entry.date || null, source: "live" }));
  if (!order) return [];
  return [{ id: `${order.id}-current`, status: statusOf(order.status), labelAr: statusOf(order.status), labelEn: statusOf(order.status).replaceAll("_", " "), note: clean(order.notes), timestamp: clean(order.updated_at || order.created_at), source: "live" }];
}

function emptyAnalytics(): MerchantAnalyticsViewModel { return { orderVolume: [], statusDistribution: [], topCities: [], successRate: null, failureRate: null, returnRate: null, cancellationRate: null, averageDeliveryHours: null, codShare: null, averageCod: null, source: "unavailable" }; }
function deriveAnalytics(orders: MerchantOrderViewModel[]): MerchantAnalyticsViewModel {
  if (!orders.length) return emptyAnalytics();
  const count = orders.length;
  const byStatus = new Map<string, number>(); const byCity = new Map<string, number>(); const byDay = new Map<string, number>();
  let codCount = 0; let codTotal = 0; let deliveryHoursTotal = 0; let deliveryHoursCount = 0;
  for (const order of orders) {
    byStatus.set(order.status, (byStatus.get(order.status) || 0) + 1);
    if (order.deliveryCity) byCity.set(order.deliveryCity, (byCity.get(order.deliveryCity) || 0) + 1);
    const day = order.createdAt ? new Date(order.createdAt).toISOString().slice(0, 10) : "Unknown"; byDay.set(day, (byDay.get(day) || 0) + 1);
    if ((order.codAmount || 0) > 0) { codCount++; codTotal += order.codAmount || 0; }
    if (order.status === "delivered" && order.createdAt && order.updatedAt) { const h = (new Date(order.updatedAt).getTime() - new Date(order.createdAt).getTime()) / 3_600_000; if (h >= 0 && Number.isFinite(h)) { deliveryHoursTotal += h; deliveryHoursCount++; } }
  }
  const pct = (statuses: string[]) => (orders.filter(order => statuses.includes(order.status)).length / count) * 100;
  return { orderVolume: [...byDay].slice(-14).map(([label,value])=>({label,value})), statusDistribution:[...byStatus].map(([status,value])=>({status,value})), topCities:[...byCity].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([city,value])=>({city,value})), successRate:pct(["delivered"]), failureRate:pct(["failed","delivery_failed"]), returnRate:pct(["returned","return_requested"]), cancellationRate:pct(["cancelled"]), averageDeliveryHours:deliveryHoursCount?deliveryHoursTotal/deliveryHoursCount:null, codShare:(codCount/count)*100, averageCod:codCount?codTotal/codCount:null, source:"derived" };
}

export default function MerchantPortalCommandCenter() {
  const { language, theme, toggleLanguage, toggleTheme } = useAppContext();
  const isArabic = language === "ar"; const isDark = theme === "dark";
  const [user, setUser] = useState<User | null>(null); const [authLoading, setAuthLoading] = useState(true); const [authBusy, setAuthBusy] = useState(false);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [phone, setPhone] = useState(""); const [otp, setOtp] = useState(""); const [authError, setAuthError] = useState(""); const [authNotice, setAuthNotice] = useState("");
  const [merchantRows, setMerchantRows] = useState<MerchantRecord[]>([]); const [rawOrders, setRawOrders] = useState<OrderRecord[]>([]); const [business, setBusiness] = useState<BusinessCenterPayload>({});
  const [loading, setLoading] = useState(false); const [dataError, setDataError] = useState(""); const [lastSync, setLastSync] = useState<string | null>(null); const [realtime, setRealtime] = useState<MerchantConnectionViewModel>({ state: "unavailable" });
  const [section, setSection] = useState<MerchantSectionId>("dashboard"); const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null); const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { if (!supabase) { setAuthLoading(false); return; } let mounted = true; supabase.auth.getSession().then(({data})=>{if(mounted){setUser(data.session?.user||null);setAuthLoading(false)}}); const {data}=supabase.auth.onAuthStateChange((_event,session)=>{setUser(session?.user||null);setAuthLoading(false)}); return()=>{mounted=false;data.subscription.unsubscribe()}; }, []);

  const loadData = useCallback(async (activeUser: User) => {
    if (!supabase) return; setLoading(true); setRefreshing(true); setDataError("");
    try {
      let profile = await supabase.rpc("merchant_get_session_profile");
      let p = recordFrom(profile.data); let merchants = arrayFrom<MerchantRecord>(p.merchants);
      if (!merchants.length) { const claim=await supabase.rpc("merchant_claim_approved_account"); if (claim.error && !/not_approved/i.test(claim.error.message)) throw claim.error; profile=await supabase.rpc("merchant_get_session_profile"); p=recordFrom(profile.data); merchants=arrayFrom<MerchantRecord>(p.merchants); }
      if (profile.error) throw profile.error;
      setMerchantRows(merchants);
      if (!merchants.length) { setRawOrders([]); return; }
      const ordersResult=await supabase.rpc("merchant_portal_orders",{p_limit:250}); if(ordersResult.error) throw ordersResult.error; const op=recordFrom(ordersResult.data); const orders=arrayFrom<OrderRecord>(op.orders); setRawOrders(orders);
      const center=await supabase.rpc("merchant_portal_business_center"); if(!center.error) setBusiness(recordFrom(center.data) as BusinessCenterPayload); else setBusiness({});
      const now=new Date().toISOString(); setLastSync(now); setRealtime({state:"connected",lastSuccessfulSyncAt:now});
    } catch(error){setDataError(errorMessage(error,isArabic));setRealtime(current=>({state:navigator.onLine?"stale":"offline",lastSuccessfulSyncAt:current.lastSuccessfulSyncAt,messageAr:"تعذر تحديث البيانات الحية.",messageEn:"Live data refresh failed."}))}
    finally{setLoading(false);setRefreshing(false)}
  },[isArabic]);

  useEffect(()=>{if(user)void loadData(user);else{setMerchantRows([]);setRawOrders([]);setBusiness({});}},[user,loadData]);
  useEffect(()=>{if(!supabase||!user||!merchantRows.length)return;const channel=supabase.channel(`merchant-command-${user.id}`).on("postgres_changes",{event:"*",schema:"public",table:"orders"},()=>void loadData(user)).on("postgres_changes",{event:"UPDATE",schema:"public",table:"merchants"},()=>void loadData(user)).subscribe(status=>setRealtime(current=>({state:status==="SUBSCRIBED"?"connected":status==="CHANNEL_ERROR"?"reconnecting":current.state,lastSuccessfulSyncAt:current.lastSuccessfulSyncAt})));return()=>{void supabase?.removeChannel(channel)}},[user,merchantRows.length,loadData]);
  useEffect(()=>{const offline=()=>setRealtime(current=>({...current,state:"offline"}));const online=()=>{setRealtime(current=>({...current,state:"reconnecting"}));if(user)void loadData(user)};window.addEventListener("offline",offline);window.addEventListener("online",online);return()=>{window.removeEventListener("offline",offline);window.removeEventListener("online",online)}},[user,loadData]);

  async function passwordSignIn(event:FormEvent){event.preventDefault();if(!supabase)return;setAuthBusy(true);setAuthError("");const {error}=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password});if(error)setAuthError(errorMessage(error,isArabic));setAuthBusy(false)}
  async function oauth(){if(!supabase)return;setAuthBusy(true);const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${window.location.origin}/merchant`}});if(error){setAuthError(errorMessage(error,isArabic));setAuthBusy(false)}}
  async function magic(){if(!supabase||!email.trim())return;setAuthBusy(true);const {error}=await supabase.auth.signInWithOtp({email:email.trim().toLowerCase(),options:{emailRedirectTo:`${window.location.origin}/merchant`}});setAuthNotice(error?"":isArabic?"تم إرسال رابط الدخول.":"Sign-in link sent.");if(error)setAuthError(errorMessage(error,isArabic));setAuthBusy(false)}
  async function sendOtp(){if(!supabase||!phone.trim())return;setAuthBusy(true);const {error}=await supabase.auth.signInWithOtp({phone:phone.trim()});setAuthNotice(error?"":isArabic?"تم إرسال الرمز.":"Verification code sent.");if(error)setAuthError(errorMessage(error,isArabic));setAuthBusy(false)}
  async function verifyOtp(){if(!supabase||!phone.trim()||!otp.trim())return;setAuthBusy(true);const {error}=await supabase.auth.verifyOtp({phone:phone.trim(),token:otp.trim(),type:"sms"});if(error)setAuthError(errorMessage(error,isArabic));setAuthBusy(false)}

  const merchant=merchantRows[0] ? mapMerchant(merchantRows[0]) : null; const orders=useMemo(()=>rawOrders.map(mapOrder),[rawOrders]);
  const selectedRaw=rawOrders.find(order=>order.id===selectedOrderId)||rawOrders.find(order=>ACTIVE.has(statusOf(order.status)))||rawOrders[0]||null;
  const selectedOrder=selectedRaw?mapOrder(selectedRaw):null;
  const navigate:MerchantNavigate=(target,payload)=>{setSection(target);if(target==="order_details")setSelectedOrderId((payload as MerchantNavigationPayloadMap["order_details"]).orderId);if(target==="tracking"){const p=payload as MerchantNavigationPayloadMap["tracking"];const found=rawOrders.find(o=>o.id===p?.orderId||reference(o)===p?.trackingNumber);if(found)setSelectedOrderId(found.id)}};

  const codTransactions=useMemo<MerchantCodTransactionViewModel[]>(()=>{const live=arrayFrom<Record<string,unknown>>(business.cod_collections);return live.length?live.map(row=>({id:clean(row.id),trackingNumber:clean(row.tracking_number),recipientName:clean(row.recipient_name)||orders.find(order=>order.id===clean(row.order_id))?.recipientName||"—",codAmount:numberOrNull(row.cod_amount),collectedAmount:numberOrNull(row.collected_amount),status:statusOf(row.status),collectedAt:clean(row.collection_date),settlementId:clean(row.settlement_id)||null,note:clean(row.notes)||null,currency:"AED"})):orders.filter(o=>(o.codAmount||0)>0).map(o=>({id:o.id,trackingNumber:o.trackingNumber,recipientName:o.recipientName,codAmount:o.codAmount||0,collectedAmount:o.collectedAmount||0,status:o.status,collectedAt:o.updatedAt,settlementId:null,note:o.notes,currency:"AED"}))},[business.cod_collections,orders]);
  const derivedCod=useMemo<MerchantCodSummaryViewModel>(()=>{
    const hasLive=arrayFrom<Record<string,unknown>>(business.cod_collections).length>0;
    const total=(status:string[])=>codTransactions.filter(item=>status.includes(item.status)).reduce((sum,item)=>sum+(item.codAmount||0),0);
    const collected=codTransactions.reduce((sum,item)=>sum+(item.collectedAmount||0),0);
    const pending=codTransactions.reduce((sum,item)=>sum+Math.max(0,(item.codAmount||0)-(item.collectedAmount||0)),0);
    return{pending,collected,available:hasLive?total(["collected","available"]):null,settled:hasLive?total(["settled","reconciled"]):null,onHold:hasLive?total(["on_hold","disputed"]):null,overdue:hasLive?total(["overdue"]):null,discrepancy:hasLive?codTransactions.reduce((sum,item)=>sum+Math.max(0,(item.collectedAmount||0)-(item.codAmount||0)),0):null,orderCount:codTransactions.length,currency:"AED",source:hasLive?"live":"derived",lastUpdatedAt:lastSync};
  },[business.cod_collections,codTransactions,lastSync]);
  const statementEntries=arrayFrom<Record<string,unknown>>(business.statement_entries);
  const statements:MerchantStatementViewModel[]=statementEntries.length?[{id:"current",periodLabelAr:"كشف الحساب الحالي",periodLabelEn:"Current statement",openingBalance:null,closingBalance:numberOrNull(statementEntries.at(-1)?.balance),entries:statementEntries.map((r,i)=>({id:clean(r.id)||String(i),date:clean(r.entry_date),type:clean(r.entry_type),reference:clean(r.tracking_number),descriptionAr:clean(r.notes)||clean(r.entry_type),descriptionEn:clean(r.notes)||clean(r.entry_type),debit:numberOrNull(r.debit),credit:numberOrNull(r.credit),balance:numberOrNull(r.balance),currency:"AED"})),status:"posted",generatedAt:lastSync||undefined,currency:"AED",source:"live"}]:[];
  const invoices:MerchantInvoiceViewModel[]=orders.filter(o=>o.invoiceNumber).map(o=>({id:o.invoiceNumber!,invoiceNumber:o.invoiceNumber!,orderId:o.id,trackingNumber:o.trackingNumber,date:o.createdAt,amount:o.deliveryFee,status:o.status,currency:"AED"}));
  const settlements:MerchantSettlementViewModel[]=useMemo(()=>{
    const groups=new Map<string,{start:string;end:string;cod:number;fees:number;adjustments:number;refunds:number;net:number}>();
    for(const row of statementEntries){
      const date=clean(row.entry_date||row.created_at); if(!date)continue;
      const month=date.slice(0,7); const current=groups.get(month)||{start:`${month}-01`,end:`${month}-31`,cod:0,fees:0,adjustments:0,refunds:0,net:0};
      const debit=numberOrNull(row.debit)||0; const credit=numberOrNull(row.credit)||0; const type=statusOf(row.entry_type);
      if(type.includes("cod"))current.cod+=credit; else if(type.includes("fee"))current.fees+=debit; else if(type.includes("refund")||type.includes("return"))current.refunds+=debit; else current.adjustments+=credit-debit;
      current.net+=credit-debit; groups.set(month,current);
    }
    return [...groups.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([month,value])=>({id:`statement-${month}`,periodStart:value.start,periodEnd:value.end,codTotal:value.cod,deliveryFees:value.fees,adjustments:value.adjustments,refunds:value.refunds,netPayable:value.net,status:"under_review",currency:"AED",source:"derived"}));
  },[statementEntries]);
  const wallet:MerchantWalletViewModel={available:null,pending:null,reserved:null,totalCredits:null,totalDebits:null,currency:"AED",source:"unavailable",lastUpdatedAt:lastSync};
  const transactions:MerchantTransactionViewModel[]=statementEntries.map((r,i)=>({id:clean(r.id)||String(i),type:clean(r.entry_type),amount:(numberOrNull(r.credit)||0)-(numberOrNull(r.debit)||0),reference:clean(r.tracking_number),orderId:clean(r.order_id),status:clean(r.status)||"posted",date:clean(r.entry_date),balanceAfter:numberOrNull(r.balance),currency:"AED"}));
  const metrics=useMemo<MerchantMetricViewModel[]>(()=>{const active=orders.filter(o=>ACTIVE.has(o.status)).length;const delivered=orders.filter(o=>o.status==="delivered").length;const attention=orders.filter(o=>["failed","delivery_failed","under_review","returned"].includes(o.status)).length;return[{id:"orders",labelAr:"إجمالي الطلبات",labelEn:"Total orders",value:orders.length,source:"live",actionSection:"orders"},{id:"active",labelAr:"طلبات نشطة",labelEn:"Active orders",value:active,source:"live",status:"good",actionSection:"orders"},{id:"delivered",labelAr:"تم التسليم",labelEn:"Delivered",value:delivered,source:"live",status:"good",actionSection:"orders"},{id:"attention",labelAr:"تحتاج مراجعة",labelEn:"Needs attention",value:attention,source:"derived",status:attention?"warning":"good",actionSection:"under_review"},{id:"cod",labelAr:"COD قيد التحصيل",labelEn:"Pending COD",value:derivedCod.pending,currency:"AED",source:"derived",actionSection:"cod"},{id:"collected",labelAr:"COD محصل",labelEn:"Collected COD",value:derivedCod.collected,currency:"AED",source:"derived",actionSection:"cod"}]},[orders,derivedCod]);
  const branches=arrayFrom<Record<string,unknown>>(business.branches).map(mapBranch); if(merchant&&!branches.length)branches.push({id:"primary",name:merchant.tradeName,code:merchant.merchantCode,contactName:merchant.ownerName,phone:merchant.phone,email:merchant.email,emirate:merchant.emirate,city:merchant.city,address:merchant.pickupAddress||merchant.address,isDefault:true,active:true});
  const analytics=useMemo(()=>deriveAnalytics(orders),[orders]);
  const notifications:MerchantNotificationViewModel[]=arrayFrom<Record<string,unknown>>(business.notifications).map(mapNotification);
  const integrations:MerchantIntegrationViewModel[]=[{id:"orders-rpc",name:"Merchant Orders API",type:"rpc",status:"connected",lastActivityAt:lastSync||undefined,descriptionAr:"طلبات المتجر المعزولة عبر merchant_id.",descriptionEn:"Merchant orders isolated by merchant_id."},{id:"tracking",name:"DAY NIGHT Live Tracking",type:"realtime",status:realtime.state==="connected"?"connected":"error",lastActivityAt:lastSync||undefined,descriptionAr:"تتبع داخلي مع Realtime وموقع المندوب عند توفره.",descriptionEn:"In-app tracking with realtime updates and driver location when available."},{id:"commerce",name:"E-commerce Webhooks",type:"webhook",status:"unavailable",descriptionAr:"لم يتم تفعيل Webhook موثوق بعد.",descriptionEn:"No authoritative webhook is enabled yet."}];
  const data:MerchantPortalData=merchant?{merchant,metrics,orders,selectedOrder,timeline:mapTimeline(selectedRaw),connection:realtime,codSummary:derivedCod,codTransactions,settlements,statements,invoices,wallet,transactions,branches,pickupRequests:arrayFrom<Record<string,unknown>>(business.pickup_requests).map(mapPickupRequest),addressBook:arrayFrom<Record<string,unknown>>(business.address_book).map(mapAddressBookEntry),documents:arrayFrom<Record<string,unknown>>(business.documents).map(mapDocument),team:arrayFrom<Record<string,unknown>>(business.team).map(mapTeamMember),notifications,supportTickets:arrayFrom<Record<string,unknown>>(business.support_tickets).map(mapSupportTicket),analytics,integrations,mapSlot:<TrackingMap order={selectedRaw as Order|null}/>,loading,error:dataError,readOnly:false}:null as never;

  const callbacks:MerchantPortalCallbacks=useMemo(()=>({
    onNavigate:navigate,
    onRefreshData:async()=>{if(user)await loadData(user)},
    onCreateOrder:async(draft:MerchantOrderFormDraft)=>{
      if(!supabase||!merchant||!user)return{success:false,error:{code:"MERCHANT_MISSING",message:isArabic?"ملف التاجر أو الجلسة غير متاح.":"The merchant profile or session is unavailable."}};
      const payload={
        source_channel:"merchant_portal",
        sender_name:draft.senderName||merchant.tradeName,
        sender_phone:draft.senderPhone||merchant.phone,
        sender_city:draft.pickupCity||merchant.city,
        sender_address:draft.pickupAddress||merchant.pickupAddress||merchant.address,
        receiver_name:draft.recipientName,
        receiver_phone:draft.recipientPhone,
        receiver_alt_phone:draft.recipientAlternatePhone,
        receiver_email:draft.recipientEmail,
        receiver_city:draft.deliveryCity,
        receiver_emirate:draft.deliveryEmirate,
        receiver_area:draft.deliveryArea,
        receiver_address:draft.deliveryAddress,
        receiver_landmark:draft.deliveryLandmark,
        package_type:draft.packageType||"parcel",
        package_description:draft.packageDescription,
        weight:draft.weight||1,
        pieces:draft.pieces||1,
        service_type:draft.serviceType||"standard",
        payment_method:draft.paymentMethod||"sender_pays",
        cod_amount:draft.codAmount||0,
        goods_value:draft.goodsValue||0,
        delivery_fee_mode:draft.deliveryFeeMode,
        notes:[draft.deliveryInstructions,draft.specialHandling].filter(Boolean).join(" · "),
        coupon_number:draft.couponNumber,
        merchant_reference:draft.merchantReference,
        fragile:Boolean(draft.fragile),
        temperature_sensitive:Boolean(draft.temperatureSensitive)
      };
      const {data:created,error}=await supabase.rpc("merchant_create_order",{p_order:payload});
      if(error)return{success:false,error:{code:"CREATE_FAILED",message:errorMessage(error,isArabic),retryable:true}};
      const row=recordFrom(created) as OrderRecord;
      const tracking=reference(row);
      if(!tracking)return{success:false,error:{code:"CREATE_UNCONFIRMED",message:isArabic?"أُرسل الطلب لكن لم يرجع النظام رقم تتبع موثوقاً.":"The order was submitted but no authoritative tracking number was returned."}};
      await loadData(user);
      return{success:true,orderId:clean(row.id)||tracking,trackingNumber:tracking,invoiceNumber:clean(row.invoice_number),amount:orderAmount(row),currency:"AED",createdAt:clean(row.created_at)||new Date().toISOString()};
    },
    onCalculatePrice:async(draft)=>{try{const raw=recordFrom(await calculateDeliveryPrice({pickupCity:draft.pickupCity,deliveryCity:draft.deliveryCity,weight:draft.weight,serviceType:draft.serviceType}));const total=numberOrNull(raw.total??raw.total_price??raw.price??raw.delivery_price);return{confirmed:total!==null,source:clean(raw.source)==="manual"?"manual":"system",baseFee:numberOrNull(raw.base_fee??raw.base_price),weightFee:numberOrNull(raw.weight_fee),serviceSurcharge:numberOrNull(raw.service_surcharge??raw.express_surcharge),remoteAreaSurcharge:numberOrNull(raw.remote_area_surcharge),discount:numberOrNull(raw.discount),tax:numberOrNull(raw.tax??raw.vat),total,currency:"AED",error:total===null?{code:"PRICE_UNCONFIRMED",message:isArabic?"تعذر تأكيد السعر.":"Pricing could not be confirmed."}:undefined}}catch(error){return{confirmed:false,source:"unavailable",currency:"AED",error:{code:"PRICING_ERROR",message:errorMessage(error,isArabic),retryable:true}}}},
    onUploadCouponImage:async(file)=>{if(!supabase||!merchant)return{success:false,error:{code:"STORAGE_UNAVAILABLE",message:isArabic?"تخزين صور الكوبون غير متاح.":"Coupon image storage is unavailable."}};const ext=(file.name.split(".").pop()||"jpg").replace(/[^a-z0-9]/gi,"").toLowerCase()||"jpg";const path=`${merchant.id}/coupons/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${ext}`;const {error}=await supabase.storage.from("merchant-coupon-images").upload(path,file,{contentType:file.type||"image/jpeg",upsert:false});if(error)return{success:false,error:{code:"COUPON_UPLOAD_FAILED",message:errorMessage(error,isArabic),retryable:true}};const signed=await supabase.storage.from("merchant-coupon-images").createSignedUrl(path,3600);return{success:true,path,url:signed.data?.signedUrl}},
    onUploadLogo:async(file)=>{if(!supabase||!merchant)return{success:false,error:{code:"STORAGE_UNAVAILABLE",message:"Merchant asset storage is unavailable."}};const ext=(file.name.split(".").pop()||"png").replace(/[^a-z0-9]/gi,"").toLowerCase()||"png";const path=`${merchant.id}/logo/${crypto.randomUUID()}.${ext}`;const {error}=await supabase.storage.from("merchant-assets").upload(path,file,{contentType:file.type||"image/png",upsert:false});if(error)return{success:false,error:{code:"LOGO_UPLOAD_FAILED",message:errorMessage(error,isArabic)}};const {data:publicData}=supabase.storage.from("merchant-assets").getPublicUrl(path);const update=await supabase.rpc("merchant_update_own_profile",{p_updates:{logo_url:publicData.publicUrl}});if(update.error)return{success:false,error:{code:"LOGO_PROFILE_UPDATE_FAILED",message:errorMessage(update.error,isArabic)}};await loadData(user!);return{success:true,path,url:publicData.publicUrl}},
    onUploadDocument:async(file,document)=>{if(!supabase||!merchant)return{success:false,error:{code:"STORAGE_UNAVAILABLE",message:"Merchant document storage is unavailable."}};const ext=(file.name.split(".").pop()||"pdf").replace(/[^a-z0-9]/gi,"").toLowerCase()||"pdf";const path=`${merchant.id}/documents/${crypto.randomUUID()}.${ext}`;const uploaded=await supabase.storage.from("merchant-documents").upload(path,file,{contentType:file.type||"application/octet-stream",upsert:false});if(uploaded.error)return{success:false,error:{code:"DOCUMENT_UPLOAD_FAILED",message:errorMessage(uploaded.error,isArabic)}};const inserted=await supabase.from("merchant_documents").insert({merchant_id:merchant.id,document_type:document.type||"additional",document_number:document.number||null,issue_date:document.issueDate||null,expiry_date:document.expiryDate||null,status:"under_review",file_path:path});if(inserted.error)return{success:false,path,error:{code:"DOCUMENT_RECORD_FAILED",message:errorMessage(inserted.error,isArabic)}};await loadData(user!);return{success:true,path}},
    onOpenOrder:(orderId)=>navigate("order_details",{orderId}),onTrackOrder:(order)=>navigate("tracking",{orderId:order.id,trackingNumber:order.trackingNumber}),
    onCancelOrder:async(orderId,reason)=>{if(!supabase)return{success:false,orderId,error:{code:"NO_BACKEND",message:"Supabase unavailable."}};const {data:r,error}=await supabase.rpc("merchant_request_order_action",{p_order_id:orderId,p_action:"cancel",p_payload:{reason}});return error?{success:false,orderId,error:{code:"CANCEL_REQUEST_FAILED",message:errorMessage(error,isArabic)}}:{success:true,orderId,newStatus:clean(recordFrom(r).order_status),updatedAt:new Date().toISOString()}},
    onRequestReturn:async(orderId,reason)=>{if(!supabase)return{success:false,orderId,error:{code:"NO_BACKEND",message:"Supabase unavailable."}};const {data:r,error}=await supabase.rpc("merchant_request_order_action",{p_order_id:orderId,p_action:"return",p_payload:{reason}});return error?{success:false,orderId,error:{code:"RETURN_REQUEST_FAILED",message:errorMessage(error,isArabic)}}:{success:true,orderId,newStatus:clean(recordFrom(r).order_status),updatedAt:new Date().toISOString()}},
    onRequestReschedule:async(orderId,date,reason)=>{if(!supabase)return{success:false,orderId,error:{code:"NO_BACKEND",message:"Supabase unavailable."}};const {data:r,error}=await supabase.rpc("merchant_request_order_action",{p_order_id:orderId,p_action:"reschedule",p_payload:{reason,requestedDate:date}});return error?{success:false,orderId,error:{code:"RESCHEDULE_REQUEST_FAILED",message:errorMessage(error,isArabic)}}:{success:true,orderId,newStatus:clean(recordFrom(r).order_status),updatedAt:new Date().toISOString()}},
    onRequestPickup:async(input)=>{if(!supabase)return{success:false,error:{code:"NO_BACKEND",message:"Supabase is unavailable."}};const {data:r,error}=await supabase.rpc("merchant_create_pickup_request",{p_request:input});return error?{success:false,error:{code:"PICKUP_FAILED",message:errorMessage(error,isArabic)}}:{success:true,request:recordFrom(r).request as MerchantPickupRequestViewModel};},
    onCreateImportPreview:async(input)=>{
      if(!supabase)return{success:false,totalRows:0,validRows:0,invalidRows:0,warnings:0,duplicateRows:0,rowErrors:[],error:{code:"NO_BACKEND",message:isArabic?"خدمة الاستيراد غير متاحة.":"The import service is unavailable."}};
      if(!input.file.name.toLowerCase().endsWith(".csv"))return{success:false,totalRows:0,validRows:0,invalidRows:0,warnings:0,duplicateRows:0,rowErrors:[],error:{code:"FORMAT_UNSUPPORTED",message:isArabic?"يدعم الالتزام المباشر CSV حالياً. احفظ ملف Excel بصيغة CSV.":"Authoritative import currently accepts CSV. Save Excel files as CSV first."}};
      const rows=parseMerchantCsv(await input.file.text(),input.columnMapping);
      if(!rows.length)return{success:false,totalRows:0,validRows:0,invalidRows:0,warnings:0,duplicateRows:0,rowErrors:[],error:{code:"EMPTY_IMPORT",message:isArabic?"الملف لا يحتوي صفوف بيانات.":"The file contains no data rows."}};
      const {data:r,error}=await supabase.rpc("merchant_create_import_preview",{p_file_name:input.file.name,p_branch_id:input.branchId||null,p_rows:rows,p_mapping:input.columnMapping});
      if(error)return{success:false,totalRows:rows.length,validRows:0,invalidRows:rows.length,warnings:0,duplicateRows:0,rowErrors:[],error:{code:"IMPORT_PREVIEW_FAILED",message:errorMessage(error,isArabic),retryable:true}};
      const result=recordFrom(r);
      return{success:Boolean(result.ok),batchId:clean(result.batch_id),totalRows:Number(result.total_rows||rows.length),validRows:Number(result.valid_rows||0),invalidRows:Number(result.invalid_rows||0),warnings:Number(result.warnings||0),duplicateRows:Number(result.duplicate_rows||0),rowErrors:arrayFrom<Record<string,unknown>>(result.row_errors).map((row)=>({row:Number(row.row||0),field:clean(row.field)||undefined,message:arrayFrom<string>(row.errors).join(", ")||clean(row.message)||"Validation error"}))};
    },
    onCommitImport:async(batchId)=>{
      if(!supabase)return{success:false,batchId,error:{code:"NO_BACKEND",message:isArabic?"خدمة الاستيراد غير متاحة.":"The import service is unavailable."}};
      const {data:r,error}=await supabase.rpc("merchant_commit_import",{p_batch_id:batchId});
      if(error)return{success:false,batchId,error:{code:"IMPORT_COMMIT_FAILED",message:errorMessage(error,isArabic),retryable:true}};
      const result=recordFrom(r); if(user)await loadData(user);
      return{success:Boolean(result.ok),batchId,importedCount:Number(result.imported_count||0),failedCount:Number(result.failed_count||0),error:result.ok?undefined:{code:"IMPORT_PARTIAL",message:isArabic?"اكتمل الاستيراد مع صفوف لم تُنشأ.":"The import completed with failed rows."}};
    },
    onDownloadInvoice:async(invoiceId)=>{
      const invoice=invoices.find((item)=>item.id===invoiceId);
      const order=orders.find((item)=>item.id===invoice?.orderId||item.trackingNumber===invoice?.trackingNumber);
      if(!invoice||!order)return{success:false,error:{code:"INVOICE_NOT_FOUND",message:isArabic?"تعذر العثور على بيانات الفاتورة والطلب.":"The invoice and order data could not be found."}};
      exportOrderPDF({
        trackingCode:order.trackingNumber,
        invoiceNumber:invoice.invoiceNumber,
        senderName:order.senderName||merchant?.tradeName||"DAY NIGHT Merchant",
        senderPhone:order.senderPhone||merchant?.phone||companyMeta.phone,
        senderCity:merchant?.city||order.pickupBranch||"Abu Dhabi",
        senderAddress:order.pickupAddress||merchant?.pickupAddress||merchant?.address||"—",
        receiverName:order.recipientName,
        receiverPhone:order.recipientPhone||"—",
        receiverCity:order.deliveryCity||"—",
        receiverAddress:order.deliveryAddress||"—",
        packageType:order.packageType||"Shipment",
        pieces:order.pieces||1,
        weight:order.weight||1,
        serviceType:order.serviceType||"standard",
        paymentMethod:order.paymentMethod||"sender_pays",
        codAmount:String(order.codAmount||""),
        deliveryFee:order.deliveryFee||0,
        notes:order.notes||"",
        createdAt:order.createdAt,
        status:order.status
      },"invoice",isArabic?"ar":"en");
      return{success:true,fileName:`${invoice.invoiceNumber}.pdf`};
    },
    onDownloadStatement:async(statementId,format)=>{
      const statement=statements.find((item)=>item.id===statementId);
      if(!statement)return{success:false,error:{code:"STATEMENT_NOT_FOUND",message:isArabic?"كشف الحساب غير موجود.":"Statement not found."}};
      const payload={
        language:isArabic?"ar" as const:"en" as const,
        sectionTitle:isArabic?statement.periodLabelAr:statement.periodLabelEn,
        totals:{
          [isArabic?"الرصيد الافتتاحي":"Opening balance"]:statement.openingBalance??"—",
          [isArabic?"الرصيد الختامي":"Closing balance"]:statement.closingBalance??"—",
          [isArabic?"عدد الحركات":"Entries"]:statement.entries.length
        },
        columns:[
          {key:"date",label:isArabic?"التاريخ":"Date"},
          {key:"type",label:isArabic?"النوع":"Type"},
          {key:"reference",label:isArabic?"المرجع":"Reference"},
          {key:"debit",label:isArabic?"مدين":"Debit"},
          {key:"credit",label:isArabic?"دائن":"Credit"},
          {key:"balance",label:isArabic?"الرصيد":"Balance"}
        ],
        rows:statement.entries,
        orientation:"landscape" as const
      };
      if(format==="csv")buildAdminCsv(payload);else await buildAdminPdf(payload);
      return{success:true,fileName:`statement-${statementId}.${format}`};
    },
    onPrintLabels:async(orderIds)=>{if(!orderIds.length)return{success:false,error:{code:"NO_ORDERS",message:"No orders selected."}};window.print();return{success:true,printedCount:orderIds.length}},
    onUpdateProfile:async(input)=>{if(!supabase)return{success:false,error:{code:"NO_BACKEND",message:"Supabase unavailable."}};const payload={trade_name:input.tradeName,owner_name:input.ownerName,phone:input.phone,alt_phone:input.alternatePhone,emirate:input.emirate,city:input.city,address:input.address,pickup_address:input.pickupAddress,logo_url:input.logoUrl,license_number:input.licenseNumber,license_expiry:input.licenseExpiry,business_type:input.businessType,trn:input.trn,default_payment_method:input.defaultPaymentMethod,cod_enabled:input.codEnabled,notes:input.notes};const {data:r,error}=await supabase.rpc("merchant_update_own_profile",{p_updates:payload});if(error)return{success:false,error:{code:"PROFILE_UPDATE_FAILED",message:errorMessage(error,isArabic)}};await loadData(user!);return{success:true,merchant:mapMerchant(recordFrom(r).merchant as MerchantRecord)}},
    onUpdateBankDetails:async(input)=>{if(!supabase)return{success:false,error:{code:"NO_BACKEND",message:"Supabase unavailable."}};const {data:r,error}=await supabase.rpc("merchant_update_bank_details",{p_updates:{bank_name:input.bankName,iban:input.maskedIban,settlement_cycle:input.settlementCycle}});return error?{success:false,error:{code:"BANK_UPDATE_FAILED",message:errorMessage(error,isArabic)}}:{success:true,merchant:mapMerchant(recordFrom(r).merchant as MerchantRecord),reviewRequired:true}},
    onSaveBranch:async(input)=>{if(!supabase)return{success:false,error:{code:"NO_BACKEND",message:"Supabase unavailable."}};const {data:r,error}=await supabase.rpc("merchant_save_branch",{p_branch:input});if(error)return{success:false,error:{code:"BRANCH_SAVE_FAILED",message:errorMessage(error,isArabic)}};if(user)await loadData(user);return{success:true,branch:mapBranch(recordFrom(recordFrom(r).branch))}},
    onSaveAddressBookEntry:async(input)=>{if(!supabase)return{success:false,error:{code:"NO_BACKEND",message:"Supabase unavailable."}};const {data:r,error}=await supabase.rpc("merchant_save_address_book_entry",{p_entry:input});if(error)return{success:false,error:{code:"ADDRESS_SAVE_FAILED",message:errorMessage(error,isArabic)}};if(user)await loadData(user);return{success:true,entry:mapAddressBookEntry(recordFrom(recordFrom(r).entry))}},
    onSaveTeamMember:async(input)=>{if(!supabase)return{success:false,error:{code:"NO_BACKEND",message:"Supabase unavailable."}};const {data:r,error}=await supabase.rpc("merchant_save_team_member",{p_member:input});if(error)return{success:false,error:{code:"TEAM_SAVE_FAILED",message:errorMessage(error,isArabic)}};if(user)await loadData(user);return{success:true,member:mapTeamMember(recordFrom(recordFrom(r).member))}},
    onMarkNotificationRead:async(notificationId)=>{if(!supabase)return{success:false,error:{code:"NO_BACKEND",message:"Supabase unavailable."}};const {error}=await supabase.rpc("merchant_mark_notification_read",{p_notification_id:notificationId});if(error)return{success:false,error:{code:"NOTIFICATION_UPDATE_FAILED",message:errorMessage(error,isArabic)}};if(user)await loadData(user);return{success:true}},
    onSubmitSupportRequest:async(input)=>{if(!supabase)return{success:false,error:{code:"NO_BACKEND",message:"Supabase unavailable."}};const {data:r,error}=await supabase.rpc("merchant_create_support_ticket",{p_ticket:input});return error?{success:false,error:{code:"SUPPORT_FAILED",message:errorMessage(error,isArabic)}}:{success:true,ticket:recordFrom(r).ticket as MerchantSupportTicketViewModel}},
    onGlobalSearch:async(query)=>{const q=query.trim().toLowerCase();const results=orders.filter(o=>[o.trackingNumber,o.invoiceNumber,o.couponNumber,o.merchantReference,o.recipientName,o.recipientPhone,o.deliveryCity,o.deliveryAddress].some(v=>clean(v).toLowerCase().includes(q))).slice(0,12).map(o=>({id:o.id,type:"order" as const,title:o.trackingNumber,subtitle:`${o.recipientName} · ${o.deliveryCity||""}`,section:"order_details"}));return{query,results}},
    onToggleLanguage:toggleLanguage,onToggleTheme:toggleTheme,onLogout:async()=>{await supabase?.auth.signOut();setUser(null)}
  }),[user,merchant,orders,rawOrders,invoices,statements,isArabic,loadData,toggleLanguage,toggleTheme]);

  if(authLoading)return <section className="dn-merchant-state-v3" dir={isArabic?"rtl":"ltr"}><Loader2 className="dn-spin"/><strong>{isArabic?"جاري تجهيز بوابة التاجر...":"Preparing merchant portal..."}</strong></section>;
  if(!user)return <section className="dn-merchant-login-v3" dir={isArabic?"rtl":"ltr"}><div className="dn-merchant-login-visual-v3"><div className="dn-merchant-login-brand-v3"><img src={companyMeta.logoUrl} alt="DAY NIGHT"/><div><small>DAY NIGHT DELIVERY SERVICES</small><h1>{isArabic?"بوابة التاجر الذكية":"Smart Merchant Portal"}</h1></div></div><p>{isArabic?"طلبات، تتبع، COD، تسويات، تقارير وإدارة كاملة للنشاط.":"Orders, tracking, COD, settlements, reports, and complete business control."}</p><div className="dn-merchant-login-services-v3"><article><Store/><strong>{isArabic?"إدارة المتجر":"Store control"}</strong></article><article><ShieldCheck/><strong>{isArabic?"دخول آمن":"Secure access"}</strong></article><article><Building2/><strong>{isArabic?"كل الفروع":"All branches"}</strong></article></div><footer><span>{companyMeta.sloganAr}</span><span>{companyMeta.sloganEn}</span></footer></div><div className="dn-merchant-login-card-v3"><header><span><Building2/></span><div><h2>{isArabic?"دخول التاجر":"Merchant sign in"}</h2><p>{isArabic?"استخدم بيانات الحساب المعتمد لدى DAY NIGHT.":"Use the account approved by DAY NIGHT."}</p></div></header><form onSubmit={passwordSignIn}><label><span>{isArabic?"البريد":"Email"}</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label><label><span>{isArabic?"كلمة المرور":"Password"}</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label><button type="submit" disabled={authBusy||!email||!password}>{authBusy?<Loader2 className="dn-spin"/>:<LockKeyhole/>}{isArabic?"دخول آمن":"Secure sign in"}</button></form><div className="dn-merchant-auth-alternatives-v3"><button type="button" onClick={()=>void oauth()} disabled={authBusy}><Globe2/>Google</button><button type="button" onClick={()=>void magic()} disabled={authBusy||!email}><Mail/>{isArabic?"رابط بالبريد":"Email link"}</button></div><div className="dn-merchant-phone-auth-v3"><label><span>{isArabic?"الهاتف":"Phone"}</span><input dir="ltr" value={phone} onChange={e=>setPhone(e.target.value)}/></label><div><input dir="ltr" value={otp} onChange={e=>setOtp(e.target.value)} placeholder={isArabic?"رمز التحقق":"Verification code"}/><button type="button" onClick={()=>void sendOtp()} disabled={authBusy||!phone}><Phone/>{isArabic?"إرسال":"Send"}</button></div><button type="button" onClick={()=>void verifyOtp()} disabled={authBusy||!otp}>{isArabic?"تأكيد الرمز":"Verify code"}</button></div>{authError?<p className="dn-merchant-message-v3 is-error">{authError}</p>:null}{authNotice?<p className="dn-merchant-message-v3 is-success">{authNotice}</p>:null}<a href={companyMeta.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle/>{isArabic?"دعم التاجر":"Merchant support"}</a></div></section>;
  if(loading&&!merchant)return <section className="dn-merchant-state-v3"><Loader2 className="dn-spin"/><strong>{isArabic?"جاري تحميل مركز أعمال التاجر...":"Loading Merchant Business Center..."}</strong></section>;
  if(!merchant)return <section className="dn-merchant-state-v3 is-warning" dir={isArabic?"rtl":"ltr"}><ShieldCheck/><h1>{isArabic?"الحساب بانتظار الربط":"Account awaiting linkage"}</h1><p>{dataError|| (isArabic?"لا يوجد ملف تاجر مرتبط بالجلسة الحالية.":"No merchant profile is linked to the current session.")}</p><a href={companyMeta.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle/>{isArabic?"تواصل مع الدعم":"Contact support"}</a></section>;
  return <MerchantPortalShell currentSection={section} data={data} callbacks={callbacks} isArabic={isArabic} isDark={isDark} companyLogoUrl={companyMeta.logoUrl} refreshing={refreshing}><MerchantSectionRenderer section={section} data={data} callbacks={callbacks} isArabic={isArabic} isDark={isDark}/></MerchantPortalShell>;
}
