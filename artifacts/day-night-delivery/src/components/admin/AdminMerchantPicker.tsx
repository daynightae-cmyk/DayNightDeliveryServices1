import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MapPin, Search, Store, UserRound, X } from "lucide-react";
import { matchesSearchQuery } from "../../lib/searchNormalization";
import type { Merchant } from "../../types";

const clean = (value: unknown) => String(value ?? "").trim();

function merchantTitle(merchant: Merchant) {
  return clean(merchant.trade_name || merchant.owner_name || merchant.merchant_code || merchant.id);
}

function merchantSubtitle(merchant: Merchant) {
  return [clean(merchant.owner_name), clean(merchant.merchant_code), clean(merchant.phone)]
    .filter(Boolean)
    .join(" · ");
}

export default function AdminMerchantPicker({
  isArabic,
  merchants,
  value,
  onChange,
  personalValue,
  allowPersonal = false,
}: {
  isArabic: boolean;
  merchants: Merchant[];
  value: string;
  onChange: (id: string) => void;
  personalValue?: string;
  allowPersonal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = merchants.find((merchant) => merchant.id === value) || null;
  const personalSelected = Boolean(allowPersonal && personalValue && value === personalValue);

  const filtered = useMemo(
    () =>
      merchants.filter((merchant) =>
        matchesSearchQuery(
          [
            merchant.trade_name,
            merchant.owner_name,
            merchant.merchant_code,
            merchant.phone,
            merchant.alt_phone,
            merchant.email,
            merchant.emirate,
            merchant.city,
            merchant.address,
          ],
          query,
        ),
      ),
    [merchants, query],
  );

  useEffect(() => {
    const handlePointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  function choose(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative" data-admin-merchant-picker="professional">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={`group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-start transition duration-200 ${
          selected || personalSelected
            ? "border-brand-gold/45 bg-brand-gold/[0.08] shadow-[0_0_28px_rgba(212,175,55,0.10)]"
            : "border-brand-sky/20 bg-brand-deep/75"
        } hover:border-brand-gold/65 hover:bg-brand-gold/[0.09] hover:shadow-[0_0_30px_rgba(212,175,55,0.16)] focus:outline-none focus:ring-2 focus:ring-brand-gold/25`}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-brand-gold transition group-hover:border-brand-gold/35 group-hover:bg-brand-gold/10">
          {personalSelected ? <UserRound className="h-5 w-5" /> : <Store className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-sm font-black text-white">
            {personalSelected
              ? isArabic ? "غرض شخصي — بدون تاجر" : "Personal purpose — no merchant"
              : selected
                ? merchantTitle(selected)
                : isArabic ? "اختر التاجر" : "Select merchant"}
          </strong>
          <small className="mt-1 block truncate text-[10px] font-bold text-white/45">
            {personalSelected
              ? isArabic ? "لا يرتبط بحسابات التجار" : "Not linked to merchant accounting"
              : selected
                ? merchantSubtitle(selected) || (isArabic ? "حساب تاجر" : "Merchant account")
                : isArabic ? "ابحث بالاسم، المتجر، الكود أو الهاتف" : "Search name, store, code, or phone"}
          </small>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-white/40 transition ${open ? "rotate-180 text-brand-gold" : ""}`} />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-[120] overflow-hidden rounded-[1.4rem] border border-brand-gold/30 bg-[#041429]/[0.985] shadow-[0_28px_80px_rgba(0,0,0,0.48),0_0_36px_rgba(212,175,55,0.10)] backdrop-blur-xl">
          <div className="border-b border-white/10 p-3">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 focus-within:border-brand-gold/50 focus-within:ring-2 focus-within:ring-brand-gold/10">
              <Search className="h-4 w-4 text-white/35" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={isArabic ? "ابحث عن التاجر..." : "Search merchants..."}
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/30"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="text-white/35 hover:text-white" aria-label={isArabic ? "مسح البحث" : "Clear search"}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            <p className="mt-2 px-1 text-[10px] font-bold text-white/35">
              {isArabic ? `${filtered.length} تاجر مطابق` : `${filtered.length} matching merchants`}
            </p>
          </div>

          <div className="max-h-[360px] space-y-2 overflow-y-auto p-3 [scrollbar-width:thin]">
            {allowPersonal && personalValue && (
              <button
                type="button"
                onClick={() => choose(personalValue)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-start transition ${
                  personalSelected
                    ? "border-brand-gold/70 bg-brand-gold/15 shadow-[inset_0_0_0_1px_rgba(212,175,55,.18),0_0_24px_rgba(212,175,55,.16)]"
                    : "border-white/10 bg-white/[0.035] hover:border-brand-gold/60 hover:bg-brand-gold/10 hover:shadow-[0_0_24px_rgba(212,175,55,.14)]"
                }`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-gold/10 text-brand-gold"><UserRound className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><strong className="block text-xs font-black text-white">{isArabic ? "غرض شخصي — بدون تاجر" : "Personal purpose — no merchant"}</strong><small className="mt-1 block text-[10px] text-white/40">{isArabic ? "طلب إداري مستقل عن حسابات التجار" : "Admin order independent of merchant accounts"}</small></span>
                {personalSelected && <Check className="h-4 w-4 text-brand-gold" />}
              </button>
            )}

            {filtered.map((merchant) => {
              const active = merchant.id === value;
              const location = [clean(merchant.city), clean(merchant.emirate)].filter(Boolean).join(" · ");
              return (
                <button
                  key={merchant.id}
                  type="button"
                  onClick={() => choose(merchant.id)}
                  className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-start transition duration-150 ${
                    active
                      ? "border-brand-gold/70 bg-brand-gold/15 shadow-[inset_0_0_0_1px_rgba(212,175,55,.18),0_0_24px_rgba(212,175,55,.16)]"
                      : "border-white/10 bg-white/[0.035] hover:-translate-y-px hover:border-brand-gold/60 hover:bg-brand-gold/10 hover:shadow-[0_0_26px_rgba(212,175,55,.15)] focus:border-brand-gold/70 focus:bg-brand-gold/10 focus:outline-none"
                  }`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-brand-gold group-hover:border-brand-gold/35"><Store className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs font-black text-white">{merchantTitle(merchant)}</strong>
                    <small className="mt-1 block truncate text-[10px] font-bold text-white/45">{merchantSubtitle(merchant) || "—"}</small>
                    {location && <small className="mt-1 flex items-center gap-1 truncate text-[9px] text-brand-sky/70"><MapPin className="h-3 w-3" />{location}</small>}
                  </span>
                  {active && <Check className="h-4 w-4 shrink-0 text-brand-gold" />}
                </button>
              );
            })}

            {!filtered.length && (
              <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-xs font-bold text-white/40">
                {isArabic ? "لا يوجد تاجر مطابق لهذا البحث." : "No merchant matches this search."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
