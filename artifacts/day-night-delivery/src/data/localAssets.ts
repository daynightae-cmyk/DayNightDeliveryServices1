import type { SyntheticEvent } from "react";

export const localAssets = {
  logo: "/assets/daynight/logo.png",
  hero: "/assets/daynight/hero-uae-delivery.png",
  driverVehicle: "/assets/daynight/driver/daynight-toyota-rush-cutout.png",
  uaeMap: "/assets/daynight/uae-live-map.png",
  remote: {
    logo: "https://i.postimg.cc/BnMJh77T/Chat-GPT-Image-Jun-23-2026-05-21-26-PM.png",
    hero: "https://i.postimg.cc/cJ7MbD6R/Chat-GPT-Image-22-ywnyw-2026-04-52-05-m-(10).png",
    uaeMap: "https://i.postimg.cc/GhGvg7Bw/Chat-GPT-Image-27-ywnyw-2026-04-49-00-s.png",
  },
} as const;

export function withRemoteFallback(event: SyntheticEvent<HTMLImageElement>, remoteUrl: string) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = remoteUrl;
}

export default localAssets;
