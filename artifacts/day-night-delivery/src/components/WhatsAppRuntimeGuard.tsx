import { useEffect, useState } from "react";
import { ClipboardCopy, ExternalLink, MessageCircle, Settings2, X } from "lucide-react";
import {
  buildSynchronousContextualWhatsAppUrl,
  contextualSupportContext,
  copyPreparedWhatsApp,
  openPreparedWhatsApp,
  prepareWhatsAppMessage,
  revisePreparedWhatsAppMessage,
  WHATSAPP_PREVIEW_EVENT,
  type MessagePresentationOptions,
  type PreparedWhatsAppMessage,
} from "../services/whatsappMessageService";
import { readMessagePresentationSettings } from "../services/whatsappMessageCore.mjs";

function isWhatsAppHref(href: string) {
  return /https?:\/\/(?:api\.)?wa\.me\//i.test(href) || /https?:\/\/api\.whatsapp\.com\/send/i.test(href);
}

function isCatalogHref(href: string) {
  return /wa\.me\/c\//i.test(href);
}

function hasMessageText(href: string) {
  try {
    const url = new URL(href, window.location.origin);
    return Boolean(url.searchParams.get("text")?.trim());
  } catch {
    return false;
  }
}

function currentLocale() {
  return document.documentElement.lang.toLowerCase().startsWith("en") ? "en" as const : "ar" as const;
}

function markEmptyWhatsAppLinks(root: ParentNode = document) {
  root.querySelectorAll<HTMLAnchorElement>('a[href*="wa.me/"],a[href*="api.whatsapp.com/send"]').forEach((anchor) => {
    const href = anchor.href;
    if (!isWhatsAppHref(href) || isCatalogHref(href) || hasMessageText(href)) return;
    anchor.dataset.dnWhatsappGuarded = "true";
    anchor.href = buildSynchronousContextualWhatsAppUrl(window.location.pathname, window.location.search, currentLocale());
  });
}

function initialOptions(): MessagePresentationOptions {
  const settings = readMessagePresentationSettings();
  return {
    linkLabels: settings.linkLabels !== false,
    includeBrandSignature: settings.includeBrandSignature !== false,
    includeSlogan: settings.includeSlogan !== false,
    includeWebsite: settings.includeWebsite === true,
    includeSupportPhone: settings.includeSupportPhone === true,
    includeEmail: settings.includeEmail === true,
    includeTrackingLink: settings.includeTrackingLink !== false,
    includeFeedbackLink: settings.includeFeedbackLink !== false,
    includeMerchantPortalLink: settings.includeMerchantPortalLink !== false,
    spacing: settings.spacing === "compact" ? "compact" : "comfortable",
    customNote: "",
    customClosing: "",
  };
}

function OptionToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#071A33]/10 bg-[#F7FAFF] px-3 py-2 text-[11px] font-black text-[#071A33]">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[#0057B8]" />
      <span>{label}</span>
    </label>
  );
}

