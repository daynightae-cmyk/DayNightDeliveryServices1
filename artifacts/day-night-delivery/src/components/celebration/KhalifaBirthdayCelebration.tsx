import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  getKhalifaAmbientMode,
  isKhalifaBirthdayCampaignActive,
  khalifaBirthdayConfig as cfg,
} from "../../config/khalifaBirthday";
import CelebrationDecor from "./CelebrationDecor";
import CelebrationIntro from "./CelebrationIntro";
import "../../styles/khalifa-birthday.css";

type Phase = "idle" | "intro" | "ambient" | "off";

function useMedia(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export default function KhalifaBirthdayCelebration() {
  const location = useLocation();
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const isMobile = useMedia("(max-width: 700px)");
  const [phase, setPhase] = useState<Phase>("idle");
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (!isKhalifaBirthdayCampaignActive()) {
      setPhase("off");
      return;
    }

    let seen = false;
    try {
      seen = window.sessionStorage.getItem(cfg.storageKey) === "1";
    } catch {
      seen = false;
    }

    if (seen) {
      setPhase("ambient");
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(cfg.storageKey, "1");
      } catch {
        // Storage can be blocked; the visual celebration must still work.
      }
      setPhase("intro");
    }, cfg.autoStartDelayMs);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== "intro") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPhase("ambient");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase]);

  const finish = useCallback(() => setPhase("ambient"), []);

  const replay = useCallback(() => {
    setRunId((current) => current + 1);
    setPhase("intro");
  }, []);

  if (phase === "idle" || phase === "off") return null;

  const decorMode = phase === "intro" ? "intro" : getKhalifaAmbientMode(location.pathname);

  return (
    <div
      className={"kb-root" + (reduced ? " kb-reduced" : "")}
      data-kb-mode={decorMode}
      data-kb-phase={phase}
    >
      <CelebrationDecor
        key={"decor-" + runId}
        mode={decorMode}
        isMobile={isMobile}
      />

      {phase === "intro" && (
        <CelebrationIntro
          key={"intro-" + runId + "-" + String(reduced)}
          reduced={reduced}
          isMobile={isMobile}
          onDone={finish}
        />
      )}

      {phase === "intro" ? (
        <button
          type="button"
          className="kb-action kb-skip"
          onClick={finish}
          aria-label="متابعة للموقع"
        >
          متابعة للموقع
        </button>
      ) : (
        <button
          type="button"
          className="kb-action kb-replay"
          onClick={replay}
          aria-label="إعادة عرض احتفال عيد ميلاد خليفة"
          title="عيد ميلاد خليفة"
        >
          <svg
            width="17"
            height="20"
            viewBox="0 0 60 114"
            aria-hidden="true"
          >
            <ellipse cx="30" cy="34" rx="25" ry="32" fill="currentColor" />
            <path
              d="M30 66c-6 10 6 18 0 28"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
            />
          </svg>
          <span>خليفة</span>
        </button>
      )}
    </div>
  );
}
