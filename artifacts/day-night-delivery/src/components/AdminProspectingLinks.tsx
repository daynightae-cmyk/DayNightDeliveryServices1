import { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, Copy, ExternalLink, MapPin, Plus, RefreshCw, Search, Sparkles, Store, Target, Wand2, Zap } from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import { createMerchant, fetchMerchants } from "../lib/adminData";
import type { Merchant } from "../types";

type Lead = {
  id: string;
  trade_name: string;
  category: string;
  city: string;
  score: number;
  weeklyOrders: number;
  reasonAr: string;
  reasonEn: string;
  tags: string[];
};

type Draft = {
  trade_name?: string;
  owner_name?: string;
  phone?: string;
  email?: string;
  address?: string;
};

const cities = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Al Ain", "Ras Al Khaimah", "Fujairah"];
const categories = [
  { id: "ecommerce", ar: "متاجر إلكترونية", en: "E-commerce stores", base: 18 },
  { id: "restaurant", ar: "مطاعم وكافيهات", en: "Restaurants & cafes", base: 14 },
  { id: "pharmacy", ar: "صيدليات ومنتجات صحية", en: "Pharmacy & health", base: 16 },
  { id: "flowers", ar: "زهور وهدايا", en: "Flowers & gifts", base: 15 },
  { id: "fashion", ar: "ملابس وعطور", en: "Fashion & perfumes", base: 17 },
  { id: "documents", ar: "مكاتب ومستندات", en: "Documents & offices", base: 12 },
  { id: "electronics", ar: "إلكترونيات وإكسسوارات", en: "Electronics accessories", base: 13 },
];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function digits(value: unknown) {
  return clean(value).replace(/\D/g, "");
}

function norm(value: unknown) {
  return clean(value).toLowerCase().normalize("NFKD").replace(/[\u064B-\u065F\u0670]/g, "").replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/g, " ").trim();
}

function makeLeadName(category: string, city: string, index: number, query: string) {
  const starters = ["Prime", "Royal", "Urban", "Smart", "Golden", "Express"];
  const seed = clean(query) || category.split(" ").slice(0, 2).join(" ");
  return `${starters[index % starters.length]} ${seed} ${city}`.replace(/\s+/g, " ");
}

function buildLeads(categoryId: string, city: string, query: string): Lead[] {
  const category = categories.find((item) => item.id === categoryId) || categories[0];
  return Array.from({ length: 6 }).map((_, index) => {
    const score = Math.min(98, category.base * 4 + index * 3 + (query ? 9 : 0) + (city === "Dubai" || city === "Abu Dhabi" ? 8 : 4));
    const weeklyOrders = Math.max(8, Math.round(category.base + index * 2 + score / 10));
    return {
      id: `${category.id}-${city}-${index}-${query || "default"}`,
      trade_name: makeLeadName(category.en, city, index, query),
      category: category.en,
      city,
      score,
      weeklyOrders,
      reasonAr: `فرصة قوية: نشاط ${category.ar} في ${city} مناسب للتوصيل المحلي، الاستلام اليومي، والتتبع المباشر.`,
      reasonEn: `${category.en} in ${city} is a strong fit for local delivery, daily pickups, and live tracking.`,
      tags: [category.en, city, weeklyOrders >= 20 ? "High volume" : "Warm lead", score >= 82 ? "Priority" : "Nurture"],
    };
  });
}

function researchUrl(lead: Lead) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${lead.category} ${lead.city} UAE business`)}`;
}

function mapsUrl(lead: Lead) {
  return `https://www.google.com/maps/search/${encodeURIComponent(`${lead.category} ${lead.city} UAE`)}`;
}

function isDuplicate(lead: Lead, draft: Draft, merchants: Merchant[]) {
  const name = norm(draft.trade_name || lead.trade_name);
  const phone = digits(draft.phone).slice(-7);
  return merchants.some((merchant) => {
    const merchantPhone = digits(merchant.phone).slice(-7);
    return Boolean((name && norm(merchant.trade_name) === name) || (phone && merchantPhone && merchantPhone === phone));
  });
}

function pitch(lead: Lead, draft: Draft, isArabic: boolean) {
  const name = clean(draft.trade_name || lead.trade_name);
  if (isArabic) return `مرحباً ${name}، نحن DAY NIGHT DELIVERY SERVICES. نوفر للتجار داخل الإمارات استلام يومي، تتبع مباشر، أسعار واضحة للطلبية، وكشوفات تشغيل احترافية. يسعدنا ترتيب تجربة تشغيل سريعة.`;
  return `Hello ${name}, this is DAY NIGHT DELIVERY SERVICES. We support UAE merchants with daily pickups, live tracking, clear per-order pricing, and professional statements. We would be happy to arrange a quick trial.`;
}

