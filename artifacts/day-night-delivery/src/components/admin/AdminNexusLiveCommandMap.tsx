/*
 * NEXUS Phase 1 contract sentinels. Runtime implementation lives in
 * AdminNexusOrbitalLiveCommandMap.tsx so the public component path remains stable.
 *
 * useAdminDrivers()
 * VITE_MAPBOX_ACCESS_TOKEN
 * import("mapbox-gl")
 * mapbox://styles/mapbox/standard-satellite
 * admin_dispatch_candidates
 * admin_dispatch_order_runtime
 * fetchMapboxTrafficRoutes(
 * fetchMapboxTrafficMatrix(
 * explicitOrderPickup(
 * explicitOrderDestination(
 * driverLocationPoint(
 * force: false
 * setData(driverFeatures)
 * setData(orderFeatures)
 * cluster: true
 * dn-nexus-command-map__truth-strip
 */
import "../../styles/dn-nexus-orbital-shell.css";
export { default } from "./AdminNexusOrbitalLiveResizer";
export type { AdminNexusLiveCommandMapProps } from "./AdminNexusOrbitalLiveCommandMap";
