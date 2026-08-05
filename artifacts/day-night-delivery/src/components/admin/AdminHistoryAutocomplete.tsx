import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { UAE_LOCATIONS } from "../../data/uaeLocations";
import { normalizeAdminCurrencyText } from "../../lib/adminLocale";
import type { Merchant, Order } from "../../types";
import "../../styles/dn-admin-final-order-ux.css";
import "../../styles/dn-admin-smart-autocomplete.css";

type Props = {
  isArabic: boolean;
  orders: Order[];
  merchants: Merchant[];
  children: ReactNode;
  scope?: string;
};

type CatalogKey =
  | "all"
  | "references"
  | "names"
  | "phones"
  | "locations"
  | "packages"
  | "amounts"
  | "notes";

type SuggestionMenuState = {
  input: HTMLInputElement | null;
  values: string[];
  selectedIndex: number;
  top: number;
  left: number;
  width: number;
};

const EMPTY_MENU: SuggestionMenuState = {
  input: null,
  values: [],
  selectedIndex: 0,
  top: 0,
  left: 0,
  width: 0,
};

const clean = (value: unknown) => String(value ?? "").trim();

function unique(values: unknown[], limit = 700) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const text = clean(value);
    const key = normalizeSearch(text);
    if (!text || text.length > 180 || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

function normalizeSearch(value: unknown) {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  return clean(value)
    .normalize("NFKD")
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/ـ/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ar");
}

function editDistance(left: string, right: string) {
  const a = left.slice(0, 48);
  const b = right.slice(0, 48);
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array<number>(b.length + 1);

  for (let row = 1; row <= a.length; row += 1) {
    current[0] = row;
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + cost,
      );
    }
    for (let column = 0; column <= b.length; column += 1) {
      previous[column] = current[column];
    }
  }

  return previous[b.length];
}

function suggestionScore(query: string, candidate: string) {
  if (!query || !candidate) return Number.POSITIVE_INFINITY;
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;

  const words = candidate.split(" ").filter(Boolean);
  const wordPrefix = words.findIndex((word) => word.startsWith(query));
  if (wordPrefix >= 0) return 10 + wordPrefix;

  const includesAt = candidate.indexOf(query);
  if (includesAt >= 0) return 20 + includesAt / 100;

  if (query.length < 3) return Number.POSITIVE_INFINITY;
  const threshold = query.length <= 4 ? 1 : Math.max(2, Math.floor(query.length * 0.34));
  const distances = [candidate, ...words]
    .filter((value) => Math.abs(value.length - query.length) <= threshold + 3)
    .map((value) => editDistance(query, value));
  const distance = distances.length ? Math.min(...distances) : Number.POSITIVE_INFINITY;
  return distance <= threshold ? 40 + distance : Number.POSITIVE_INFINITY;
}

function rankedSuggestions(values: string[], rawQuery: string, limit = 12) {
  const query = normalizeSearch(rawQuery);
  if (!query) return [];

  return values
    .map((value, index) => ({
      value,
      index,
      score: suggestionScore(query, normalizeSearch(value)),
    }))
    .filter((item) => Number.isFinite(item.score))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, limit)
    .map((item) => item.value);
}