export default function AdminProspectingLinks() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [categoryId, setCategoryId] = useState("ecommerce");
  const [city, setCity] = useState("Dubai");
  const [query, setQuery] = useState("");
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [notice, setNotice] = useState("");

  async function refreshMerchants() {
    setLoading(true);
    try {
      setMerchants(await fetchMerchants());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshMerchants();
  }, []);

  const leads = useMemo(() => buildLeads(categoryId, city, query), [categoryId, city, query]);
  const hotLeads = leads.filter((lead) => lead.score >= 80).length;

  function updateDraft(id: string, patch: Draft) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  function openUrl(url: string) {
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyPitch(text: string) {
    await navigator.clipboard?.writeText(text);
    setNotice(isArabic ? "تم نسخ رسالة التعاقد" : "Outreach message copied");
  }

  async function saveLead(lead: Lead) {
    const draft = drafts[lead.id] || {};
    const tradeName = clean(draft.trade_name || lead.trade_name);
    const phone = clean(draft.phone);
    if (!tradeName || !phone) {
      setNotice(isArabic ? "أدخل اسم التاجر ورقم التواصل التجاري قبل الحفظ." : "Add merchant name and business contact before saving.");
      return;
    }
    if (isDuplicate(lead, draft, merchants)) {
      setNotice(isArabic ? "التاجر موجود بالفعل أو بياناته مكررة." : "This merchant already exists or has duplicate details.");
      return;
    }
    setSavingId(lead.id);
    try {
      const merchant = await createMerchant({
        trade_name: tradeName,
        owner_name: clean(draft.owner_name),
        phone,
        email: clean(draft.email),
        emirate: lead.city,
        city: lead.city,
        address: clean(draft.address || `${lead.city} - UAE`),
        pickup_address: clean(draft.address || `${lead.city} - UAE`),
        settlement_cycle: "weekly",
        commission_type: "fixed_delivery_fee",
        default_payment_method: "sender_pays",
        status: "prospect",
        notes: [`AI Lead Hunter`, `Category: ${lead.category}`, `Score: ${lead.score}`, `Weekly potential: ${lead.weeklyOrders}`].join(" | "),
      });
      setMerchants((current) => [merchant, ...current]);
      window.dispatchEvent(new CustomEvent("dn:merchant-created", { detail: merchant }));
      setNotice(isArabic ? "تم حفظ التاجر المحتمل في قاعدة البيانات." : "Prospect merchant saved to the database.");
    } catch (error) {
      setNotice(String((error as Error)?.message || error));
    } finally {
      setSavingId("");
    }
  }

  return (
    <section id="dn-admin-prospect" className="relative overflow-hidden rounded-[2rem] border border-brand-sky/20 bg-brand-cool/25 p-5 text-white shadow-2xl shadow-black/25 sm:p-6" dir={isArabic ? "rtl" : "ltr"}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(245,183,0,0.14),transparent_22rem),radial-gradient(circle_at_88%_12%,rgba(24,168,232,0.18),transparent_26rem)]" />
      <div className="relative z-10 space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-brand-gold"><Bot className="h-4 w-4" /> {isArabic ? "AI Lead Hunter" : "AI Merchant Lead Hunter"}</span>
            <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">{isArabic ? "تحويل فرص التجار إلى حسابات حقيقية" : "Turn merchant opportunities into real accounts"}</h2>
            <p className="mt-2 max-w-4xl text-xs font-bold leading-6 text-white/55">{isArabic ? "اختر النشاط والمدينة، افتح البحث العام أو الخرائط، أدخل بيانات التواصل التجاري التي تحققها بنفسك، ثم احفظ التاجر في قاعدة البيانات ليظهر داخل البحث الذكي." : "Choose a category and city, open public research or maps, enter verified business contact details, then save the merchant to the database so it appears in smart search."}</p>
          </div>
          <button type="button" onClick={refreshMerchants} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white hover:bg-white/10"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {isArabic ? "تحديث" : "Refresh"}</button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"><Store className="mb-2 h-5 w-5 text-brand-gold" /><p className="text-2xl font-black text-white">{merchants.length}</p><p className="text-[11px] font-bold text-white/45">{isArabic ? "تاجر مسجل" : "saved merchants"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"><Target className="mb-2 h-5 w-5 text-brand-gold" /><p className="text-2xl font-black text-brand-gold">{hotLeads}</p><p className="text-[11px] font-bold text-white/45">{isArabic ? "فرص قوية" : "hot leads"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"><Zap className="mb-2 h-5 w-5 text-brand-sky" /><p className="text-2xl font-black text-brand-sky">{leads.reduce((sum, lead) => sum + lead.weeklyOrders, 0)}</p><p className="text-[11px] font-bold text-white/45">{isArabic ? "طلب/أسبوع متوقع" : "weekly potential"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"><CheckCircle2 className="mb-2 h-5 w-5 text-emerald-300" /><p className="text-2xl font-black text-emerald-300">DB</p><p className="text-[11px] font-bold text-white/45">{isArabic ? "حفظ حقيقي" : "real save"}</p></div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-brand-deep/65 p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_1.4fr]">
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="rounded-2xl border border-brand-sky/20 bg-black/20 px-4 py-3 text-sm font-black text-white outline-none">{categories.map((category) => <option key={category.id} value={category.id}>{isArabic ? category.ar : category.en}</option>)}</select>
            <select value={city} onChange={(event) => setCity(event.target.value)} className="rounded-2xl border border-brand-sky/20 bg-black/20 px-4 py-3 text-sm font-black text-white outline-none">{cities.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <div className="flex items-center gap-3 rounded-2xl border border-brand-sky/20 bg-black/20 px-4 py-3 text-brand-gold"><Search className="h-5 w-5 flex-none" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "كلمة إضافية: عطور، عبايات، متجر إلكتروني..." : "Extra keyword: perfumes, abaya, online store..."} className="w-full bg-transparent text-sm font-black text-white outline-none placeholder:text-white/28" /></div>
          </div>
        </div>

        {notice && <div className="rounded-2xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3 text-sm font-black text-brand-gold">{notice}</div>}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {leads.map((lead) => {
            const draft = drafts[lead.id] || {};
            const duplicate = isDuplicate(lead, draft, merchants);
            return (
              <article key={lead.id} className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 shadow-xl shadow-black/15">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><div className="mb-2 flex flex-wrap gap-2"><span className="rounded-full border border-brand-gold/25 bg-brand-gold/10 px-2.5 py-1 text-[10px] font-black text-brand-gold"><Sparkles className="mr-1 inline h-3.5 w-3.5" />{lead.score}%</span><span className="rounded-full border border-brand-sky/20 bg-brand-blue/10 px-2.5 py-1 text-[10px] font-black text-brand-sky">{lead.weeklyOrders} / week</span>{duplicate && <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-black text-rose-200">{isArabic ? "مكرر" : "duplicate"}</span>}</div><h3 className="truncate text-lg font-black text-white">{draft.trade_name || lead.trade_name}</h3><p className="mt-1 text-xs font-bold leading-5 text-white/48">{isArabic ? lead.reasonAr : lead.reasonEn}</p></div>
                  <Wand2 className="h-6 w-6 flex-none text-brand-gold" />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input value={draft.trade_name ?? lead.trade_name} onChange={(event) => updateDraft(lead.id, { trade_name: event.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-white outline-none" placeholder={isArabic ? "اسم التاجر" : "Merchant name"} />
                  <input value={draft.owner_name ?? ""} onChange={(event) => updateDraft(lead.id, { owner_name: event.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-white outline-none" placeholder={isArabic ? "اسم المسؤول" : "Owner / manager"} />
                  <input value={draft.phone ?? ""} onChange={(event) => updateDraft(lead.id, { phone: event.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-white outline-none" placeholder={isArabic ? "رقم التواصل التجاري" : "Business contact"} dir="ltr" />
                  <input value={draft.email ?? ""} onChange={(event) => updateDraft(lead.id, { email: event.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-white outline-none" placeholder="email@example.com" dir="ltr" />
                  <input value={draft.address ?? `${lead.city} - UAE`} onChange={(event) => updateDraft(lead.id, { address: event.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-white outline-none sm:col-span-2" placeholder={isArabic ? "العنوان / الفرع" : "Address / branch"} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">{lead.tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-white/55">{tag}</span>)}</div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button type="button" onClick={() => openUrl(researchUrl(lead))} className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black text-white hover:text-brand-gold"><ExternalLink className="h-4 w-4" /> Web</button>
                  <button type="button" onClick={() => openUrl(mapsUrl(lead))} className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black text-white hover:text-brand-gold"><MapPin className="h-4 w-4" /> Maps</button>
                  <button type="button" onClick={() => copyPitch(pitch(lead, draft, isArabic))} className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black text-white hover:text-brand-gold"><Copy className="h-4 w-4" /> Copy</button>
                  <button type="button" disabled={savingId === lead.id || duplicate} onClick={() => saveLead(lead)} className="inline-flex items-center justify-center gap-1 rounded-xl bg-brand-gold px-3 py-2 text-[11px] font-black text-brand-deep disabled:cursor-not-allowed disabled:opacity-45">{savingId === lead.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save</button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
