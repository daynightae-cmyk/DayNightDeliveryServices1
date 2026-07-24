import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Link2,
  MessageSquareText,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import {
  DEFAULT_MESSAGE_PRESENTATION_SETTINGS,
  formatProfessionalMessage,
  readMessagePresentationSettings,
  resetMessagePresentationSettings,
  saveMessagePresentationSettings,
} from "../../services/whatsappMessageCore.mjs";

type MessageSettings = {
  linkLabels: boolean;
  includeBrandSignature: boolean;
  includeSlogan: boolean;
  includeWebsite: boolean;
  includeSupportPhone: boolean;
  includeEmail: boolean;
  includeTrackingLink: boolean;
  includeFeedbackLink: boolean;
  includeMerchantPortalLink: boolean;
  spacing: "comfortable" | "compact";
  customFooter: string;
};

function normalize(value: Partial<MessageSettings> | null | undefined): MessageSettings {
  return {
    ...(DEFAULT_MESSAGE_PRESENTATION_SETTINGS as MessageSettings),
    ...(value || {}),
    spacing: value?.spacing === "compact" ? "compact" : "comfortable",
    customFooter: String(value?.customFooter || ""),
  };
}

function Toggle({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  detail: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#071A33]/10 bg-[#F7FAFF] p-3 transition hover:border-[#0057B8]/35">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-[#0057B8]"
      />
      <span className="min-w-0">
        <strong className="block text-xs font-black text-[#071A33]">{title}</strong>
        <small className="mt-1 block text-[10px] leading-5 text-[#52627A]">{detail}</small>
      </span>
    </label>
  );
}

