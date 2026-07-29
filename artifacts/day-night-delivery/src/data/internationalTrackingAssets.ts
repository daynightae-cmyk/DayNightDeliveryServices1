export type InternationalTrackingAsset = {
  id: number | string;
  fileName: string;
  sourceUrl: string | null;
  localPath: string | null;
  usage: string;
  priority: "primary" | "secondary" | "reference" | "reserved";
  transparent?: boolean;
};

const root = "/assets/international-tracking";
export const internationalTrackingAssetSyncVersion = "2026-07-29.1";

export const internationalTrackingAssets = {
  masterLogo: `${root}/branding/daynight-official-master-logo.png`,
  masterLogoFallback: "/assets/daynight/logo.png",
  aircraft: {
    longSide: `${root}/aircraft/daynight-aircraft-long-side-profile.jpg`,
    sideTransparent: `${root}/aircraft/daynight-aircraft-side-transparent.png`,
    threeQuarterFront: `${root}/aircraft/daynight-aircraft-three-quarter-front.png`,
    flightSide: `${root}/aircraft/daynight-aircraft-flight-side.png`,
    frontTransparent: `${root}/aircraft/daynight-aircraft-front-transparent.png`,
  },
  markers: {
    aircraftFront: `${root}/markers/map-aircraft-front.png`,
    aircraftDayNight: `${root}/markers/map-aircraft-side-daynight.png`,
    aircraftPartner: `${root}/markers/map-aircraft-side-partner.png`,
    dayNightPin: `${root}/markers/map-pin-daynight.png`,
    carrierPin: `${root}/markers/map-pin-carrier.png`,
    currentPin: `${root}/markers/map-pin-current-location.png`,
    routeBlue: `${root}/markers/map-route-dots-blue.png`,
    routeGold: `${root}/markers/map-route-dots-gold.png`,
    lightWhite: `${root}/markers/map-aircraft-light-white.png`,
  },
  references: {
    desktopA: `${root}/references/daynight-desktop-master-layout-a.png`,
    desktopB: `${root}/references/daynight-desktop-master-layout-b.png`,
    liveMap: `${root}/references/daynight-live-map-primary-reference.png`,
    globalMap: `${root}/references/daynight-global-network-map-reference.png`,
    operations: `${root}/references/daynight-desktop-operations-layout.png`,
    mobileA: `${root}/references/daynight-mobile-tracking-dashboard-a.png`,
    mobileB: `${root}/references/daynight-mobile-tracking-dashboard-b.png`,
    cinematicHero: `${root}/references/daynight-cinematic-shipment-hero.png`,
  },
  reservedAsset15: null,
} as const;

const asset = (id: number, fileName: string, code: string | null, folder: string | null, usage: string, priority: InternationalTrackingAsset["priority"], transparent = false): InternationalTrackingAsset => ({
  id,
  fileName,
  sourceUrl: code ? `https://i.postimg.cc/${code}/${id}.${fileName.endsWith(".jpg") ? "jpg" : "png"}` : null,
  localPath: folder ? `${root}/${folder}/${fileName}` : null,
  usage,
  priority,
  transparent,
});

