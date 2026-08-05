# Admin New Order Financial Incident — Root Cause Evidence

Date: 2026-08-05

## Scope

Admin → New Order → Order financial breakdown.

No production order was changed during diagnosis. No database migration, pricing rule, or Supabase object was changed.

## Observed production symptom

The supplied production screenshot shows large values rendered inside the native number inputs while the React financial cards continue to show the previous 0/25 calculation. That pattern proves that the visible DOM value and the React state used by the calculator were not the same value in that browser session.

## Evidence gathered before source cleanup

The exact `main` commit `eece0a61b1a0345ce3b5aa686f3f6ac3febfa1da` was built as a production bundle and exercised in authenticated Chromium 141.0.7390.37.

The browser test selected the canonical merchant, typed `0`, `10`, `50`, `100`, and `4444` sequentially without blur or save, switched customer/merchant charging, and exercised manual delivery fee 60. All live-preview assertions passed. The evidence artifact contains the JSON report and full-page screenshot.

Therefore the DOM/state split in the supplied production session is not reproducible from the exact repository head in a clean Chromium context.

## Repository audit

- `AdminNewOrderComplete.tsx` renders the financial inputs from React state.
- `adminNewOrderFinancialState.ts` performs the field update and the explicit-zero merchant-charge transition atomically.
- `orderFinancialOperations.ts` supplies one resolved input to preview and persistence.
- `orderFinancials.ts` preserves signed merchant balances.
- `AdminHistoryAutocomplete.tsx` excludes `type=number`, decimal/numeric inputs, and `data-admin-financial-input=true`.
- The registered Vite financial compatibility plugin skips transformation of the centralized new-order component.
- No `useEffect` in the component resets `goods_value`, `manual_delivery_price`, `discount_amount`, `payment_method`, or `delivery_fee_mode`.
- No repository-level global input/change listener was found that targets the marked financial number inputs.

## Root cause

The incident evidence came from an **unverified already-open production client session where an external DOM-only write or stale client bundle displayed a native input value that was not committed to the React state**. The screenshot did not contain a build/financial marker, so it could not prove that the loaded JavaScript bundle matched the deployment commit created minutes earlier. A direct DOM value assignment without the React change event produces the same symptom: the native input shows the new number while the memoized financial cards retain the previous state.

The exact external actor in that individual browser profile cannot be identified from a screenshot alone. The page visibly contains browser-extension UI, but there is no evidence sufficient to attribute the write to a specific extension.

## Reliability defect removed

Although the clean head passed, the component contained three competing reconciliation paths for the same fields: form-level `onInputCapture`, field `onChange`, and field `onBlur`. Those paths obscured ownership and made incident diagnosis unreliable.

The branch cleanup makes the controlled `value + onChange` path the sole state writer, removes capture/blur reconciliation, isolates all financial inputs from autocomplete/password managers, and exposes:

```text
data-admin-financial-preview-version="verified-v1"
```

The same resolved financial input remains the source for preview and save.

## Database conclusion

The live calculation occurs before save. Supabase cannot cause the cards to remain stale while typing. Database changes are not part of this repair.
