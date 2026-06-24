import { internationalShippingGuides } from "../data/internationalShipping";

export default function InternationalShippingAdvanced() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">International Shipping Advanced Guide</h2>
      <p className="text-white/70 text-sm">Delivery ETA, required documents, prohibited items, and optional insurance/packaging fees by destination.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {internationalShippingGuides.map((guide) => (
          <article key={guide.code} className="bg-brand-cool/30 border border-white/10 rounded-2xl p-4 space-y-2">
            <h3 className="font-bold text-brand-gold">{guide.country} ({guide.code})</h3>
            <p className="text-xs text-white/60">ETA: {guide.eta}</p>
            <p className="text-xs text-white/80">Documents: {guide.requiredDocuments.join(", ")}</p>
            <p className="text-xs text-white/80">Prohibited items: {guide.prohibitedItems.join(", ")}</p>
            <p className="text-xs text-white/60">Optional insurance: {guide.insuranceOptionalFee} AED</p>
            <p className="text-xs text-white/60">Special packaging: {guide.specialPackagingFee} AED</p>
          </article>
        ))}
      </div>
      <div className="bg-brand-deep/60 border border-white/10 rounded-2xl p-4 text-xs text-white/70">
        Destination map support is ready for interactive integration in the tracking map module.
      </div>
    </section>
  );
}