export const internationalTrackingAssetManifest: InternationalTrackingAsset[] = [
  asset(1, "daynight-aircraft-long-side-profile.jpg", "05tJN1Hh", "aircraft", "Desktop aircraft information and overview strip", "secondary"),
  asset(2, "daynight-aircraft-side-transparent.png", "7YdGgM4M", "aircraft", "Route progress and compact shipment cards", "primary", true),
  asset(3, "daynight-aircraft-three-quarter-front.png", "fTptxjs7", "aircraft", "Initial and selected-shipment cinematic hero", "primary", true),
  asset(4, "daynight-aircraft-flight-side.png", "bNWDQHP1", "aircraft", "Route and map aircraft marker", "primary", true),
  asset(5, "daynight-map-assets-master-sheet.png", "9FKRGt2G", "map", "Source sheet for map markers and route lights", "primary", true),
  asset(6, "daynight-aircraft-front-transparent.png", "MG8nL6vk", "aircraft", "Selected shipment hero and loading state", "primary", true),
  asset(7, "daynight-desktop-master-layout-a.png", "7ZzCXGYk", "references", "Primary public desktop composition reference", "primary"),
  asset(8, "daynight-route-stats-grid.png", "d0KhfsLv", "references", "Overview metrics and route summary reference", "secondary"),
  asset(9, "daynight-events-cargo-details-panel.png", "7Ly5RHbp", "references", "Events and cargo details reference", "secondary"),
  asset(10, "daynight-desktop-master-layout-b.png", "TPXKsdpy", "references", "Desktop finish and map-detail reference", "primary"),
  asset(11, "daynight-route-progress-wide-a.png", "PqkC7XP8", "references", "Wide route progress reference", "secondary"),
  asset(12, "daynight-live-map-primary-reference.png", "cJMvypnt", "references", "Primary live map visual reference", "primary"),
  asset(13, "daynight-topbar-reference-a.png", "0NdzRTwz", "references", "Bilingual topbar reference", "secondary"),
  asset(14, "daynight-cargo-details-grid-primary.png", "q7XNVP3s", "references", "Primary shipment details reference", "primary"),
  { id: 15, fileName: "asset15", sourceUrl: null, localPath: null, usage: "Reserved: no source supplied", priority: "reserved" },
  asset(16, "daynight-shipment-summary-documents-card.png", "N07Kq3Hd", "references", "Shipment summary and documents reference", "secondary"),
  asset(17, "daynight-global-network-map-reference.png", "hjDfS28g", "references", "Initial global network map reference", "primary"),
  asset(18, "daynight-desktop-operations-layout.png", "yd1kVLhs", "references", "Internal operations layout reference", "reference"),
  asset(19, "daynight-map-first-live-dashboard.png", "4dWnnpwG", "references", "Map-first operations reference", "reference"),
  asset(20, "daynight-shipment-overview-vertical-card.png", "85ZssLwP", "references", "Tablet and mobile selected shipment reference", "secondary"),
  asset(21, "daynight-selected-shipment-card-primary.png", "0jrjSrHK", "references", "Primary selected shipment card reference", "primary"),
  asset(22, "daynight-compact-shipment-list.png", "Zn0nN0DV", "references", "Compact and mobile list reference", "secondary"),
  asset(23, "daynight-shipment-timeline-primary.png", "T1h1bhHt", "references", "Primary desktop timeline reference", "primary"),
  asset(24, "daynight-tracking-list-desktop-primary.png", "j2C2fCkk", "references", "Desktop shipment-list reference", "primary"),
  asset(25, "daynight-tracking-list-narrow.png", "fyFLfZ6C", "references", "Narrow sidebar and drawer reference", "secondary"),
  asset(26, "daynight-shipment-lifecycle-timeline.png", "2yJ67msp", "references", "Complete lifecycle and mobile timeline reference", "primary"),
  asset(27, "daynight-mobile-tracking-dashboard-a.png", "vTjBtMJd", "references", "Mobile summary dashboard reference", "secondary"),
  asset(28, "daynight-mobile-tracking-dashboard-b.png", "90SMYV6W", "references", "Primary mobile tracking reference", "primary"),
  asset(29, "daynight-international-tracking-analytics.png", "1RYfQcf6", "references", "Admin analytics only", "reference"),
  asset(30, "daynight-route-progress-component-primary.png", "2jXVDFV7", "references", "Primary reusable route progress reference", "primary"),
  asset(31, "daynight-cinematic-shipment-hero.png", "h43fBbfr", "references", "Cinematic shipment hero reference", "secondary"),
  asset(32, "daynight-topbar-reference-primary.png", "9XNrhtrb", "references", "Primary desktop topbar reference", "primary"),
  asset(33, "daynight-official-master-logo.png", "QNnH3kHz", "branding", "Official logo in header, states, print and share", "primary", true),
];
