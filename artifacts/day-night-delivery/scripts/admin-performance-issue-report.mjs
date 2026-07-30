import fs from 'node:fs';
import path from 'node:path';

const evidenceDir = path.resolve(
  process.env.ADMIN_PERFORMANCE_OUTPUT_DIR ||
    'artifacts/day-night-delivery/admin-performance-evidence',
);
const output = path.resolve(
  process.env.ADMIN_PERFORMANCE_ISSUE_REPORT ||
    path.join(process.env.RUNNER_TEMP || evidenceDir, 'issue-268-performance-report.md'),
);

const repository = String(process.env.GITHUB_REPOSITORY || '').trim();
const runId = String(process.env.GITHUB_RUN_ID || '').trim();
const commit = String(process.env.GITHUB_SHA || '').trim();
const geometryOutcome = String(process.env.GEOMETRY_OUTCOME || 'not-run').trim();
const performanceOutcome = String(process.env.PERFORMANCE_OUTCOME || 'not-run').trim();

const lines = [
  '## Phase 4 production Chrome acceptance run',
  '',
  `- Workflow run: https://github.com/${repository}/actions/runs/${runId}`,
  `- Commit: \`${commit}\``,
  `- Protected geometry stage: **${geometryOutcome}**`,
  `- Protected Chrome stage: **${performanceOutcome}**`,
  '- Evidence artifact: `DAY-NIGHT-Admin-INP-Acceptance` (30-day retention)',
  '- Secrets, authentication sessions, customer PII, and raw production payloads are excluded.',
  '',
];

const summaryPath = path.join(evidenceDir, 'admin-performance-summary.md');
const geometryPath = path.join(evidenceDir, 'admin-performance-geometry.json');

if (fs.existsSync(summaryPath)) {
  lines.push(fs.readFileSync(summaryPath, 'utf8').trim(), '');
} else if (fs.existsSync(geometryPath)) {
  const payload = JSON.parse(fs.readFileSync(geometryPath, 'utf8'));
  const before = payload.beforeScrollIntoView || {};
  const after = payload.afterScrollIntoView || {};
  const item = before.ancestors?.[0] || {};
  const itemAfter = after.ancestors?.[0] || {};
  const parent = before.ancestors?.[1] || {};
  const parentAfter = after.ancestors?.[1] || {};

  lines.push(
    '### Geometry diagnostic',
    '',
    `- Viewport: \`${before.viewport?.innerWidth || 0}×${before.viewport?.innerHeight || 0}\``,
    `- Launcher before: \`${JSON.stringify(item.rect || {})}\``,
    `- Launcher after scroll: \`${JSON.stringify(itemAfter.rect || {})}\``,
    `- Parent before: \`${JSON.stringify(parent.rect || {})}\``,
    `- Parent after scroll: \`${JSON.stringify(parentAfter.rect || {})}\``,
    `- Before intersection: \`${JSON.stringify(before.insideViewport || {})}\``,
    `- After intersection: \`${JSON.stringify(after.insideViewport || {})}\``,
    '- Full ancestor geometry and the redacted screenshot are stored in the protected artifact.',
    '',
  );
} else {
  lines.push(
    'Neither a structured performance summary nor geometry diagnostic was produced; inspect the linked workflow.',
    '',
  );
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${lines.join('\n')}\n`);
console.log(`Issue #268 performance report written to ${output}`);
