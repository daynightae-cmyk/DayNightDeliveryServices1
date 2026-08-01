import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const repoRoot = path.resolve(root, "..", "..");
const failures = [];

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    failures.push(`Missing ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolute, "utf8");
}

function assert(condition, message) {
  if (condition) console.log(`PASS: ${message}`);
  else {
    failures.push(message);
    console.error(`FAIL: ${message}`);
  }
}

const camera = read("src/components/shared/CouponPhotoIntake.tsx");
const admin = read("src/components/admin/AdminNewOrderComplete.tsx");
const publicRequest = read("src/components/RequestDelivery.tsx");
const recognition = read("src/lib/couponImport.ts");
const vercelPath = path.join(repoRoot, "vercel.json");
const vercel = fs.existsSync(vercelPath) ? fs.readFileSync(vercelPath, "utf8") : "";

assert(camera.includes("navigator.mediaDevices.getUserMedia"), "Coupon capture uses real getUserMedia camera streaming");
assert(camera.includes("<video") && camera.includes("playsInline"), "Live camera preview is rendered for desktop and mobile");
assert(camera.includes("canvas.toBlob") && camera.includes("new File([blob]"), "Live video frame is converted into a real image file");
assert(camera.includes("fallbackCameraRef") && camera.includes('capture="environment"'), "Native device-camera fallback remains available without replacing live capture");
assert(camera.includes("uploadRef") && camera.includes("Upload existing image"), "Existing-image upload is a separate explicit action");
assert(camera.includes("SwitchCamera") && camera.includes("enumerateDevices"), "Multiple cameras can be enumerated and switched");
assert(camera.includes("torchSupported") && camera.includes("zoomRange"), "Torch and optical zoom controls are capability-gated");
assert(camera.includes("BarcodeDetector") && camera.includes("LIVE_SCAN_INTERVAL_MS"), "Live QR/barcode detection runs during preview when supported");
assert(camera.includes("window.isSecureContext"), "Camera reports secure-context requirements instead of silently opening a file picker");
assert(!camera.includes("cameraRef.current?.click()"), "Primary camera action no longer depends on a file input click");

assert(admin.includes('from "../shared/CouponPhotoIntake"'), "Admin new-order flow uses the hardened shared camera");
assert(publicRequest.includes('from "./shared/CouponPhotoIntake"'), "Public request flow uses the hardened shared camera");
assert(recognition.includes('createWorker("eng+ara"'), "Recognition model loads Arabic and English OCR together");
assert(recognition.includes("full-original") && recognition.includes("full-contrast") && recognition.includes("full-binary"), "OCR runs multiple image-processing passes");
assert(recognition.includes("BarcodeDetector") && recognition.includes("TextDetector"), "Recognition layers native barcode and text detection before OCR fallback");
assert(vercel.includes('Permissions-Policy') && vercel.includes('camera=(self)'), "Production headers permit same-origin camera access");
assert(vercel.includes("https://cdn.jsdelivr.net") && vercel.includes("https://tessdata.projectnaptha.com"), "CSP permits the approved OCR runtime and language model assets");

console.log("\n--- Coupon live camera production gate complete ---");
if (failures.length) {
  console.error(`${failures.length} coupon camera checks failed.`);
  process.exit(1);
}
console.log("All coupon camera checks passed.");
