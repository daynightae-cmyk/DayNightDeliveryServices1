import { useEffect, useRef, useState } from "react";
import { FileText, PackageSearch, Search, Store, WalletCards, X } from "lucide-react";
import type { MerchantGlobalSearchResult, MerchantPortalCallbacks } from "./merchantCallbacks";

export interface MerchantCommandPaletteProps {
  open: boolean;
  isArabic: boolean;
  onClose(): void;
  onSearch: MerchantPortalCallbacks["onGlobalSearch"];
  onOpenResult(result: MerchantGlobalSearchResult["results"][number]): void;
}

const resultIcons = {
  order: PackageSearch,
  invoice: FileText,
  settlement: WalletCards,
  recipient: Store,
  section: Search,
};

export function MerchantCommandPalette({ open, isArabic, onClose, onSearch, onOpenResult }: MerchantCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<MerchantGlobalSearchResult["results"]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      setError("");
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setBusy(true);
      setError("");
      try {
        const response = await onSearch(query.trim());
        if (!cancelled) {
          setResults(response.results);
          setError(response.error?.message || "");
        }
      } catch (searchError) {
        if (!cancelled) setError(searchError instanceof Error ? searchError.message : String(searchError));
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 240);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, onSearch, query]);

  if (!open) return null;

  return (
    <div className="dn-merchant-command-backdrop" role="dialog" aria-modal="true" aria-label={isArabic ? "البحث الشامل" : "Global search"} onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section className="dn-merchant-command-panel">
        <header>
          <Search className="h-5 w-5" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={isArabic ? "ابحث برقم التتبع أو الفاتورة أو الهاتف أو التسوية" : "Search tracking, invoice, phone, or settlement"}
          />
          <button type="button" onClick={onClose} aria-label={isArabic ? "إغلاق" : "Close"}><X className="h-5 w-5" /></button>
        </header>
        <div className="dn-merchant-command-results">
          {query.trim().length < 2 ? <p>{isArabic ? "اكتب حرفين على الأقل للبحث في بيانات التاجر." : "Enter at least two characters to search merchant data."}</p> : null}
          {busy ? <p className="is-busy">{isArabic ? "جاري البحث..." : "Searching..."}</p> : null}
          {error ? <p className="is-error">{error}</p> : null}
          {!busy && !error && query.trim().length >= 2 && results.length === 0 ? <p>{isArabic ? "لا توجد نتائج مطابقة." : "No matching results."}</p> : null}
          {results.map((result) => {
            const Icon = resultIcons[result.type];
            return (
              <button key={`${result.type}-${result.id}`} type="button" onClick={() => { onOpenResult(result); onClose(); }}>
                <span><Icon className="h-5 w-5" /></span>
                <div><strong>{result.title}</strong><small>{result.subtitle || result.type}</small></div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
