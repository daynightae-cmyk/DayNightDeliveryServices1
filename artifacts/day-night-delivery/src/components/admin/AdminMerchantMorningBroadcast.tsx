import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  ExternalLink,
  History,
  Loader2,
  Megaphone,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Store,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import {
  loadMerchantMorningAudience,
  loadMerchantMorningBroadcastHealth,
  loadMerchantMorningBroadcastHistory,
  merchantMorningPreview,
  sendMerchantMorningBroadcast,
  setMerchantMorningBroadcastEnabled,
  subscribeMerchantMorningAudience,
  type MerchantMorningAudience,
  type MerchantMorningBroadcastHealth,
  type MerchantMorningBroadcastHistory,
  type MerchantMorningBroadcastResult,
  type MerchantMorningRecipient,
} from "../../services/merchantMorningBroadcastService";
import {
  markOutboundMessageStatus,
  prepareWhatsAppMessage,
} from "../../services/whatsappMessageService";
import { matchesSearchQuery } from "../../lib/searchNormalization";

const EMPTY_AUDIENCE: MerchantMorningAudience = {
  all: [],
  eligible: [],
  missingPhone: [],
  excluded: [],
};

function merchantName(merchant: MerchantMorningRecipient) {
  return String(merchant.trade_name || merchant.owner_name || merchant.merchant_code || merchant.id).trim();
}

function errorCode(error: unknown) {
  const record = error as Error & { code?: string; details?: Record<string, unknown> | null };
  return String(record?.code || record?.message || "merchant_broadcast_failed").trim();
}

function errorMessage(error: unknown, isArabic: boolean) {
  const code = errorCode(error);
  if (/whatsapp_cloud_not_configured|missing_configuration|function_unavailable/i.test(code)) {
    return isArabic
      ? "الإرسال التلقائي جاهز داخل النظام، لكن يلزم ربط بيانات WhatsApp Business الرسمية وقالب الرسالة المعتمد من Meta. يمكنك استخدام الفتح المتتابع عبر واتساب ويب مؤقتًا."
      : "Automatic sending is built, but the official WhatsApp Business credentials and approved Meta template must be connected. Use the sequential WhatsApp Web fallback meanwhile.";
  }
  if (/not_authorized|permission/i.test(code)) {
    return isArabic
      ? "هذا الحساب لا يملك صلاحية إرسال حملة التجار."
      : "This account is not authorized to send merchant broadcasts.";
  }
  if (/popup_blocked/i.test(code)) {
    return isArabic
      ? "المتصفح منع نافذة واتساب. اسمح بالنوافذ المنبثقة لموقع daynightae.com ثم أعد المحاولة."
      : "The browser blocked the WhatsApp window. Allow pop-ups for daynightae.com and try again.";
  }
  return isArabic
    ? "تعذر تنفيذ حملة التجار الآن. حدّث القائمة ثم أعد المحاولة."
    : "The merchant broadcast could not be completed. Refresh the audience and try again.";
}

function Stat({
  label,
  value,
  Icon,
  tone = "blue",
}: {
  label: string;
  value: number;
  Icon: typeof Users;
  tone?: "blue" | "green" | "amber" | "slate";
}) {
  const classes = {
    blue: "border-[#0057B8]/15 bg-[#EEF6FF] text-[#0057B8]",
    green: "border-emerald-500/15 bg-emerald-50 text-emerald-700",
    amber: "border-amber-500/15 bg-amber-50 text-amber-700",
    slate: "border-[#071A33]/10 bg-[#F5F7FB] text-[#52627A]",
  }[tone];
  return (
    <article className={`rounded-2xl border p-3 ${classes}`}>
      <Icon className="h-4 w-4" />
      <strong className="mt-2 block text-xl font-black">{value}</strong>
      <span className="text-[10px] font-black">{label}</span>
    </article>
  );
}

