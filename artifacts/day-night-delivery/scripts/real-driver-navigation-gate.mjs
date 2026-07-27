import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let failed = false;

function read(relative) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) {
    console.error(`FAIL: missing ${relative}`);
    failed = true;
    return "";
  }
  console.log(`PASS: ${relative}`);
  return fs.readFileSync(target, "utf8");
}

function expect(content, pattern, label) {
  if (!pattern.test(content)) {
    console.error(`FAIL: ${label}`);
    failed = true;
  } else console.log(`PASS: ${label}`);
}

function reject(content, pattern, label) {
  if (pattern.test(content)) {
    console.error(`FAIL: ${label}`);
    failed = true;
  } else console.log(`PASS: ${label}`);
}

console.log("\n--- DAY NIGHT real driver navigation gate ---");
const map = read("src/components/tracking/TrackingMap.tsx");
const marker = read("src/components/maps/DayNightVehicleMarker.tsx");
const navigation = read("src/services/realDriverNavigationService.ts");
const styles = read("src/styles/dn-real-driver-navigation.css");

expect(navigation, /rawLat === null[\s\S]*rawLng === null/, "Null database coordinates are rejected instead of becoming 0,0");
expect(navigation, /fetchRealDrivingRoute/, "Road geometry is fetched from a routing engine");
expect(navigation, /geometries=geojson/, "Routing requests return full road geometry");
expect(navigation, /snapPointToRoadRoute/, "Live GPS can be visually aligned to the road within a bounded threshold");
expect(map, /color: "#1A73E8"/, "The active route is rendered in Google-style blue");
expect(map, /appearance=\{navigationMode \|\| nativeDriver \? "navigation-arrow"/, "Driver navigation uses the blue directional arrow");
expect(map, /تعذر تحميل مسار الطرق الحقيقي الآن؛ لن يعرض النظام خطًا مستقيمًا وهميًا/, "Routing failures explicitly suppress fake straight lines");
reject(map, /setRoutePoints\(\[routeStart, routeTarget\]\)/, "No direct point-to-point fallback line exists");
reject(map, /positions=\{\[routeStart, routeTarget\]\}/, "No JSX straight-line route fallback exists");
expect(marker, /navigation-arrow/, "The marker system has a dedicated navigation-arrow appearance");
expect(marker, /fill="#1A73E8"/, "Navigation arrow is blue with its own SVG geometry");
expect(styles, /dn-real-navigation-marker__arrow/, "Blue arrow rotation and smoothing are styled");
expect(map, /enableHighAccuracy: true/, "Phone GPS requests high-accuracy fixes");
expect(map, /tracking_live_driver_location/, "Operations tracking still consumes the authoritative Supabase location RPC");
expect(map, /driver_locations/, "Realtime driver location updates remain connected");

if (failed) {
  console.error("Real driver navigation gate FAILED.");
  process.exit(1);
}
console.log("Real driver navigation gate PASSED.\n");
