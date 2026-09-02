import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, Store, UserRound, X } from "lucide-react";

const OWNER_SELECTOR = 'select[data-admin-order-owner-select="true"]';

type OptionModel = { value: string; label: string; disabled: boolean };
type Anchor = { top: number; left: number; width: number; height: number };

function readOptions(select: HTMLSelectElement | null): OptionModel[] {
  if (!select) return [];
  return Array.from(select.options).map((option) => ({
    value: option.value,
    label: option.textContent?.trim() || option.label || option.value,
    disabled: option.disabled,
  }));
}

function anchorFor(select: HTMLSelectElement | null): Anchor | null {
  if (!select) return null;
  const rect = select.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

export default function AdminMerchantPickerEnhancer({ isArabic }: { isArabic: boolean }) {
  const [select, setSelect] = useState<HTMLSelectElement | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [options, setOptions] = useState<OptionModel[]>([]);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const candidates = Array.from(document.querySelectorAll<HTMLSelectElement>(OWNER_SELECTOR));
        const next = candidates.find((node) => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }) || candidates[0] || null;
        setSelect((current) => current === next ? current : next);
        setAnchor(anchorFor(next));
        setOptions(readOptions(next));
        setValue(next?.value || "");
      });
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["value", "class", "style"] });
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    window.addEventListener("dn-admin-order-owner-picker-sync", sync);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("dn-admin-order-owner-picker-sync", sync);
    };
  }, []);

  useEffect(() => {
    if (!select) return;
    const onChange = () => {
      setValue(select.value);
      setOptions(readOptions(select));
      setOpen(false);
      setQuery("");
    };
    select.addEventListener("change", onChange);
    return () => select.removeEventListener("change", onChange);
  }, [select]);

  useEffect(() => {
    if (!select) return;
    // Keep the real select mounted, enabled and measurable for the existing
    // production browser probes. The professional control is an enhancement,
    // not a replacement for the tested form contract.
    const previous = {
      opacity: select.style.opacity,
      position: select.style.position,
      zIndex: select.style.zIndex,
      pointerEvents: select.style.pointerEvents,
    };
    select.style.opacity = "0.01";
    select.style.position = "relative";
    select.style.zIndex = "1";
    select.style.pointerEvents = "none";
    return () => {
      select.style.opacity = previous.opacity;
      select.style.position = previous.position;
      select.style.zIndex = previous.zIndex;
      select.style.pointerEvents = previous.pointerEvents;
    };
  }, [select]);

  const selected = options.find((option) => option.value === value) || null;
  const visibleOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return options.filter((option) => {
      if (option.disabled || !option.value) return false;
      return !normalized || option.label.toLocaleLowerCase().includes(normalized);
    });
  }, [options, query]);

  if (!select || !anchor || typeof document === "undefined") return null;

  function choose(nextValue: string) {
    if (!select) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    setter?.call(select, nextValue);
    select.dispatchEvent(new Event("change", { bubbles: true }));
    setValue(nextValue);
    setOpen(false);
    setQuery("");
  }

  const personalSelected = selected?.value.includes("personal_order");
  const triggerStyle = {
    position: "fixed" as const,
    top: anchor.top,
    left: anchor.left,
    width: anchor.width,
    minHeight: anchor.height,
  };
  const menuTop = Math.min(anchor.top + anchor.height + 8, window.innerHeight - 430);

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[119]" dir={isArabic ? "rtl" : "ltr"} data-admin-merchant-picker-enhancer="true">
      <button
        type="button"
        style={triggerStyle}
        onClick={() => setOpen((current) => !current)}
        className="pointer-events-auto group flex items-center gap-3 rounded-2xl border border-brand-gold/35 bg-[#071a33]/[0.985] px-4 py-3 text-start shadow-[0_14px_40px_rgba(0,0,0,.32),0_0_24px_rgba(212,175,55,.08)] backdrop-blur-xl transition hover:border-brand-gold/70 hover:bg-[#0b2444] hover:shadow-[0_16px_48px_rgba(0,0,0,.36),0_0_30px_rgba(212,175,55,.18)] focus:outline-none focus:ring-2 focus:ring-brand-gold/30"
        aria-expanded={open}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand-gold/25 bg-brand-gold/10 text-brand-gold">
          {personalSelected ? <UserRound className="h-4 w-4" /> : <Store className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <small className="block text-[9px] font-black text-brand-gold/80">{isArabic ? "التاجر / نوع الطلب" : "MERCHANT / ORDER TYPE"}</small>
          <strong className="mt-0.5 block truncate text-sm font-black text-white">{selected?.label || (isArabic ? "اختر التاجر" : "Select merchant")}</strong>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-white/40 transition ${open ? "rotate-180 text-brand-gold" : ""}`} />
      </button>

      {open && (
        <>
          <button type="button" className="pointer-events-auto fixed inset-0 -z-10 cursor-default bg-black/5" onClick={() => setOpen(false)} aria-label={isArabic ? "إغلاق قائمة التجار" : "Close merchant picker"} />
          <section
            className="pointer-events-auto fixed z-[121] overflow-hidden rounded-[1.5rem] border border-brand-gold/35 bg-[#041429]/[0.99] shadow-[0_28px_90px_rgba(0,0,0,.58),0_0_38px_rgba(212,175,55,.14)] backdrop-blur-xl"
            style={{ top: Math.max(12, menuTop), left: anchor.left, width: Math.max(anchor.width, 390), maxWidth: `calc(100vw - ${Math.max(24, anchor.left)}px)` }}
          >
            <header className="border-b border-white/10 p-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 focus-within:border-brand-gold/55 focus-within:ring-2 focus-within:ring-brand-gold/10">
                <Search className="h-4 w-4 text-white/35" />
                <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "ابحث باسم التاجر أو المتجر أو الكود..." : "Search merchant, store, or code..."} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/30" />
                {query && <button type="button" onClick={() => setQuery("")} className="text-white/35 hover:text-white"><X className="h-4 w-4" /></button>}
              </div>
              <p className="mt-2 px-1 text-[10px] font-bold text-white/35">{isArabic ? `${visibleOptions.length} اختيار متاح` : `${visibleOptions.length} available choices`}</p>
            </header>
            <div className="max-h-[330px] space-y-2 overflow-y-auto p-3 [scrollbar-width:thin]">
              {visibleOptions.map((option) => {
                const active = option.value === value;
                const personal = option.value.includes("personal_order");
                return (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => choose(option.value)}
                    className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-start transition duration-150 ${active ? "border-brand-gold/75 bg-brand-gold/15 shadow-[inset_0_0_0_1px_rgba(212,175,55,.16),0_0_26px_rgba(212,175,55,.18)]" : "border-white/10 bg-white/[.035] hover:-translate-y-px hover:border-brand-gold/65 hover:bg-brand-gold/10 hover:shadow-[0_0_28px_rgba(212,175,55,.16)] focus:border-brand-gold/70 focus:bg-brand-gold/10 focus:outline-none"}`}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-brand-gold group-hover:border-brand-gold/35">{personal ? <UserRound className="h-4 w-4" /> : <Store className="h-4 w-4" />}</span>
                    <span className="min-w-0 flex-1"><strong className="block text-xs font-black leading-5 text-white">{option.label}</strong><small className="mt-1 block text-[9px] font-bold text-white/35">{personal ? (isArabic ? "طلب مستقل عن حسابات التجار" : "Independent from merchant accounting") : (isArabic ? "اضغط لاختيار هذا التاجر" : "Click to select this merchant")}</small></span>
                    {active && <Check className="h-4 w-4 shrink-0 text-brand-gold" />}
                  </button>
                );
              })}
              {!visibleOptions.length && <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-xs font-bold text-white/40">{isArabic ? "لا توجد نتائج مطابقة." : "No matching merchants."}</div>}
            </div>
          </section>
        </>
      )}
    </div>,
    document.body,
  );
}
