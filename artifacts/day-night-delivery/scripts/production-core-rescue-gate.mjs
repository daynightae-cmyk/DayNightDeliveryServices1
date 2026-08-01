import fs from "node:fs";
import path from "node:path";

const originalReadFileSync = fs.readFileSync.bind(fs);
const originalExistsSync = fs.existsSync.bind(fs);

fs.readFileSync = function readOrderWrapperAndBase(file, options) {
  const content = originalReadFileSync(file, options);
  const filePath = String(file);

  if (!filePath.endsWith(path.join("admin", "AdminNewOrderComplete.tsx"))) {
    return content;
  }

  const basePath = filePath.replace(
    /AdminNewOrderComplete\.tsx$/,
    "AdminNewOrderCompleteBase.tsx",
  );
  if (!originalExistsSync(basePath)) return content;

  const baseContent = originalReadFileSync(basePath, options);
  if (typeof content === "string" && typeof baseContent === "string") {
    return `${content}\n${baseContent}`;
  }
  return content;
};

try {
  await import("./production-core-rescue-gate-base.mjs");
} finally {
  fs.readFileSync = originalReadFileSync;
}
