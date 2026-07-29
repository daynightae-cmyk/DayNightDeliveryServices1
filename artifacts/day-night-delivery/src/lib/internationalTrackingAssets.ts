export type InternationalTrackingAssetCategory = "branding" | "aircraft" | "map" | "references";

export type InternationalTrackingAssetRecord = {
  id: number;
  category: InternationalTrackingAssetCategory;
  sourceUrl: string;
  localPath: string;
  description: string;
  transparent?: boolean;
};

const root = "/assets/international-tracking";

export const internationalTrackingAssets = {
  masterLogo: `${root}/branding/daynight-official-master-logo.png`,
  masterLogoFallback: "/assets/daynight/logo.png",

  branding: {
    officialMasterLogo: `${root}/branding/daynight-official-master-logo.png`,
  },

  aircraft: {
    longSide: `${root}/aircraft/daynight-aircraft-long-side-profile.jpg`,
    sideTransparent: `${root}/aircraft/daynight-aircraft-side-transparent.png`,
    threeQuarterFront: `${root}/aircraft/daynight-aircraft-three-quarter-front.png`,
    flightSide: `${root}/aircraft/daynight-aircraft-flight-side.png`,
    frontTransparent: `${root}/aircraft/daynight-aircraft-front-transparent.png`,
  },

  map: {
    masterSheet: `${root}/map/daynight-map-assets-master-sheet.png`,
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
    routeStatsGrid: `${root}/references/daynight-route-stats-grid.png`,
    eventsCargoPanel: `${root}/references/daynight-events-cargo-details-panel.png`,
    desktopB: `${root}/references/daynight-desktop-master-layout-b.png`,
    routeProgressWide: `${root}/references/daynight-route-progress-wide-a.png`,
    liveMap: `${root}/references/daynight-live-map-primary-reference.png`,
    topbarA: `${root}/references/daynight-topbar-reference-a.png`,
    cargoDetailsGrid: `${root}/references/daynight-cargo-details-grid-primary.png`,
    shipmentSummaryDocs: `${root}/references/daynight-shipment-summary-documents-card.png`,
    globalNetworkMap: `${root}/references/daynight-global-network-map-reference.png`,
    operationsDesktop: `${root}/references/daynight-desktop-operations-layout.png`,
    mapFirstDashboard: `${root}/references/daynight-map-first-live-dashboard.png`,
    overviewVerticalCard: `${root}/references/daynight-shipment-overview-vertical-card.png`,
    selectedShipmentCard: `${root}/references/daynight-selected-shipment-card-primary.png`,
    compactShipmentList: `${root}/references/daynight-compact-shipment-list.png`,
    timelinePrimary: `${root}/references/daynight-shipment-timeline-primary.png`,
    trackingListDesktop: `${root}/references/daynight-tracking-list-desktop-primary.png`,
    trackingListNarrow: `${root}/references/daynight-tracking-list-narrow.png`,
    shipmentLifecycle: `${root}/references/daynight-shipment-lifecycle-timeline.png`,
    mobileA: `${root}/references/daynight-mobile-tracking-dashboard-a.png`,
    mobileB: `${root}/references/daynight-mobile-tracking-dashboard-b.png`,
    analytics: `${root}/references/daynight-international-tracking-analytics.png`,
    routeProgressPrimary: `${root}/references/daynight-route-progress-component-primary.png`,
    cinematicHero: `${root}/references/daynight-cinematic-shipment-hero.png`,
    topbarPrimary: `${root}/references/daynight-topbar-reference-primary.png`,
  },

  reservedAsset15: null,
} as const;

