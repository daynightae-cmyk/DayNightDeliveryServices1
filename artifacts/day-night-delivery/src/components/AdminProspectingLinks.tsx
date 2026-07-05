import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, RefreshCw, Search, ShieldCheck, Store, Target } from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import { createMerchant, fetchMerchants } from "../lib/adminData";
import type { Merchant } from "../types";

type Draft = { trade_name: string; owner_name: string; phone: string; email: string; city: string; address: string; category: string };

const emptyDraft: Draft = { trade_name: "", owner_name: "", phone: "", email: "", city: "Abu Dhabi", address: "", category: "" };
const cities = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Al Ain", "Ras Al Khaimah", "Fujairah"];
const categories = ["مطاعم وكافيهات", "متاجر إلكترونية", "صيدليات", "عطور وملابس", "زهور وهدايا", "مكاتب ومستندات", "إلكترونيات وإكسسوارات"];

function clean(value: unknown) { return String(value ?? "").trim(); }
function digits(value: unknown) { return clean(value).replace(/\D/g, ""); }
function norm(value: unknown) { return clean(value).toLowerCase().replace(/\s+/g, " ").trim(); }
function searchUrl(kind: "web" | "maps", draft: Draft) {
  const q = `${draft.category || "business"} ${draft.city} UAE merchant delivery contact`;
  return kind === "maps" ? `https://www.google.com/maps/search/${encodeURIComponent(q)}` : `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export default function AdminProspectingLinks() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function refresh() {
    setLoading(true);
    try { setMerchants(await fetchMerchants()); } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  const visibleMerchants = useMemo(() => {
    const q = norm(term);
    if (!q) return merchants.slice(0, 12);
    return merchants.filter((merchant) => [merchant.trade_name, merchant.owner_name, merchant.phone, merchant.email, merchant.city, merchant.emirate, merchant.status].some((item) => norm(item).includes(q))).slice(0, 12);
  }, [merchants, term]);

  const duplicate = useMemo(() => {
    const phone = digits(draft.phone).slice(-7);
    const name = norm(draft.trade_name);
    return merchants.some((merchant) => (name && norm(merchant.trade_name) === name) || (phone && digits(merchant.phone).slice(-7) === phone));
  }, [draft, merchants]);

  async function saveVerifiedMerchant() {
    setNotice("");
    if (!clean(draft.trade_name) || !clean(draft.phone)) { setNotice("أدخل اسم التاجر ورقم التواصل التجاري الحقيقي قبل الحفظ."); return; }
    if (duplicate) { setNotice("هذا التاجر موجود بالفعل أو رقم الهاتف مكرر."); return; }
    setSaving(true);
    try {
      const merchant = await createMerchant({
        trade_name: clean(draft.trade_name),
        owner_name: clean(draft.owner_name),
        phone: clean(draft.phone),
        email: clean(draft.email),
        emirate: clean(draft.city),
        city: clean(draft.city),
        address: clean(draft.address),
        pickup_address: clean(draft.address),
        settlement_cycle: "weekly",
        commission_type: "fixed_delivery_fee",
        default_payment_method: "sender_pays",
        status: "prospect",
        notes: `Verified by admin lead hunter. Category: ${clean(draft.category) || "not set"}`,
      });
      setMerchants((current) => [merchant, ...current]);
      setDraft(emptyDraft);
      setNotice("تم حفظ التاجر المحتمل في قاعدة البيانات من بيانات أدخلتها الإدارة فقط.");
    } catch (error) { setNotice(String((error as Error)?.message || error)); } finally { setSaving(false); }
  }

  return (
    <section id="dn-admin-prospect" className="relative overflow-hidden rounded-[2rem] border border-brand-sky/20 bg-brand-cool/25 p-5 text-white shadow-2xl shadow-black/25 sm:p-6" dir={isArabic ? "rtl" : "ltr"}>
      <div className="relative z-10 space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div><span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1 text-[11px] font-black text-brand-gold"><Target className="h-4 w-4" /> صياد التجار الحقيقي</span><h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">إضافة فرص التجار بدون أي أسماء وهمية</h2><p className="mt-2 max-w-4xl text-xs font-bold leading-6 text-white/55">افتح البحث أو الخرائط، تحقق من بيانات النشاط التجاري بنفسك، ثم أدخل الاسم والرقم الحقيقي واحفظه في قاعدة البيانات.</p></div>
          <button type="button" onClick={refresh} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white hover:bg-white/10"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> تحديث</button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"><Store className="mb-2 h-5 w-5 text-brand-gold" /><p className="text-2xl font-black text-white">{merchants.length}</p><p className="text-[11px] font-bold text-white/45">تاجر مسجل فعلياً</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"><ShieldCheck className="mb-2 h-5 w-5 text-emerald-300" /><p className="text-2xl font-black text-emerald-300">0</p><p className="text-[11px] font-bold text-white/45">أسماء مولدة تلقائياً</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"><Target className="mb-2 h-5 w-5 text-brand-gold" /><p className="text-2xl font-black text-brand-gold">Manual</p><p className="text-[11px] font-bold text-white/45">الإضافة بقرار الإدارة فقط</p></div></div>

        <div className="rounded-3xl border border-white/10 bg-brand-deep/65 p-4"><div className="grid grid-cols-1 gap-3 lg:grid-cols-3"><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="rounded-2xl border border-brand-sky/20 bg-black/20 px-4 py-3 text-sm font-black text-white outline-none"><option value="">اختر النشاط</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select><select value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} className="rounded-2xl border border-brand-sky/20 bg-black/20 px-4 py-3 text-sm font-black text-white outline-none">{cities.map((city) => <option key={city} value={city}>{city}</option>)}</select><div className="flex gap-2"><a href={searchUrl("web", draft)} target="_blank" rel="noreferrer" className="flex-1 rounded-2xl bg-brand-gold px-4 py-3 text-center text-xs font-black text-brand-deep"><ExternalLink className="mr-1 inline h-4 w-4" /> Web</a><a href={searchUrl("maps", draft)} target="_blank" rel="noreferrer" className="flex-1 rounded-2xl border border-brand-sky/25 bg-brand-blue/10 px-4 py-3 text-center text-xs font-black text-brand-sky">Maps</a></div></div></div>

        <div className="grid grid-cols-1 gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 md:grid-cols-2 xl:grid-cols-3"><input value={draft.trade_name} onChange={(e) => setDraft({ ...draft, trade_name: e.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs font-bold text-white outline-none" placeholder="اسم التاجر الحقيقي" /><input value={draft.owner_name} onChange={(e) => setDraft({ ...draft, owner_name: e.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs font-bold text-white outline-none" placeholder="اسم المسؤول" /><input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs font-bold text-white outline-none" placeholder="رقم التواصل التجاري" dir="ltr" /><input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs font-bold text-white outline-none" placeholder="email@example.com" dir="ltr" /><input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs font-bold text-white outline-none xl:col-span-2" placeholder="العنوان الحقيقي" /><button type="button" disabled={saving || duplicate} onClick={saveVerifiedMerchant} className="rounded-xl bg-brand-gold px-4 py-3 text-xs font-black text-brand-deep disabled:opacity-45"><Plus className="mr-1 inline h-4 w-4" /> حفظ التاجر</button></div>
        {notice && <div className="rounded-2xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3 text-sm font-black text-brand-gold">{notice}</div>}

        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4"><div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-brand-gold"><Search className="h-4 w-4" /><input value={term} onChange={(e) => setTerm(e.target.value)} className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/30" placeholder="ابحث في التجار المسجلين فعلياً" /></div>{visibleMerchants.length ? <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">{visibleMerchants.map((merchant) => <article key={merchant.id} className="rounded-2xl border border-white/10 bg-brand-deep/50 p-4"><strong className="block text-sm font-black text-white">{merchant.trade_name}</strong><p className="mt-2 text-xs font-bold text-white/45">{merchant.city || merchant.emirate || "—"}</p><p className="mt-2 text-xs font-bold text-white/45" dir="ltr">{merchant.phone || "—"}</p></article>)}</div> : <p className="rounded-2xl border border-brand-gold/25 bg-brand-gold/10 p-4 text-sm font-bold text-brand-gold">لا توجد نتائج حقيقية مطابقة.</p>}</div>
      </div>
    </section>
  );
}
