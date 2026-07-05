export default function AdminDrawerMini() {
  return (
    <details className="group fixed bottom-24 left-5 z-50">
      <summary className="cursor-pointer list-none rounded-2xl bg-brand-gold px-4 py-3 text-xs font-black text-brand-deep shadow-2xl">Operations Menu</summary>
      <div className="fixed left-0 top-0 h-dvh w-[min(92vw,390px)] overflow-y-auto border-r border-brand-sky/20 bg-[#031226]/95 p-5 shadow-2xl backdrop-blur-xl">
        <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <strong className="block text-xl font-black text-white">DAY NIGHT</strong>
          <span className="text-xs font-bold text-white/45">Admin Operations Hub</span>
        </div>
        <a href="#dn-admin-top" className="mb-2 block rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/10">Overview</a>
        <a href="#dn-admin-ai" className="mb-2 block rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/10">Merchant Search</a>
        <a href="#dn-admin-core" className="mb-2 block rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/10">Orders Workspace</a>
        <a href="#dn-admin-ai" className="mb-2 block rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/10">Admin Alerts</a>
        <div className="mt-5 rounded-2xl border border-brand-gold/20 bg-brand-gold/10 p-4 text-xs font-bold leading-6 text-white/65">Use this side menu to jump between live merchant intelligence, order creation, and operations data.</div>
      </div>
    </details>
  );
}