function descriptor(input: HTMLInputElement) {
  return [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute("aria-label"),
    input.getAttribute("data-admin-complete-order-coupon"),
    input.getAttribute("data-admin-next-order-focus"),
    input.getAttribute("data-admin-personal-coupon"),
    input.getAttribute("data-admin-order-search"),
  ]
    .map(clean)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function catalogFor(input: HTMLInputElement): CatalogKey {
  const text = descriptor(input);
  if (/search|بحث/.test(text)) return "all";
  if (/coupon|tracking|invoice|reference|كوبون|تتبع|فاتور|مرجع/.test(text)) return "references";
  if (/phone|mobile|tel|هاتف|تليفون|جوال/.test(text)) return "phones";
  if (/name|merchant|sender|receiver|customer|اسم|تاجر|مرسل|مستلم|عميل/.test(text)) return "names";
  if (/address|street|location|city|area|emirate|destination|عنوان|شارع|موقع|مدينة|منطقة|إمارة|وجهة/.test(text)) return "locations";
  if (/package|content|description|shipment|parcel|محتوى|وصف|شحنة|طرد/.test(text)) return "packages";
  if (/amount|price|fee|discount|cod|goods|value|قيمة|سعر|رسوم|خصم|مبلغ|تحصيل/.test(text)) return "amounts";
  if (/note|reason|ملاحظ|سبب/.test(text)) return "notes";
  return "all";
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function menuGeometry(input: HTMLInputElement) {
  const rect = input.getBoundingClientRect();
  const viewportWidth = Math.max(window.innerWidth, 320);
  const width = Math.min(Math.max(rect.width, 280), viewportWidth - 16);
  const left = Math.min(Math.max(rect.left, 8), viewportWidth - width - 8);
  return {
    top: Math.min(rect.bottom + 6, window.innerHeight - 96),
    left,
    width,
  };
}

export default function AdminHistoryAutocomplete({
  isArabic,
  orders,
  merchants,
  children,
  scope = "admin",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<SuggestionMenuState>(EMPTY_MENU);
  const [menu, setMenu] = useState<SuggestionMenuState>(EMPTY_MENU);
  const safeScope = scope.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();

  const catalogs = useMemo(() => {
    const references = unique(
      orders.flatMap((order) => [
        order.coupon_number,
        order.tracking_number,
        order.invoice_number,
        order.id,
      ]),
    );
    const names = unique([
      ...orders.flatMap((order) => [
        order.merchant_name,
        order.sender_name,
        order.receiver_name,
        order.customer_name,
        order.driver_name,
      ]),
      ...merchants.flatMap((merchant) => [
        merchant.owner_name,
        merchant.trade_name,
        merchant.merchant_code,
      ]),
    ]);
    const phones = unique([
      ...orders.flatMap((order) => [
        order.sender_phone,
        order.receiver_phone,
        order.customer_phone,
        order.driver_phone,
      ]),
      ...merchants.map((merchant) => merchant.phone),
    ]);
    const officialLocations = UAE_LOCATIONS.flatMap((emirate) => [
      emirate.value,
      emirate.ar,
      emirate.en,
      ...emirate.areas.flatMap((area) => [area.value, area.ar, area.en]),
    ]);
    const locations = unique([
      ...officialLocations,
      ...orders.flatMap((order) => [
        order.sender_city,
        order.receiver_city,
        order.destination_country,
        order.sender_address,
        order.receiver_address,
      ]),
      ...merchants.flatMap((merchant) => [
        merchant.emirate,
        merchant.city,
        merchant.address,
        merchant.pickup_address,
      ]),
    ]);
    const packages = unique(
      orders.flatMap((order) => [order.package_type, order.package_description]),
    );
    const amounts = unique(
      orders.flatMap((order) => [
        order.cod_amount,
        order.goods_value,
        order.delivery_price,
        order.delivery_fee,
        order.discount_amount,
        order.customer_total,
        order.merchant_due,
      ]),
    );
    const notes = unique(orders.flatMap((order) => [order.notes, order.status]));
    const all = unique(
      [...references, ...names, ...phones, ...locations, ...packages, ...amounts, ...notes],
      1100,
    );
    return { all, references, names, phones, locations, packages, amounts, notes };
  }, [merchants, orders]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const publish = (next: SuggestionMenuState) => {
      menuRef.current = next;
      setMenu(next);
    };
    const close = () => publish(EMPTY_MENU);
    const openFor = (input: HTMLInputElement) => {
      const key = catalogFor(input);
      const values = rankedSuggestions(catalogs[key], input.value);
      if (!values.length) {
        close();
        return;
      }
      publish({ input, values, selectedIndex: 0, ...menuGeometry(input) });
    };
    const commit = (input: HTMLInputElement, value: string) => {
      setNativeInputValue(input, value);
      input.focus({ preventScroll: true });
      close();
    };

    const bound = new Map<
      HTMLInputElement,
      {
        focus: () => void;
        input: () => void;
        blur: () => void;
        keydown: (event: KeyboardEvent) => void;
      }
    >();

    const bind = () => {
      const inputs = root.querySelectorAll<HTMLInputElement>(
        'input:not([type="hidden"]):not([type="password"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="date"]):not([type="datetime-local"]):not([type="number"]):not([inputmode="decimal"]):not([inputmode="numeric"]):not([data-admin-financial-input="true"]):not([readonly]):not([disabled])',
      );
      for (const input of inputs) {
        if (
          input.dataset.adminFinancialInput === "true" ||
          input.type === "number" ||
          input.inputMode === "decimal" ||
          input.inputMode === "numeric"
        ) {
          continue;
        }
        if (bound.has(input)) continue;
        const focus = () => openFor(input);
        const handleInput = () => openFor(input);
        const blur = () => {
          window.setTimeout(() => {
            if (menuRef.current.input === input) close();
          }, 120);
        };
        const keydown = (event: KeyboardEvent) => {
          const current = menuRef.current;
          if (current.input !== input || !current.values.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            publish({
              ...current,
              selectedIndex: (current.selectedIndex + 1) % current.values.length,
            });
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            publish({
              ...current,
              selectedIndex:
                (current.selectedIndex - 1 + current.values.length) % current.values.length,
            });
          } else if (event.key === "Enter") {
            event.preventDefault();
            commit(input, current.values[current.selectedIndex]);
          } else if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        };

        input.addEventListener("focus", focus);
        input.addEventListener("input", handleInput);
        input.addEventListener("blur", blur);
        input.addEventListener("keydown", keydown);
        input.setAttribute("autocomplete", "off");
        input.setAttribute("data-admin-smart-autocomplete-bound", "true");
        input.dataset.adminSmartAutocomplete = catalogFor(input);
        input.title ||= isArabic
          ? "ابدأ بكتابة حرف أو رقم لإظهار القيم المشابهة المسجلة سابقًا."
          : "Type a letter or number to show similar values entered previously.";
        bound.set(input, { focus, input: handleInput, blur, keydown });
      }
    };

    const reposition = () => {
      const current = menuRef.current;
      if (!current.input || !document.contains(current.input)) {
        close();
        return;
      }
      publish({ ...current, ...menuGeometry(current.input) });
    };

    bind();
    const observer = new MutationObserver(bind);
    observer.observe(root, { childList: true, subtree: true });
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      for (const [input, handlers] of bound) {
        input.removeEventListener("focus", handlers.focus);
        input.removeEventListener("input", handlers.input);
        input.removeEventListener("blur", handlers.blur);
        input.removeEventListener("keydown", handlers.keydown);
        delete input.dataset.adminSmartAutocompleteBound;
        delete input.dataset.adminSmartAutocomplete;
      }
      close();
    };
  }, [catalogs, isArabic, safeScope]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !isArabic) return;

    const originalText = new Map<Text, string>();
    const originalAttributes = new Map<Element, Map<string, string>>();
    const attributes = ["placeholder", "title", "aria-label"];

    const translateCurrencies = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const textNode = node as Text;
        const parent = textNode.parentElement;
        if (parent && !["SCRIPT", "STYLE"].includes(parent.tagName)) {
          const current = textNode.nodeValue || "";
          const previousOriginal = originalText.get(textNode);
          const previousTranslated =
            previousOriginal === undefined
              ? undefined
              : normalizeAdminCurrencyText(previousOriginal, true);

          // A React render can reuse the same Text node with a new value. Only
          // preserve the prior source while the current value is our own
          // localized projection; otherwise adopt React's latest value as the
          // new source of truth before translating it.
          if (
            previousOriginal === undefined ||
            current !== previousTranslated
          ) {
            originalText.set(textNode, current);
          }

          const original = originalText.get(textNode) || "";
          const translated = normalizeAdminCurrencyText(original, true);
          if (translated !== current) textNode.nodeValue = translated;
        }
        node = walker.nextNode();
      }

      for (const element of root.querySelectorAll<HTMLElement>("[placeholder], [title], [aria-label]")) {
        let stored = originalAttributes.get(element);
        if (!stored) {
          stored = new Map<string, string>();
          originalAttributes.set(element, stored);
        }
        for (const attribute of attributes) {
          const value = element.getAttribute(attribute);
          if (!value) continue;
          const previousOriginal = stored.get(attribute);
          const previousTranslated =
            previousOriginal === undefined
              ? undefined
              : normalizeAdminCurrencyText(previousOriginal, true);
          if (
            previousOriginal === undefined ||
            value !== previousTranslated
          ) {
            stored.set(attribute, value);
          }
          const translated = normalizeAdminCurrencyText(
            stored.get(attribute) || value,
            true,
          );
          if (translated !== value) element.setAttribute(attribute, translated);
        }
      }
    };

    translateCurrencies();
    const observer = new MutationObserver(translateCurrencies);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: attributes,
    });

    return () => {
      observer.disconnect();
      for (const [node, value] of originalText) {
        if (document.contains(node)) node.nodeValue = value;
      }
      for (const [element, stored] of originalAttributes) {
        if (!document.contains(element)) continue;
        for (const [attribute, value] of stored) element.setAttribute(attribute, value);
      }
    };
  }, [isArabic]);

  const chooseSuggestion = (value: string) => {
    const input = menu.input;
    if (!input) return;
    setNativeInputValue(input, value);
    input.focus({ preventScroll: true });
    menuRef.current = EMPTY_MENU;
    setMenu(EMPTY_MENU);
  };

  const handleSuggestionKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    value: string,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      chooseSuggestion(value);
    }
  };

  return (
    <div
      ref={rootRef}
      className="dn-admin-history-autocomplete"
      data-admin-google-suggestions="true"
      data-admin-suggestion-count={catalogs.all.length}
      data-admin-suggestion-scope={safeScope}
    >
      {children}
      {menu.input && menu.values.length > 0 && (
        <div
          className="dn-admin-smart-suggestion-menu"
          style={{ top: menu.top, left: menu.left, width: menu.width }}
          role="listbox"
          aria-label={isArabic ? "اقتراحات مشابهة" : "Similar suggestions"}
          dir={isArabic ? "rtl" : "ltr"}
        >
          <div className="dn-admin-smart-suggestion-head">
            <span>{isArabic ? "اقتراحات ذكية" : "Smart suggestions"}</span>
            <small>
              {isArabic
                ? "من المناطق والطلبات والبيانات السابقة"
                : "From locations, orders, and prior data"}
            </small>
          </div>
          <div className="dn-admin-smart-suggestion-results">
            {menu.values.map((value, index) => (
              <button
                type="button"
                role="option"
                aria-selected={menu.selectedIndex === index}
                className={menu.selectedIndex === index ? "is-selected" : ""}
                key={`${catalogFor(menu.input!)}:${value}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseSuggestion(value)}
                onKeyDown={(event) => handleSuggestionKeyDown(event, value)}
              >
                <span>{value}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
