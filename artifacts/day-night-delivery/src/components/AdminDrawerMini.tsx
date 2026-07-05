export default function AdminDrawerMini() {
  return (
    <details className="group fixed bottom-24 left-5 z-50">
      <summary className="cursor-pointer list-none rounded-2xl bg-brand-gold px-4 py-3 text-xs font-black text-brand-deep shadow-2xl">Admin Menu</summary>
      <div className="mt-3 w-72 rounded-2xl border border-white/10 bg-brand-deep p-3 shadow-2xl">
        <a href="#dn-admin-top" className="block rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/10">Overview</a>
        <a href="#dn-admin-ai" className="block rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/10">Smart Search</a>
        <a href="#dn-admin-core" className="block rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/10">Orders</a>
        <a href="#dn-admin-ai" className="block rounded-xl px-4 py-3 text-sm font-bold text-white hover:bg-white/10">Alerts</a>
      </div>
    </details>
  );
}