export const internationalTrackingAssetManifest: Record<string, InternationalTrackingAssetRecord | null> = {
  asset1: { id: 1, category: "aircraft", sourceUrl: "https://i.postimg.cc/05tJN1Hh/1.jpg", localPath: internationalTrackingAssets.aircraft.longSide, description: "Long side aircraft profile" },
  asset2: { id: 2, category: "aircraft", sourceUrl: "https://i.postimg.cc/7YdGgM4M/2.png", localPath: internationalTrackingAssets.aircraft.sideTransparent, description: "Transparent side aircraft", transparent: true },
  asset3: { id: 3, category: "aircraft", sourceUrl: "https://i.postimg.cc/fTptxjs7/3.png", localPath: internationalTrackingAssets.aircraft.threeQuarterFront, description: "Three-quarter front aircraft", transparent: true },
  asset4: { id: 4, category: "aircraft", sourceUrl: "https://i.postimg.cc/bNWDQHP1/4.png", localPath: internationalTrackingAssets.aircraft.flightSide, description: "Flight side aircraft", transparent: true },
  asset5: { id: 5, category: "map", sourceUrl: "https://i.postimg.cc/9FKRGt2G/5.png", localPath: internationalTrackingAssets.map.masterSheet, description: "Map markers and route master sheet", transparent: true },
  asset6: { id: 6, category: "aircraft", sourceUrl: "https://i.postimg.cc/MG8nL6vk/6.png", localPath: internationalTrackingAssets.aircraft.frontTransparent, description: "Front transparent aircraft", transparent: true },
  asset7: { id: 7, category: "references", sourceUrl: "https://i.postimg.cc/7ZzCXGYk/7.png", localPath: internationalTrackingAssets.references.desktopA, description: "Desktop master layout A" },
  asset8: { id: 8, category: "references", sourceUrl: "https://i.postimg.cc/d0KhfsLv/8.png", localPath: internationalTrackingAssets.references.routeStatsGrid, description: "Route statistics grid" },
  asset9: { id: 9, category: "references", sourceUrl: "https://i.postimg.cc/7Ly5RHbp/9.png", localPath: internationalTrackingAssets.references.eventsCargoPanel, description: "Events and cargo panel" },
  asset10: { id: 10, category: "references", sourceUrl: "https://i.postimg.cc/TPXKsdpy/10.png", localPath: internationalTrackingAssets.references.desktopB, description: "Desktop master layout B" },
  asset11: { id: 11, category: "references", sourceUrl: "https://i.postimg.cc/PqkC7XP8/11.png", localPath: internationalTrackingAssets.references.routeProgressWide, description: "Wide route progress" },
  asset12: { id: 12, category: "references", sourceUrl: "https://i.postimg.cc/cJMvypnt/12.png", localPath: internationalTrackingAssets.references.liveMap, description: "Primary live map" },
  asset13: { id: 13, category: "references", sourceUrl: "https://i.postimg.cc/0NdzRTwz/13.png", localPath: internationalTrackingAssets.references.topbarA, description: "Bilingual topbar" },
  asset14: { id: 14, category: "references", sourceUrl: "https://i.postimg.cc/q7XNVP3s/14.png", localPath: internationalTrackingAssets.references.cargoDetailsGrid, description: "Cargo details grid" },
  asset15: null,
  asset16: { id: 16, category: "references", sourceUrl: "https://i.postimg.cc/N07Kq3Hd/16.png", localPath: internationalTrackingAssets.references.shipmentSummaryDocs, description: "Shipment summary and documents" },
  asset17: { id: 17, category: "references", sourceUrl: "https://i.postimg.cc/hjDfS28g/17.png", localPath: internationalTrackingAssets.references.globalNetworkMap, description: "Global network map" },
  asset18: { id: 18, category: "references", sourceUrl: "https://i.postimg.cc/yd1kVLhs/18.png", localPath: internationalTrackingAssets.references.operationsDesktop, description: "Desktop operations layout" },
  asset19: { id: 19, category: "references", sourceUrl: "https://i.postimg.cc/4dWnnpwG/19.png", localPath: internationalTrackingAssets.references.mapFirstDashboard, description: "Map-first dashboard" },
  asset20: { id: 20, category: "references", sourceUrl: "https://i.postimg.cc/85ZssLwP/20.png", localPath: internationalTrackingAssets.references.overviewVerticalCard, description: "Vertical shipment overview" },
  asset21: { id: 21, category: "references", sourceUrl: "https://i.postimg.cc/0jrjSrHK/21.png", localPath: internationalTrackingAssets.references.selectedShipmentCard, description: "Selected shipment card" },
  asset22: { id: 22, category: "references", sourceUrl: "https://i.postimg.cc/Zn0nN0DV/22.png", localPath: internationalTrackingAssets.references.compactShipmentList, description: "Compact shipment list" },
  asset23: { id: 23, category: "references", sourceUrl: "https://i.postimg.cc/T1h1bhHt/23.png", localPath: internationalTrackingAssets.references.timelinePrimary, description: "Primary shipment timeline" },
  asset24: { id: 24, category: "references", sourceUrl: "https://i.postimg.cc/j2C2fCkk/24.png", localPath: internationalTrackingAssets.references.trackingListDesktop, description: "Desktop tracking list" },
  asset25: { id: 25, category: "references", sourceUrl: "https://i.postimg.cc/fyFLfZ6C/25.png", localPath: internationalTrackingAssets.references.trackingListNarrow, description: "Narrow tracking list" },
  asset26: { id: 26, category: "references", sourceUrl: "https://i.postimg.cc/2yJ67msp/26.png", localPath: internationalTrackingAssets.references.shipmentLifecycle, description: "Shipment lifecycle timeline" },
  asset27: { id: 27, category: "references", sourceUrl: "https://i.postimg.cc/vTjBtMJd/27.png", localPath: internationalTrackingAssets.references.mobileA, description: "Mobile tracking dashboard A" },
  asset28: { id: 28, category: "references", sourceUrl: "https://i.postimg.cc/90SMYV6W/28.png", localPath: internationalTrackingAssets.references.mobileB, description: "Mobile tracking dashboard B" },
  asset29: { id: 29, category: "references", sourceUrl: "https://i.postimg.cc/1RYfQcf6/29.png", localPath: internationalTrackingAssets.references.analytics, description: "International tracking analytics" },
  asset30: { id: 30, category: "references", sourceUrl: "https://i.postimg.cc/2jXVDFV7/30.png", localPath: internationalTrackingAssets.references.routeProgressPrimary, description: "Primary route progress component" },
  asset31: { id: 31, category: "references", sourceUrl: "https://i.postimg.cc/h43fBbfr/31.png", localPath: internationalTrackingAssets.references.cinematicHero, description: "Cinematic shipment hero" },
  asset32: { id: 32, category: "references", sourceUrl: "https://i.postimg.cc/9XNrhtrb/32.png", localPath: internationalTrackingAssets.references.topbarPrimary, description: "Primary desktop topbar" },
  asset33: { id: 33, category: "branding", sourceUrl: "https://i.postimg.cc/QNnH3kHz/33.png", localPath: internationalTrackingAssets.branding.officialMasterLogo, description: "Official DAY NIGHT master logo", transparent: true },
};

export const internationalTrackingAssetList = Object.values(internationalTrackingAssetManifest).filter(
  (asset): asset is InternationalTrackingAssetRecord => asset !== null,
);
