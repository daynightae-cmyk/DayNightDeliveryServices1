import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  Command,
  Download,
  Headphones,
  MapPin,
  PackagePlus,
  PlusSquare,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Smartphone,
  Store,
  Truck,
  WifiOff,
  X,
} from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import companyMeta from "../data/companyMeta";
import {
  activateDayNightPwaUpdate,
  DAY_NIGHT_PWA_UPDATE_EVENT,
  initializeDayNightPwaRuntime,
} from "../lib/pwaRuntime";
import "../styles/dn-production-experience.css";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type CommandItem = {
  id: string;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  path?: string;
  href?: string;
  keywords: string;
  icon: typeof Search;
};

const INSTALL_DISMISS_KEY = "dn_install_prompt_dismissed_until";
const INSTALL_DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const PROTECTED_ROUTE_PATTERN = /^\/(admin|auth|driver|merchant|customer|update-password)(\/|$)/;

function isIosDevice() {
  const userAgent = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isNativePlatform() {
  const bridge = window.Capacitor;
  if (!bridge) return false;
  return typeof bridge.isNativePlatform === "function" ? bridge.isNativePlatform() : Boolean(bridge.getPlatform?.());
}

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
}

function installPromptWasDismissed() {
  try {
    return Number(localStorage.getItem(INSTALL_DISMISS_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

function suppressInstallPrompt() {
  try {
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now() + INSTALL_DISMISS_DURATION_MS));
  } catch {
    // Storage is optional; dismissal only affects presentation.
  }
}

export default function ProductionExperience() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [online, setOnline] = useState(() => navigator.onLine);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone() || isNativePlatform());
  const [installDismissed, setInstallDismissed] = useState(() => installPromptWasDismissed());
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    initializeDayNightPwaRuntime();

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setInstallDismissed(installPromptWasDismissed());
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setShowIosGuide(false);
    };
    const handleUpdate = () => setUpdateAvailable(true);
    const handleDisplayMode = () => setInstalled(isStandalone() || isNativePlatform());

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener(DAY_NIGHT_PWA_UPDATE_EVENT, handleUpdate);
    window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", handleDisplayMode);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener(DAY_NIGHT_PWA_UPDATE_EVENT, handleUpdate);
      window.matchMedia?.("(display-mode: standalone)").removeEventListener?.("change", handleDisplayMode);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
        return;
      }

      if (event.key === "Escape") {
        setPaletteOpen(false);
        setShowIosGuide(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!paletteOpen) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [paletteOpen]);

  useEffect(() => {
    setPaletteOpen(false);
    setQuery("");
  }, [location.pathname]);

  const commands = useMemo<CommandItem[]>(
    () => [
      {
        id: "request",
        labelAr: "إضافة طلب توصيل",
        labelEn: "Create delivery request",
        descriptionAr: "ابدأ طلبًا محليًا أو دوليًا",
        descriptionEn: "Start a UAE or international request",
        path: "/request",
        keywords: "request order delivery طلب توصيل جديد",
        icon: PackagePlus,
      },
      {
        id: "tracking",
        labelAr: "تتبع شحنة",
        labelEn: "Track shipment",
        descriptionAr: "ابحث برقم التتبع أو الكوبون",
        descriptionEn: "Search by tracking or coupon number",
        path: "/tracking",
        keywords: "track tracking shipment تتبع شحنة كوبون",
        icon: MapPin,
      },
      {
        id: "merchant",
        labelAr: "بوابة التاجر",
        labelEn: "Merchant portal",
        descriptionAr: "الطلبات والتحصيل وبيانات النشاط",
        descriptionEn: "Orders, COD, and business profile",
        path: "/merchant",
        keywords: "merchant store trader تاجر متجر تحصيل",
        icon: Store,
      },
      {
        id: "driver",
        labelAr: "بوابة المندوب",
        labelEn: "Driver portal",
        descriptionAr: "المهام والموقع وحالات التسليم",
        descriptionEn: "Jobs, location, and delivery updates",
        path: "/driver",
        keywords: "driver courier مندوب سائق مهام",
        icon: Truck,
      },
      {
        id: "admin",
        labelAr: "لوحة الإدارة",
        labelEn: "Administration",
        descriptionAr: "الدخول إلى مركز العمليات المحمي",
        descriptionEn: "Open the protected operations center",
        path: "/auth",
        keywords: "admin operations إدارة عمليات دخول",
        icon: ShieldCheck,
      },
      {
        id: "pricing",
        labelAr: "الأسعار والحاسبات",
        labelEn: "Prices and calculators",
        descriptionAr: "احسب المحلي والدولي فورًا",
        descriptionEn: "Calculate UAE and international rates",
        path: "/pricing",
        keywords: "pricing calculator price أسعار حاسبة",
        icon: Building2,
      },
      {
        id: "support",
        labelAr: "دعم واتساب",
        labelEn: "WhatsApp support",
        descriptionAr: "تواصل مع فريق DAY NIGHT",
        descriptionEn: "Contact the DAY NIGHT team",
        href: companyMeta.whatsappUrl,
        keywords: "support whatsapp help دعم واتساب مساعدة",
        icon: Headphones,
      },
    ],
    [],
  );

  const filteredCommands = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;
    return commands.filter((item) =>
      `${item.labelAr} ${item.labelEn} ${item.descriptionAr} ${item.descriptionEn} ${item.keywords}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [commands, query]);

  const canInstall =
    !installed &&
    !installDismissed &&
    !isNativePlatform() &&
    !/^\/(admin|auth)(\/|$)/.test(location.pathname) &&
    (Boolean(installEvent) || isIosDevice());

  async function installApplication() {
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        setInstallEvent(null);
      } else {
        suppressInstallPrompt();
        setInstallDismissed(true);
      }
      return;
    }

    setShowIosGuide(true);
  }

  function dismissInstall() {
    suppressInstallPrompt();
    setInstallDismissed(true);
  }

  async function applyUpdate() {
    setUpdating(true);
    await activateDayNightPwaUpdate();
  }

  function executeCommand(item: CommandItem) {
    setPaletteOpen(false);
    setQuery("");
    if (item.path) {
      navigate(item.path);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (item.href) window.open(item.href, "_blank", "noopener,noreferrer");
  }

  const protectedRoute = PROTECTED_ROUTE_PATTERN.test(location.pathname);

  return (
    <>
      <div className="dn-production-stack" aria-live="polite" aria-atomic="true">
        {!online && (
          <div className="dn-production-card dn-production-card--offline" role="status">
            <span className="dn-production-card__icon"><WifiOff aria-hidden="true" /></span>
            <span className="dn-production-card__copy">
              <strong>{isArabic ? "أنت غير متصل الآن" : "You are offline"}</strong>
              <small>{isArabic ? "ستعود البيانات الحية فور استعادة الإنترنت." : "Live data resumes when the connection returns."}</small>
            </span>
          </div>
        )}

        {updateAvailable && (
          <div className="dn-production-card dn-production-card--update" role="status">
            <span className="dn-production-card__icon"><RefreshCw className={updating ? "dn-spin" : ""} aria-hidden="true" /></span>
            <span className="dn-production-card__copy">
              <strong>{isArabic ? "إصدار DAY NIGHT أحدث جاهز" : "A newer DAY NIGHT release is ready"}</strong>
              <small>{isArabic ? "حدّث الآن للحصول على آخر الإصلاحات والتحسينات." : "Reload for the latest fixes and improvements."}</small>
            </span>
            <button type="button" onClick={() => void applyUpdate()} disabled={updating} className="dn-production-action">
              {isArabic ? "تحديث" : "Update"}
            </button>
          </div>
        )}

        {canInstall && (
          <div className="dn-production-card dn-production-card--install" role="status">
            <span className="dn-production-card__icon"><Download aria-hidden="true" /></span>
            <span className="dn-production-card__copy">
              <strong>{isArabic ? "ثبّت DAY NIGHT على جهازك" : "Install DAY NIGHT"}</strong>
              <small>{isArabic ? "وصول أسرع وتجربة مستقلة بكامل الشاشة." : "Faster access and a full-screen app experience."}</small>
            </span>
            <button type="button" onClick={() => void installApplication()} className="dn-production-action">
              {isArabic ? "تثبيت" : "Install"}
            </button>
            <button type="button" onClick={dismissInstall} className="dn-production-dismiss" aria-label={isArabic ? "إخفاء اقتراح التثبيت" : "Dismiss install suggestion"}>
              <X aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {!protectedRoute && (
        <button
          type="button"
          className="dn-command-trigger"
          onClick={() => setPaletteOpen(true)}
          aria-label={isArabic ? "فتح مركز الوصول السريع" : "Open quick access center"}
          aria-keyshortcuts="Control+K Meta+K"
        >
          <Command aria-hidden="true" />
          <span>{isArabic ? "الوصول السريع" : "Quick access"}</span>
          <kbd>⌘K</kbd>
        </button>
      )}

      {paletteOpen && (
        <div className="dn-modal-layer" role="presentation" onMouseDown={() => setPaletteOpen(false)}>
          <section className="dn-command-palette" role="dialog" aria-modal="true" aria-label={isArabic ? "مركز الوصول السريع" : "Quick access center"} onMouseDown={(event) => event.stopPropagation()}>
            <header className="dn-command-header">
              <div>
                <span className="dn-command-eyebrow">DAY NIGHT CONTROL HUB</span>
                <h2>{isArabic ? "مركز الوصول السريع" : "Quick access center"}</h2>
              </div>
              <button type="button" onClick={() => setPaletteOpen(false)} aria-label={isArabic ? "إغلاق" : "Close"}><X aria-hidden="true" /></button>
            </header>

            <label className="dn-command-search">
              <Search aria-hidden="true" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={isArabic ? "ابحث عن طلب، تتبع، تاجر، مندوب أو إدارة…" : "Search request, tracking, merchant, driver, or admin…"}
              />
              <kbd>ESC</kbd>
            </label>

            <div className="dn-command-results" role="listbox">
              {filteredCommands.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} type="button" role="option" onClick={() => executeCommand(item)} className="dn-command-item">
                    <span className="dn-command-item__icon"><Icon aria-hidden="true" /></span>
                    <span className="dn-command-item__copy">
                      <strong>{isArabic ? item.labelAr : item.labelEn}</strong>
                      <small>{isArabic ? item.descriptionAr : item.descriptionEn}</small>
                    </span>
                    <span className="dn-command-item__arrow">↗</span>
                  </button>
                );
              })}

              {filteredCommands.length === 0 && (
                <div className="dn-command-empty">
                  <Search aria-hidden="true" />
                  <strong>{isArabic ? "لا توجد نتيجة مطابقة" : "No matching destination"}</strong>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {showIosGuide && (
        <div className="dn-modal-layer" role="presentation" onMouseDown={() => setShowIosGuide(false)}>
          <section className="dn-ios-guide" role="dialog" aria-modal="true" aria-label={isArabic ? "تثبيت DAY NIGHT على iPhone" : "Install DAY NIGHT on iPhone"} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <span className="dn-ios-guide__device"><Smartphone aria-hidden="true" /></span>
              <div>
                <span>DAY NIGHT FOR iPHONE</span>
                <h2>{isArabic ? "أضف التطبيق إلى الشاشة الرئيسية" : "Add the app to your Home Screen"}</h2>
              </div>
              <button type="button" onClick={() => setShowIosGuide(false)} aria-label={isArabic ? "إغلاق" : "Close"}><X aria-hidden="true" /></button>
            </header>

            <ol>
              <li><span><Share2 aria-hidden="true" /></span><div><strong>{isArabic ? "افتح قائمة المشاركة" : "Open the Share menu"}</strong><small>{isArabic ? "اضغط زر المشاركة في Safari." : "Tap Safari’s Share button."}</small></div></li>
              <li><span><PlusSquare aria-hidden="true" /></span><div><strong>{isArabic ? "اختر إضافة إلى الشاشة الرئيسية" : "Choose Add to Home Screen"}</strong><small>{isArabic ? "قد تحتاج للتمرير لأسفل داخل القائمة." : "You may need to scroll down in the menu."}</small></div></li>
              <li><span><Download aria-hidden="true" /></span><div><strong>{isArabic ? "اضغط إضافة" : "Tap Add"}</strong><small>{isArabic ? "ستظهر أيقونة DAY NIGHT وتعمل بكامل الشاشة." : "The DAY NIGHT icon will launch full screen."}</small></div></li>
            </ol>

            <button type="button" className="dn-ios-guide__done" onClick={() => setShowIosGuide(false)}>
              {isArabic ? "تم، فهمت الخطوات" : "Got it"}
            </button>
          </section>
        </div>
      )}
    </>
  );
}
