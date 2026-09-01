import fs from 'node:fs';

const source = fs.readFileSync('.github/scripts/purge-financial-acceptance-orders.mjs', 'utf8');
const checks = [
  ['exact receiver marker', /DAY NIGHT FINANCIAL TEST/],
  ['exact phone marker', /0500000000/],
  ['exact test merchant marker', /325bb302-75c3-48cc-84ba-e58817d6d148/],
  ['verified zero remaining', /financial_acceptance_cleanup_not_verified/],
  ['no broad delete', /\.eq\('receiver_name', acceptanceName\)[\s\S]*\.eq\('receiver_phone', acceptancePhone\)[\s\S]*\.eq\('merchant_id', acceptanceMerchantId\)/],
];
for (const [label, pattern] of checks) {
  if (!pattern.test(source)) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
console.log('PASS financial acceptance purge gate');