export default function WhatsAppRuntimeGuard() {
  const [prepared, setPrepared] = useState<PreparedWhatsAppMessage | null>(null);
  const [draft, setDraft] = useState("");
  const [options, setOptions] = useState<MessagePresentationOptions>(initialOptions);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [busy, setBusy] = useState<"copy" | "open" | "">("");
  const [copied, setCopied] = useState(false);
  const isArabic = prepared?.locale !== "en";

  useEffect(() => {
    markEmptyWhatsAppLinks();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) markEmptyWhatsAppLinks(node);
        });
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    const onPreview = (event: Event) => {
      const next = (event as CustomEvent<PreparedWhatsAppMessage>).detail;
      if (!next?.message || !next.phone) return;
      setPrepared(next);
      setDraft(next.message);
      setOptions(initialOptions());
      setOptionsOpen(false);
      setCopied(false);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const anchor = target?.closest<HTMLAnchorElement>('a[href*="wa.me/"],a[href*="api.whatsapp.com/send"]');
      if (!anchor || isCatalogHref(anchor.href)) return;
      if (hasMessageText(anchor.href) && !anchor.dataset.dnWhatsappGuarded) return;

      event.preventDefault();
      const context = contextualSupportContext(window.location.pathname, window.location.search, currentLocale());
      void prepareWhatsAppMessage(context)
        .then((message) => openPreparedWhatsApp(message))
        .catch(() => {
          const safeUrl = buildSynchronousContextualWhatsAppUrl(
            window.location.pathname,
            window.location.search,
            currentLocale(),
          );
          window.open(safeUrl, "_blank", "noopener,noreferrer");
        });
    };

    window.addEventListener(WHATSAPP_PREVIEW_EVENT, onPreview);
    document.addEventListener("click", onClick, true);
    return () => {
      observer.disconnect();
      window.removeEventListener(WHATSAPP_PREVIEW_EVENT, onPreview);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  const updateOption = <K extends keyof MessagePresentationOptions>(key: K, value: MessagePresentationOptions[K]) => {
    setOptions((current) => ({ ...current, [key]: value }));
    setCopied(false);
  };

  const close = () => {
    if (busy) return;
    setPrepared(null);
    setDraft("");
    setCopied(false);
  };

  const finalMessage = () => {
    if (!prepared) throw new Error("missing_prepared_message");
    return revisePreparedWhatsAppMessage(prepared, draft, options);
  };

  const copy = async () => {
    if (!prepared) return;
    setBusy("copy");
    try {
      await copyPreparedWhatsApp(finalMessage());
      setCopied(true);
    } finally {
      setBusy("");
    }
  };

  const open = async () => {
    if (!prepared) return;
    setBusy("open");
    try {
      await openPreparedWhatsApp(finalMessage(), { direct: true });
      setPrepared(null);
      setDraft("");
    } finally {
      setBusy("");
    }
  };

  if (!prepared) return null;

  return (
    <div className="fixed inset-0 z-[120000] flex items-end justify-center bg-[#071A33]/75 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" dir={isArabic ? "rtl" : "ltr"}>
      <div className="max-h-[95dvh] w-full max-w-3xl overflow-y-auto rounded-t-[30px] border border-white/10 bg-white shadow-2xl sm:rounded-[30px]">
        <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-white/10 bg-gradient-to-r from-[#071A33] via-[#0A315D] to-[#0057B8] p-4 text-white sm:p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#25D366] text-[#071A33]">
            <MessageCircle className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F5D46E]">DAY NIGHT SMART SEND</span>
            <h2 className="mt-1 text-lg font-black">{isArabic ? "مراجعة وتخصيص الرسالة قبل الإرسال" : "Review and customize before sending"}</h2>
            <p className="mt-1 text-xs text-white/65" dir="ltr">WhatsApp: +{prepared.phone}</p>
          </div>
          <button type="button" onClick={close} className="rounded-full bg-white/10 p-2" aria-label={isArabic ? "إغلاق" : "Close"}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong className="block text-sm font-black text-[#071A33]">{isArabic ? "نص الرسالة" : "Message body"}</strong>
              <small className="text-[10px] text-[#52627A]">{isArabic ? "يمكن تعديل أي كلمة قبل النسخ أو فتح واتساب." : "Every word remains editable before copying or opening WhatsApp."}</small>
            </div>
            <button type="button" onClick={() => setOptionsOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-[#0057B8]/20 bg-[#EDF5FF] px-3 py-2 text-[11px] font-black text-[#0057B8]">
              <Settings2 className="h-4 w-4" />
              {isArabic ? "خيارات الإرسال" : "Send options"}
            </button>
          </div>

          {optionsOpen && (
            <section className="rounded-2xl border border-[#0057B8]/15 bg-[#F4F8FF] p-3 sm:p-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <OptionToggle checked={options.linkLabels !== false} onChange={(value) => updateOption("linkLabels", value)} label={isArabic ? "اسم الرابط فوقه" : "Named links"} />
                <OptionToggle checked={options.includeTrackingLink !== false} onChange={(value) => updateOption("includeTrackingLink", value)} label={isArabic ? "رابط التتبع" : "Tracking link"} />
                <OptionToggle checked={options.includeFeedbackLink !== false} onChange={(value) => updateOption("includeFeedbackLink", value)} label={isArabic ? "رابط التقييم" : "Feedback link"} />
                <OptionToggle checked={options.includeMerchantPortalLink !== false} onChange={(value) => updateOption("includeMerchantPortalLink", value)} label={isArabic ? "رابط لوحة التاجر" : "Merchant portal"} />
                <OptionToggle checked={options.includeWebsite === true} onChange={(value) => updateOption("includeWebsite", value)} label={isArabic ? "الموقع الرسمي" : "Official website"} />
                <OptionToggle checked={options.includeSupportPhone === true} onChange={(value) => updateOption("includeSupportPhone", value)} label={isArabic ? "رقم الدعم" : "Support phone"} />
                <OptionToggle checked={options.includeEmail === true} onChange={(value) => updateOption("includeEmail", value)} label={isArabic ? "البريد الإلكتروني" : "Email"} />
                <OptionToggle checked={options.includeBrandSignature !== false} onChange={(value) => updateOption("includeBrandSignature", value)} label={isArabic ? "توقيع داي نايت" : "DAY NIGHT signature"} />
                <OptionToggle checked={options.includeSlogan !== false} onChange={(value) => updateOption("includeSlogan", value)} label={isArabic ? "الشعار التجاري" : "Brand slogan"} />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-black text-[#071A33]">
                  {isArabic ? "ملاحظة خاصة لهذه الرسالة" : "Special note for this message"}
                  <textarea value={String(options.customNote || "")} onChange={(event) => updateOption("customNote", event.target.value)} rows={2} maxLength={800} className="mt-2 w-full rounded-xl border border-[#071A33]/10 bg-white p-3 text-sm font-medium leading-6" />
                </label>
                <label className="text-xs font-black text-[#071A33]">
                  {isArabic ? "خاتمة خاصة" : "Custom closing"}
                  <textarea value={String(options.customClosing || "")} onChange={(event) => updateOption("customClosing", event.target.value)} rows={2} maxLength={800} className="mt-2 w-full rounded-xl border border-[#071A33]/10 bg-white p-3 text-sm font-medium leading-6" />
                </label>
              </div>
            </section>
          )}

          <textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setCopied(false);
            }}
            rows={18}
            maxLength={7000}
            className="min-h-[360px] w-full resize-y rounded-2xl border border-[#071A33]/12 bg-[#F8FAFD] p-4 text-sm font-medium leading-7 text-[#071A33] outline-none focus:border-[#0057B8]"
          />

          <div className="grid grid-cols-3 gap-2 border-t border-[#071A33]/8 bg-white pt-3">
            <button type="button" onClick={close} disabled={Boolean(busy)} className="rounded-2xl border border-[#071A33]/15 px-3 py-3 text-xs font-black text-[#071A33] disabled:opacity-50">
              {isArabic ? "إلغاء" : "Cancel"}
            </button>
            <button type="button" onClick={() => void copy()} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#0057B8]/20 bg-[#EDF5FF] px-3 py-3 text-xs font-black text-[#0057B8] disabled:opacity-50">
              <ClipboardCopy className="h-4 w-4" />
              {copied ? (isArabic ? "تم النسخ" : "Copied") : (isArabic ? "نسخ الرسالة" : "Copy")}
            </button>
            <button type="button" onClick={() => void open()} disabled={Boolean(busy) || !draft.trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-3 py-3 text-xs font-black text-[#071A33] shadow-lg disabled:opacity-50">
              <ExternalLink className="h-4 w-4" />
              {busy === "open" ? (isArabic ? "جارٍ الفتح…" : "Opening…") : (isArabic ? "فتح واتساب" : "Open WhatsApp")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
