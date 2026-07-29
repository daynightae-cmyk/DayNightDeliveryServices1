export {
  internationalTrackingAssets,
  internationalTrackingAssetList,
  internationalTrackingAssetManifest,
  type InternationalTrackingAssetCategory,
  type InternationalTrackingAssetRecord,
} from "../lib/internationalTrackingAssets";

export const internationalTrackingAssetSyncVersion = "2026-07-29.2";

// Compatibility manifest retained for existing visual gates and asset-sync tooling.
export const internationalTrackingLegacyAssetIds = {
  id: 33,
  reservedAsset15: null,
} as const;
