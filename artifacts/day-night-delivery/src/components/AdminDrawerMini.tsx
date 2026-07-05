const links = [
  ["#dn-admin-top", "لوحة التحكم"],
  ["#dn-admin-core", "إضافة طلب جديد"],
  ["#dn-admin-core", "إضافة تاجر"],
  ["#dn-admin-ai", "التجار"],
  ["#dn-admin-core", "كافة الطلبات"],
  ["#dn-admin-core", "الطلبات الملغية"],
  ["#dn-admin-core", "الطلبات قيد المراجعة"],
  ["#dn-admin-core", "الطلبات المؤجلة"],
  ["#dn-admin-core", "الطلبات الراجعة"],
  ["#dn-admin-core", "الطلبات قيد الإحضار"],
  ["#dn-admin-core", "طلبات أبوظبي"],
  ["#dn-admin-core", "الطلبات الخارجية"],
  ["#dn-admin-core", "الطلبات خارج النطاق"],
  ["#dn-admin-core", "كشوفات المناديب"],
  ["#dn-admin-core", "كشوفات التجار"],
  ["#dn-admin-core", "الدخل"],
  ["#dn-admin-core", "المصروفات"],
  ["#dn-admin-prospect", "صياد التجار"],
];

export default function AdminDrawerMini() {
  return (
    <details className="group fixed bottom-24 right-5 z-50" dir="rtl">
      <summary className="relative z-[2] cursor-pointer list-none rounded-2xl bg-brand-gold px-4 py-3 text-xs font-black text-brand-deep shadow-2xl">قائمة الإدارة / إغلاق</summary>
      <div className="fixed right-0 top-0 z-[1] h-dvh w-[min(92vw,390px)] overflow-y-auto border-l border-brand-sky/20 bg-[#031226]/95 p-5 shadow-2xl backdrop-blur-xl">
        <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
          <strong className="block text-xl font-black text-white">DAY NIGHT</strong>
          <span className="text-xs font-bold text-brand-gold">نصل إليك في كل وقت… وإدارتك أوضح من أي وقت</span>
        </div>
        {links.map(([href, label]) => <a key={label} href={href} className="mb-2 block rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white hover:border-brand-gold/40 hover:bg-white/10">{label}</a>)}
        <div className="mt-5 rounded-2xl border border-brand-gold/20 bg-brand-gold/10 p-4 text-xs font-bold leading-6 text-white/65">القائمة مبنية على طلب منصور أبو خليفه، والبيانات تظهر من النظام فقط بدون أسماء افتراضية.</div>
      </div>
    </details>
  );
}
