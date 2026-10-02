import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { getKhalifaAmbientMode, isKhalifaBirthdayCampaignActive, khalifaBirthdayConfig as cfg } from "../../config/khalifaBirthday";
import CelebrationDecor from "./CelebrationDecor";
import CelebrationIntro from "./CelebrationIntro";
import "../../styles/khalifa-birthday.css";

function useMedia(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const change = () => setMatches(media.matches);
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [query]);
  return matches;
}

export default function KhalifaBirthdayCelebration() {
  const { pathname } = useLocation();
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const mobile = useMedia("(max-width: 600px)");
  const [phase, setPhase] = useState<"idle" | "intro" | "ambient">("idle");
  const [run, setRun] = useState(0);
  const [active, setActive] = useState(isKhalifaBirthdayCampaignActive);
  useEffect(() => {
    // Recheck a configured end date while the application remains open.
    const timer = window.setInterval(() => setActive(isKhalifaBirthdayCampaignActive()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!active) return;
    let seen = false;
    try { seen = sessionStorage.getItem(cfg.storageKey) === "1"; } catch { /* Private browsing remains supported. */ }
    if (seen) { setPhase("ambient"); return; }
    const timer = window.setTimeout(() => {
      try { sessionStorage.setItem(cfg.storageKey, "1"); } catch { /* No storage is required. */ }
      setPhase("intro");
    }, cfg.autoStartDelayMs);
    return () => window.clearTimeout(timer);
  }, [active]);
  const finish = useCallback(() => setPhase("ambient"), []);
  useEffect(() => {
    if (!active || phase !== "intro") return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [active, phase, finish]);
  if (!active || phase === "idle") return null;
  const mode = phase === "intro" ? "intro" : getKhalifaAmbientMode(pathname);
  return createPortal(<div className={`kb-root${reduced ? " kb-reduced" : ""}`} data-kb-phase={phase} data-kb-mode={mode} lang="ar" dir="rtl">
    <CelebrationDecor key={run} mobile={mobile} intro={phase === "intro"} />
    {phase === "intro" && <CelebrationIntro key={`intro-${run}-${reduced}`} mobile={mobile} reduced={reduced} onDone={finish} />}
    {phase === "intro" ? <button className="kb-control kb-skip" onClick={finish}>متابعة للموقع <span aria-hidden="true">↗</span></button> :
      <button className="kb-control kb-replay" aria-label="إعادة عرض احتفال عيد ميلاد خليفة" onClick={() => { setRun(n => n + 1); setPhase("intro"); }}><span className="kb-seal" aria-hidden="true">01</span><span>خليفة</span><span aria-hidden="true">↻</span></button>}
  </div>, document.body);
}
