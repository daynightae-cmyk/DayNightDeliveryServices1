# Admin Visual QA Checklist

Route: `/admin`

## Root-cause note

The latest screenshots showed gold/dark circles without icons because legacy admin CSS hid every `[aria-hidden="true"]` element inside the admin shell. Lucide icons intentionally render as `aria-hidden="true"`, so the circular badge remained while the SVG disappeared. The rescue must keep real JSX icons rendered and restore scoped SVG visibility inside admin UI only.

## Current visual pass focus

The November 2026 visual pass focuses on the rendered admin screen, not on adding more decorative icons:

- the map must read as a clean square command map, not a crowded overlay stack;
- the map controls must sit in clear control rows/docks without covering tile content;
- icons must be small, visible, and simple;
- quick action tiles must be compact and aligned;
- KPI cards must be readable without oversized icon bubbles;
- Khalifa cards must keep icons but avoid empty decorative dots;
- dashboard secondary cards must have useful content and must not create blank navy panels.

## Zero placeholders

- [ ] No empty circular icon placeholders are visible.
- [ ] No meaningless dot placeholders are used for card, Khalifa, sidebar, KPI, or map status visuals.
- [ ] Every circular visual badge contains a real SVG icon, numeric badge, or meaningful status chip.
- [ ] Empty decorative badge elements are removed or hidden only after the JSX has a real icon alternative.

## Icon coverage

- [ ] KPI cards show visible SVG icons.
- [ ] Quick action tiles show visible SVG icons, hover states, focus-visible states, and pressed states.
- [ ] Khalifa identity, status rows, quick questions, input actions, and notification cards show visible icons.
- [ ] Sidebar buttons show icons, active state, hover state, and focus-visible state without clipping.
- [ ] Finance KPI, COD, statement, expense, adjustment, audit, payout, PDF, source, and warning chips keep icons visible.
- [ ] Icons are compact and do not visually fight with Arabic labels.

## Map controls

- [ ] The live operations map is visually square or near-square on desktop.
- [ ] The map filters/mode chips/region chips/action chips do not cover the map tiles.
- [ ] Zoom in uses the Leaflet `zoomIn()` control.
- [ ] Zoom out uses the Leaflet `zoomOut()` control.
- [ ] Reset view uses Leaflet `setView()`.
- [ ] Fit route/order uses Leaflet `fitBounds()` where route points are available.
- [ ] Focus driver uses Leaflet `setView()` on the driver/vehicle point.
- [ ] Standard, Satellite, and Terrain toggles are visible and selected state is clear.
- [ ] Map control icons are simple, visible, and not black empty squares.

## Language audit

- [ ] Arabic mode is Arabic-only except COD, PDF, DB-backed, RPC, API, VAT.
- [ ] English mode is English-only.
- [ ] No visible camelCase keys such as `approveManually`, `sendReview`, `convertExternal`, `codStatus`, `newPickupDate`, `manualApproval`, or `adminDecision` appear in rendered labels.

## Empty states

- [ ] Empty tables show an icon, title, message, and next action.
- [ ] No section shows a giant blank navy center area.
- [ ] Secondary dashboard panels remain meaningful when data is unavailable.

## Responsive checks

- [ ] 1440px desktop: no clipped icons or horizontal scroll.
- [ ] 1366px laptop: map + quick actions align without overlap.
- [ ] 1024px laptop/tablet: map controls and sidebar stay usable.
- [ ] 768px tablet: action tiles and KPI cards wrap cleanly.
- [ ] 430px phone: no horizontal overflow or clipped controls.
- [ ] 390px phone: Khalifa, map controls, and sidebar do not overlap.
