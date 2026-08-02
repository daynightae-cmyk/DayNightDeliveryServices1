import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sourcePath = path.resolve(
  process.cwd(),
  '.github/scripts/admin-complete-order-save-production-probe.mjs',
);
const runtimePath = path.resolve(
  process.cwd(),
  '.github/scripts/.admin-complete-order-save-production-probe.runtime.mjs',
);

const source = fs.readFileSync(sourcePath, 'utf8');
const compatible = source
  .replace(".select('merchant_id,is_active')", ".select('merchant_id,active')")
  .replace(".eq('is_active', true)", ".eq('active', true)");

if (compatible === source || compatible.includes('merchant_id,is_active')) {
  throw new Error('live_schema_probe_patch_not_applied');
}

fs.writeFileSync(runtimePath, compatible, 'utf8');
try {
  await import(`${pathToFileURL(runtimePath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(runtimePath, { force: true });
}
