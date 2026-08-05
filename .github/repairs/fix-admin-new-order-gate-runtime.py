from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATE = ROOT / "artifacts/day-night-delivery/scripts/admin-new-order-live-financial-gate.mjs"
source = GATE.read_text(encoding="utf-8")

old_import = 'import { build } from "esbuild";'
if old_import not in source:
    raise RuntimeError("esbuild gate import not found")
source = source.replace(old_import, 'import * as ts from "typescript";', 1)

old_block = '''const tmp = path.join(os.tmpdir(), `daynight-order-financials-${process.pid}.mjs`);
await build({
  entryPoints: [path.join(root, "artifacts/day-night-delivery/src/lib/orderFinancials.ts")],
  outfile: tmp,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});
const { calculateOrderFinancials } = await import(`${pathToFileURL(tmp).href}?v=${Date.now()}`);'''
new_block = '''const tmp = path.join(os.tmpdir(), `daynight-order-financials-${process.pid}.mjs`);
const financialSource = fs.readFileSync(
  path.join(root, "artifacts/day-night-delivery/src/lib/orderFinancials.ts"),
  "utf8",
);
const compiledFinancialSource = ts.transpileModule(financialSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: "orderFinancials.ts",
}).outputText;
fs.writeFileSync(tmp, compiledFinancialSource, "utf8");
const { calculateOrderFinancials } = await import(`${pathToFileURL(tmp).href}?v=${Date.now()}`);'''
if old_block not in source:
    raise RuntimeError("esbuild gate execution block not found")
source = source.replace(old_block, new_block, 1)

GATE.write_text(source, encoding="utf-8")
print("Financial gate runtime switched to TypeScript compiler.")