export default function AdminMerchantMorningBroadcast({ isArabic }: { isArabic: boolean }) {
  const locale = isArabic ? "ar" : "en";
  const [audience, setAudience] = useState<MerchantMorningAudience>(EMPTY_AUDIENCE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toggleBusy, setToggleBusy] = useState("");
  const [force, setForce] = useState(false);
  const [health, setHealth] = useState<MerchantMorningBroadcastHealth | null>(null);
  const [history, setHistory] = useState<MerchantMorningBroadcastHistory[]>([]);
  const [result, setResult] = useState<MerchantMorningBroadcastResult | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [manualQueue, setManualQueue] = useState<MerchantMorningRecipient[]>([]);
  const [manualCursor, setManualCursor] = useState(0);
  const knownEligibleIds = useRef<Set<string>>(new Set());
  const selectionInitialized = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextAudience, nextHealth, nextHistory] = await Promise.all([
        loadMerchantMorningAudience(),
        loadMerchantMorningBroadcastHealth(locale),
        loadMerchantMorningBroadcastHistory(),
      ]);
      setAudience(nextAudience);
      setHealth(nextHealth);
      setHistory(nextHistory);

      const eligibleIds = new Set(nextAudience.eligible.map((merchant) => merchant.id));
      setSelectedIds((current) => {
        if (!selectionInitialized.current) {
          selectionInitialized.current = true;
          knownEligibleIds.current = eligibleIds;
          return new Set(eligibleIds);
        }
        const next = new Set([...current].filter((id) => eligibleIds.has(id)));
        eligibleIds.forEach((id) => {
          if (!knownEligibleIds.current.has(id)) next.add(id);
        });
        knownEligibleIds.current = eligibleIds;
        return next;
      });
    } catch (cause) {
      setError(errorMessage(cause, isArabic));
    } finally {
      setLoading(false);
    }
  }, [isArabic, locale]);

  useEffect(() => {
    void refresh();
    return subscribeMerchantMorningAudience(() => void refresh());
  }, [refresh]);

  useEffect(() => {
    const focusBroadcast = () => {
      document.getElementById("dn-merchant-morning-broadcast")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    };
    window.addEventListener("dn-open-merchant-morning-broadcast", focusBroadcast);
    if (new URLSearchParams(window.location.search).get("broadcast") === "morning") {
      window.setTimeout(focusBroadcast, 250);
    }
    return () => window.removeEventListener("dn-open-merchant-morning-broadcast", focusBroadcast);
  }, []);

  const filtered = useMemo(() => {
    return audience.eligible.filter((merchant) =>
      matchesSearchQuery([merchantName(merchant), merchant.phone, merchant.merchant_code], search),
    );
  }, [audience.eligible, search]);

  const selectedMerchants = useMemo(
    () => audience.eligible.filter((merchant) => selectedIds.has(merchant.id)),
    [audience.eligible, selectedIds],
  );
  const previewMerchant = selectedMerchants[0] || audience.eligible[0] || null;
  const preview = useMemo(
    () => merchantMorningPreview(previewMerchant, locale),
    [locale, previewMerchant],
  );
  const filteredAllSelected =
    filtered.length > 0 && filtered.every((merchant) => selectedIds.has(merchant.id));

  function toggleMerchant(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setResult(null);
    setNotice("");
  }

  function toggleFiltered() {
    setSelectedIds((current) => {
      const next = new Set(current);
      filtered.forEach((merchant) => {
        if (filteredAllSelected) next.delete(merchant.id);
        else next.add(merchant.id);
      });
      return next;
    });
  }

  async function sendAutomatic() {
    if (!selectedMerchants.length) {
      setError(isArabic ? "اختر تاجرًا واحدًا على الأقل." : "Select at least one merchant.");
      return;
    }
    if (!health?.cloud_configured) {
      setError(
        isArabic
          ? "يلزم أولًا ربط WhatsApp Business Cloud API وقالب merchant_orders_today المعتمد. الفتح المتتابع متاح بالأسفل."
          : "Connect WhatsApp Business Cloud API and the approved merchant_orders_today template first. Sequential opening remains available below.",
      );
      return;
    }

    const approved = window.confirm(
      isArabic
        ? `سيتم إرسال رسالة صباحية مخصصة إلى ${selectedMerchants.length} تاجرًا الآن. هل تريد المتابعة؟`
        : `A personalized morning message will now be sent to ${selectedMerchants.length} merchants. Continue?`,
    );
    if (!approved) return;

    setBusy(true);
    setError("");
    setNotice("");
    setResult(null);
    try {
      const nextResult = await sendMerchantMorningBroadcast({
        locale,
        merchantIds: selectedMerchants.map((merchant) => merchant.id),
        force,
      });
      setResult(nextResult);
      setNotice(
        isArabic
          ? `اكتملت الحملة: تم الإرسال إلى ${nextResult.sent}، تعذر ${nextResult.failed}، وتم تخطي ${nextResult.skipped}.`
          : `Campaign completed: ${nextResult.sent} sent, ${nextResult.failed} failed, ${nextResult.skipped} skipped.`,
      );
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause, isArabic));
    } finally {
      setBusy(false);
    }
  }

  async function openManualMerchant(merchant: MerchantMorningRecipient) {
    const popup = window.open("about:blank", "_blank");
    if (!popup) throw new Error("popup_blocked");
    popup.document.title = isArabic ? "جارٍ تجهيز واتساب..." : "Preparing WhatsApp...";
    try {
      const prepared = await prepareWhatsAppMessage({
        messageType: "merchant_orders_today",
        merchantId: merchant.id,
        merchantName: merchantName(merchant),
        merchantPhone: merchant.phone || merchant.normalizedPhone,
        merchantPortalUrl: "https://www.daynightae.com/merchant",
        trackingUrl: "https://www.daynightae.com/tracking",
        locale,
        metadata: {
          surface: "admin_merchant_morning_broadcast_manual",
          campaign_mode: "sequential_whatsapp_web",
        },
      });
      await markOutboundMessageStatus(prepared.logId, "opened");
      popup.location.replace(prepared.url);
    } catch (cause) {
      popup.close();
      throw cause;
    }
  }

  async function startManualQueue() {
    if (!selectedMerchants.length) {
      setError(isArabic ? "اختر تاجرًا واحدًا على الأقل." : "Select at least one merchant.");
      return;
    }
    setError("");
    setNotice("");
    setManualQueue(selectedMerchants);
    setManualCursor(0);
    try {
      await openManualMerchant(selectedMerchants[0]);
      setManualCursor(1);
      setNotice(
        isArabic
          ? `تم فتح محادثة ${merchantName(selectedMerchants[0])}. بعد الإرسال اضغط «فتح التاجر التالي».`
          : `${merchantName(selectedMerchants[0])} opened. After sending, click “Open next merchant”.`,
      );
    } catch (cause) {
      setError(errorMessage(cause, isArabic));
    }
  }

  async function openNextManual() {
    const merchant = manualQueue[manualCursor];
    if (!merchant) return;
    try {
      await openManualMerchant(merchant);
      const nextCursor = manualCursor + 1;
      setManualCursor(nextCursor);
      setNotice(
        nextCursor >= manualQueue.length
          ? isArabic
            ? "تم فتح جميع محادثات التجار المحددين."
            : "All selected merchant chats have been opened."
          : isArabic
            ? `تم فتح ${merchantName(merchant)}. المتبقي ${manualQueue.length - nextCursor}.`
            : `${merchantName(merchant)} opened. ${manualQueue.length - nextCursor} remaining.`,
      );
    } catch (cause) {
      setError(errorMessage(cause, isArabic));
    }
  }

  async function changeEnabled(merchant: MerchantMorningRecipient, enabled: boolean) {
    setToggleBusy(merchant.id);
    setError("");
    try {
      await setMerchantMorningBroadcastEnabled(merchant.id, enabled);
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause, isArabic));
    } finally {
      setToggleBusy("");
    }
  }

  return (
    <section
      id="dn-merchant-morning-broadcast"
      className="scroll-mt-24 overflow-hidden rounded-[26px] border border-[#25D366]/25 bg-gradient-to-br from-white via-[#F7FFFA] to-[#EEF6FF] shadow-[0_18px_55px_rgba(7,26,51,0.10)]"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-[#071A33]/8 bg-gradient-to-r from-[#062D24] via-[#075E54] to-[#128C7E] p-4 text-white sm:p-5">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#25D366] text-[#062D24] shadow-lg">
          <Megaphone className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#B9FFD0]">
            SMART MERCHANT MORNING BROADCAST
          </span>
          <h2 className="mt-1 text-base font-black sm:text-xl">
            {isArabic ? "رسالة طلبيات اليوم لكل التجار" : "Today's orders message to every merchant"}
          </h2>
          <p className="mt-1 text-xs font-medium leading-5 text-white/75">
            {isArabic
              ? "قائمة ديناميكية من التجار المسجلين، رسالة مخصصة باسم كل تاجر، منع التكرار اليومي، وسجل إرسال كامل."
              : "A live merchant audience, personalized messages, daily duplicate protection, and a complete send log."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-black ${
              health?.cloud_configured
                ? "bg-emerald-300 text-emerald-950"
                : "bg-amber-300 text-amber-950"
            }`}
          >
            <Cloud className="h-3.5 w-3.5" />
            {health?.cloud_configured
              ? isArabic
                ? "الإرسال الرسمي متصل"
                : "Official sending connected"
              : isArabic
                ? "يحتاج ربط Meta"
                : "Meta setup required"}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || busy}
            className="rounded-xl border border-white/15 bg-white/10 p-2.5 transition hover:bg-white/20 disabled:opacity-40"
            aria-label={isArabic ? "تحديث قائمة التجار" : "Refresh merchants"}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={isArabic ? "إجمالي التجار" : "All merchants"} value={audience.all.length} Icon={Store} tone="blue" />
          <Stat label={isArabic ? "جاهزون للإرسال" : "Ready to send"} value={audience.eligible.length} Icon={CheckCircle2} tone="green" />
          <Stat label={isArabic ? "بدون رقم صالح" : "Missing valid phone"} value={audience.missingPhone.length} Icon={AlertTriangle} tone="amber" />
          <Stat label={isArabic ? "مستبعدون" : "Excluded"} value={audience.excluded.length} Icon={XCircle} tone="slate" />
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-50 p-4 text-xs font-bold leading-6 text-red-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-50 p-4 text-xs font-bold leading-6 text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-[#071A33]/10 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-[#071A33]">
                  {isArabic ? "التجار المشمولون تلقائيًا" : "Automatically included merchants"}
                </h3>
                <p className="mt-1 text-[10px] font-bold text-[#52627A]">
                  {isArabic
                    ? "أي تاجر جديد بحالة نشطة ورقم صالح يظهر هنا ويُحدد تلقائيًا."
                    : "Every new active merchant with a valid phone appears and is selected automatically."}
                </p>
              </div>
              <strong className="rounded-full bg-[#0057B8]/10 px-3 py-1.5 text-xs text-[#0057B8]">
                {selectedMerchants.length} / {audience.eligible.length}
              </strong>
            </div>

            <div className="mt-4 flex gap-2">
              <label className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#52627A]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={isArabic ? "بحث بالاسم أو الرقم أو كود التاجر" : "Search name, phone, or merchant code"}
                  className="w-full rounded-2xl border border-[#071A33]/10 bg-[#F7FAFF] py-3 pe-3 ps-10 text-xs font-bold outline-none focus:border-[#0057B8]/45"
                />
              </label>
              <button
                type="button"
                onClick={toggleFiltered}
                disabled={!filtered.length}
                className="rounded-2xl border border-[#0057B8]/15 bg-[#EEF6FF] px-3 text-[10px] font-black text-[#0057B8] disabled:opacity-40"
              >
                {filteredAllSelected
                  ? isArabic
                    ? "إلغاء الظاهر"
                    : "Clear shown"
                  : isArabic
                    ? "تحديد الظاهر"
                    : "Select shown"}
              </button>
            </div>

            <div className="mt-3 max-h-[430px] space-y-2 overflow-y-auto pe-1">
              {loading && !audience.all.length ? (
                <div className="grid min-h-44 place-items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#0057B8]" />
                </div>
              ) : (
                filtered.map((merchant) => (
                  <label
                    key={merchant.id}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#071A33]/8 bg-[#F9FBFF] p-3 transition hover:border-[#25D366]/45"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(merchant.id)}
                      onChange={() => toggleMerchant(merchant.id)}
                      className="h-4 w-4 accent-[#25D366]"
                    />
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#075E54]/10 text-[#075E54]">
                      <Store className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-xs font-black text-[#071A33]">
                        {merchantName(merchant)}
                      </strong>
                      <small className="mt-1 block truncate font-mono text-[10px] text-[#52627A]" dir="ltr">
                        +{merchant.normalizedPhone}
                        {merchant.merchant_code ? ` • ${merchant.merchant_code}` : ""}
                      </small>
                    </span>
                    <button
                      type="button"
                      disabled={toggleBusy === merchant.id}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void changeEnabled(merchant, false);
                      }}
                      className="rounded-xl border border-[#071A33]/10 bg-white px-2.5 py-2 text-[9px] font-black text-[#52627A] hover:border-red-300 hover:text-red-700 disabled:opacity-40"
                      title={isArabic ? "استبعاد هذا التاجر من الرسائل الجماعية" : "Exclude this merchant from broadcasts"}
                    >
                      {toggleBusy === merchant.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isArabic ? "استبعاد" : "Exclude"}
                    </button>
                  </label>
                ))
              )}
              {!loading && !filtered.length && (
                <div className="rounded-2xl bg-[#F7FAFF] p-8 text-center text-xs font-bold text-[#52627A]">
                  {isArabic ? "لا توجد نتائج مطابقة." : "No matching merchants."}
                </div>
              )}
            </div>

            {audience.missingPhone.length > 0 && (
              <details className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-50 p-3 text-xs text-amber-900">
                <summary className="cursor-pointer font-black">
                  {isArabic
                    ? `${audience.missingPhone.length} تاجر يحتاج رقم واتساب صالح`
                    : `${audience.missingPhone.length} merchants need a valid WhatsApp phone`}
                </summary>
                <div className="mt-2 space-y-1 text-[10px] font-bold">
                  {audience.missingPhone.slice(0, 12).map((merchant) => (
                    <div key={merchant.id}>{merchantName(merchant)}</div>
                  ))}
                </div>
              </details>
            )}
          </div>

          <div className="space-y-4">
            <article className="rounded-3xl border border-[#071A33]/10 bg-[#F4F8FF] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[#075E54]" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-[#071A33]">
                    {isArabic ? "معاينة الرسالة المخصصة" : "Personalized message preview"}
                  </h3>
                  <p className="truncate text-[10px] font-bold text-[#52627A]">
                    {previewMerchant ? merchantName(previewMerchant) : isArabic ? "لا يوجد تاجر محدد" : "No merchant selected"}
                  </p>
                </div>
              </div>
              <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-[#071A33]/10 bg-white p-4 font-sans text-xs font-medium leading-6 text-[#071A33]">
                {preview}
              </pre>
            </article>

            <article className="rounded-3xl border border-[#25D366]/25 bg-white p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#25D366]/15 text-[#075E54]">
                  <Zap className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-black text-[#071A33]">
                    {isArabic ? "الإرسال التلقائي الرسمي" : "Official automatic sending"}
                  </h3>
                  <p className="mt-1 text-[10px] font-bold leading-5 text-[#52627A]">
                    {isArabic
                      ? "يرسل قالب WhatsApp Business المعتمد لكل تاجر على حدة، مع منع الإرسال المكرر في اليوم نفسه."
                      : "Sends the approved WhatsApp Business template separately to every merchant and prevents same-day duplicates."}
                  </p>
                </div>
              </div>

              <label className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-500/15 bg-amber-50 p-3 text-[10px] font-bold leading-5 text-amber-900">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(event) => setForce(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-amber-600"
                />
                <span>
                  {isArabic
                    ? "إعادة الإرسال حتى لمن استلم رسالة اليوم — استخدمها فقط عند الحاجة."
                    : "Resend even to merchants already messaged today — use only when necessary."}
                </span>
              </label>

              <button
                type="button"
                onClick={() => void sendAutomatic()}
                disabled={busy || loading || !selectedMerchants.length}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3.5 text-xs font-black text-[#062D24] shadow-[0_12px_30px_rgba(37,211,102,0.28)] transition hover:-translate-y-0.5 hover:bg-[#38E478] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {busy
                  ? isArabic
                    ? "جارٍ الإرسال للتجار..."
                    : "Sending to merchants..."
                  : isArabic
                    ? `إرسال الآن إلى ${selectedMerchants.length} تاجرًا`
                    : `Send now to ${selectedMerchants.length} merchants`}
              </button>

              {!health?.cloud_configured && (
                <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-50 p-3 text-[10px] font-bold leading-5 text-amber-900">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {isArabic
                      ? "لن يرسل النظام أي رسالة تلقائية قبل اكتمال بيانات Meta وقبول قالب الرسالة؛ لا توجد نتائج نجاح وهمية."
                      : "No automatic message is sent until Meta credentials and the approved template are ready; the system never reports fake success."}
                  </span>
                </div>
              )}
            </article>

            <article className="rounded-3xl border border-[#071A33]/10 bg-white p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5 text-[#0057B8]" />
                <h3 className="font-black text-[#071A33]">
                  {isArabic ? "الفتح المتتابع عبر واتساب ويب" : "Sequential WhatsApp Web fallback"}
                </h3>
              </div>
              <p className="mt-2 text-[10px] font-bold leading-5 text-[#52627A]">
                {isArabic
                  ? "يفتح محادثة كل تاجر برسالته الجاهزة. واتساب ويب يتطلب منك الضغط على إرسال داخل المحادثة، لذلك نفتح التجار واحدًا بعد الآخر حتى لا يمنع المتصفح النوافذ."
                  : "Opens each merchant chat with a prepared message. WhatsApp Web requires you to press Send, so chats open one at a time to avoid browser pop-up blocking."}
              </p>
              {manualQueue.length === 0 || manualCursor >= manualQueue.length ? (
                <button
                  type="button"
                  onClick={() => void startManualQueue()}
                  disabled={!selectedMerchants.length}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#0057B8]/20 bg-[#EEF6FF] px-4 py-3 text-xs font-black text-[#0057B8] disabled:opacity-40"
                >
                  <MessageCircle className="h-4 w-4" />
                  {isArabic ? "بدء فتح محادثات التجار" : "Start opening merchant chats"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void openNextManual()}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#075E54]/20 bg-[#EFFFF4] px-4 py-3 text-xs font-black text-[#075E54]"
                >
                  <MessageCircle className="h-4 w-4" />
                  {isArabic
                    ? `فتح التاجر التالي (${manualCursor + 1}/${manualQueue.length})`
                    : `Open next merchant (${manualCursor + 1}/${manualQueue.length})`}
                </button>
              )}
            </article>

            {history.length > 0 && (
              <article className="rounded-3xl border border-[#071A33]/10 bg-white p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-[#0057B8]" />
                  <h3 className="font-black text-[#071A33]">
                    {isArabic ? "آخر حملات التجار" : "Recent merchant campaigns"}
                  </h3>
                </div>
                <div className="mt-3 space-y-2">
                  {history.slice(0, 5).map((campaign) => (
                    <div
                      key={campaign.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-[#F7FAFF] p-3 text-[10px] font-bold text-[#52627A]"
                    >
                      <span>
                        <strong className="block text-xs text-[#071A33]">{campaign.campaign_date}</strong>
                        {campaign.locale.toUpperCase()} • {campaign.status}
                      </span>
                      <span className="text-end">
                        <b className="text-emerald-700">{campaign.sent_count}</b> {isArabic ? "تم" : "sent"}
                        <br />
                        <b className="text-red-700">{campaign.failed_count}</b> {isArabic ? "تعذر" : "failed"}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            )}

            {result?.recipients?.some((item) => item.status === "failed") && (
              <details className="rounded-3xl border border-red-500/15 bg-red-50 p-4 text-xs text-red-900">
                <summary className="cursor-pointer font-black">
                  {isArabic ? "التجار الذين تعذر الإرسال إليهم" : "Merchants that failed"}
                </summary>
                <div className="mt-3 space-y-1 text-[10px] font-bold">
                  {result.recipients
                    .filter((item) => item.status === "failed")
                    .map((item) => (
                      <div key={item.merchant_id}>
                        {item.merchant_name} — {item.code || "provider_failed"}
                      </div>
                    ))}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