export default function AdminMessageControlCenter({ isArabic }: { isArabic: boolean }) {
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<MessageSettings>(() => normalize(readMessagePresentationSettings()));

  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<Partial<MessageSettings>>).detail;
      setSettings(normalize(detail || readMessagePresentationSettings()));
    };
    window.addEventListener("dn-message-presentation-change", sync);
    return () => window.removeEventListener("dn-message-presentation-change", sync);
  }, []);

  const update = <K extends keyof MessageSettings>(key: K, value: MessageSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const sample = useMemo(
    () =>
      formatProfessionalMessage(
        isArabic
          ? `السلام عليكم أ/ عميلنا الكريم 👋\n\nمع حضرتك مندوب داي نايت، وأنا في الطريق لتسليم الشحنة.\n\n📦 رقم الشحنة: DN-2026-10524\n💰 المبلغ المطلوب: 125.00 درهم إماراتي\n\n🔎 https://www.daynightae.com/tracking?code=DN-2026-10524\n\n⭐ https://www.daynightae.com/feedback/example-token`
          : `Hello valued customer 👋\n\nThis is your DAY NIGHT driver. I am on the way to deliver the shipment.\n\n📦 Tracking number: DN-2026-10524\n💰 Amount due: 125.00 AED\n\n🔎 https://www.daynightae.com/tracking?code=DN-2026-10524\n\n⭐ https://www.daynightae.com/feedback/example-token`,
        settings,
      ),
    [isArabic, settings],
  );

  const save = () => {
    setSettings(normalize(saveMessagePresentationSettings(settings)));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const reset = () => {
    setSettings(normalize(resetMessagePresentationSettings()));
    setSaved(false);
  };

  return (
    <section className="mx-3 mt-3 overflow-hidden rounded-[28px] border border-[#0057B8]/15 bg-white shadow-[0_20px_60px_rgba(7,26,51,0.10)] sm:mx-6 sm:mt-5" dir={isArabic ? "rtl" : "ltr"}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 bg-gradient-to-r from-[#071A33] via-[#0A315D] to-[#0057B8] p-4 text-start text-white sm:p-5"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
          <MessageSquareText className="h-6 w-6 text-[#F5D46E]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F5D46E]">DAY NIGHT MESSAGE CONTROL</span>
          <strong className="mt-1 block text-base font-black sm:text-lg">
            {isArabic ? "مركز التحكم الاحترافي في الرسائل" : "Professional Message Control Center"}
          </strong>
          <small className="mt-1 block leading-5 text-white/65">
            {isArabic
              ? "تنسيق الروابط، التوقيع، بيانات التواصل، المسافات، والمعاينة قبل الإرسال."
              : "Control link labels, signatures, contact details, spacing, and send previews."}
          </small>
        </span>
        {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>

      {open && (
        <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle
                checked={settings.linkLabels}
                onChange={(value) => update("linkLabels", value)}
                title={isArabic ? "اسم الرابط فوق الرابط" : "Named link above URL"}
                detail={isArabic ? "يكتب: رابط تتبع الشحنة، ثم الرابط في السطر التالي." : "Shows a clear link name, then the URL on the next line."}
              />
              <Toggle
                checked={settings.includeBrandSignature}
                onChange={(value) => update("includeBrandSignature", value)}
                title={isArabic ? "توقيع الشركة" : "Company signature"}
                detail={isArabic ? "إضافة اسم داي نايت في نهاية الرسالة عند عدم وجوده." : "Adds the DAY NIGHT identity when it is missing."}
              />
              <Toggle
                checked={settings.includeSlogan}
                onChange={(value) => update("includeSlogan", value)}
                title={isArabic ? "شعار سريع • آمن • موثوق" : "Brand slogan"}
                detail={isArabic ? "إضافة الشعار التجاري بنهاية الرسالة." : "Adds the commercial slogan to the closing."}
              />
              <Toggle
                checked={settings.includeWebsite}
                onChange={(value) => update("includeWebsite", value)}
                title={isArabic ? "إضافة الموقع الرسمي" : "Append official website"}
                detail={isArabic ? "يظهر اسم الموقع أولًا وتحته الرابط الرسمي." : "Adds a named official website block."}
              />
              <Toggle
                checked={settings.includeSupportPhone}
                onChange={(value) => update("includeSupportPhone", value)}
                title={isArabic ? "إضافة رقم خدمة العملاء" : "Append support phone"}
                detail={isArabic ? "إضافة رقم الاتصال وواتساب عند عدم وجوده." : "Adds the support and WhatsApp phone when missing."}
              />
              <Toggle
                checked={settings.includeEmail}
                onChange={(value) => update("includeEmail", value)}
                title={isArabic ? "إضافة البريد الإلكتروني" : "Append email"}
                detail={isArabic ? "إضافة بريد الإدارة الرسمي في نهاية الرسالة." : "Adds the official administration email."}
              />
              <Toggle
                checked={settings.includeTrackingLink}
                onChange={(value) => update("includeTrackingLink", value)}
                title={isArabic ? "السماح برابط التتبع" : "Keep tracking links"}
                detail={isArabic ? "يمكن إخفاؤه من كل الرسائل عند الحاجة." : "Can remove tracking links globally when required."}
              />
              <Toggle
                checked={settings.includeFeedbackLink}
                onChange={(value) => update("includeFeedbackLink", value)}
                title={isArabic ? "السماح برابط التقييم" : "Keep feedback links"}
                detail={isArabic ? "التحكم في ظهور رابط التقييم والشكاوى." : "Controls rating and complaint links."}
              />
              <Toggle
                checked={settings.includeMerchantPortalLink}
                onChange={(value) => update("includeMerchantPortalLink", value)}
                title={isArabic ? "السماح برابط التاجر" : "Keep merchant portal links"}
                detail={isArabic ? "التحكم في ظهور روابط لوحة التاجر والطلبات." : "Controls merchant portal and order links."}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="rounded-2xl border border-[#071A33]/10 bg-[#F7FAFF] p-3 text-xs font-black text-[#071A33]">
                {isArabic ? "مسافات الرسالة" : "Message spacing"}
                <select
                  value={settings.spacing}
                  onChange={(event) => update("spacing", event.target.value === "compact" ? "compact" : "comfortable")}
                  className="mt-2 w-full rounded-xl border border-[#071A33]/10 bg-white p-2.5 text-sm font-bold"
                >
                  <option value="comfortable">{isArabic ? "مريحة وواضحة" : "Comfortable"}</option>
                  <option value="compact">{isArabic ? "مختصرة ومتقاربة" : "Compact"}</option>
                </select>
              </label>

              <label className="rounded-2xl border border-[#071A33]/10 bg-[#F7FAFF] p-3 text-xs font-black text-[#071A33]">
                {isArabic ? "تذييل مخصص لكل الرسائل" : "Global custom footer"}
                <textarea
                  value={settings.customFooter}
                  onChange={(event) => update("customFooter", event.target.value)}
                  rows={3}
                  maxLength={600}
                  className="mt-2 w-full rounded-xl border border-[#071A33]/10 bg-white p-2.5 text-sm font-medium leading-6"
                  placeholder={isArabic ? "مثال: خدمتكم متاحة على مدار الساعة 24/7" : "Example: Available 24/7 across the UAE"}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={save} className="inline-flex items-center gap-2 rounded-2xl bg-[#0057B8] px-4 py-3 text-xs font-black text-white shadow-lg">
                <Save className="h-4 w-4" />
                {saved ? (isArabic ? "تم الحفظ" : "Saved") : (isArabic ? "حفظ الإعدادات" : "Save settings")}
              </button>
              <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-2xl border border-[#071A33]/12 bg-white px-4 py-3 text-xs font-black text-[#071A33]">
                <RotateCcw className="h-4 w-4" />
                {isArabic ? "استعادة الافتراضي" : "Reset defaults"}
              </button>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-50 p-4 text-xs leading-6 text-emerald-900">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                {isArabic
                  ? "هذه القواعد تطبّق تلقائيًا على مولدات الرسائل في الإدارة والمندوب والتاجر وروابط واتساب العامة. ويمكن تعديل نص كل قالب مركزيًا من تبويب إعدادات القوالب أسفل الصفحة."
                  : "These rules apply automatically to admin, driver, merchant, and public WhatsApp message generators. Individual template bodies remain centrally editable in the Template Settings tab below."}
              </span>
            </div>
          </div>

          <aside className="rounded-[24px] border border-[#071A33]/10 bg-[#F4F8FF] p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-[#0057B8]" />
              <div>
                <strong className="block text-sm font-black text-[#071A33]">{isArabic ? "معاينة مباشرة" : "Live preview"}</strong>
                <small className="text-[10px] text-[#52627A]">{isArabic ? "مثال قبل فتح واتساب" : "Example before opening WhatsApp"}</small>
              </div>
            </div>
            <pre className="mt-4 max-h-[620px] overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-[#071A33]/10 bg-white p-4 font-sans text-sm font-medium leading-7 text-[#071A33]">{sample}</pre>
            <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-[#52627A]">
              <Link2 className="h-4 w-4" />
              {isArabic ? "كل رابط يظهر باسمه وتحته الرابط مباشرة." : "Every URL is displayed under its explicit link name."}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
