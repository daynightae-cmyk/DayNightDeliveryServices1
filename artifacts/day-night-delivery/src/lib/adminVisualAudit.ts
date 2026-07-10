export function getAdminVisualAuditHints(): string[] {
  return [
    "No empty icon circles: every circular admin badge contains an SVG icon, a numeric badge, or a meaningful status chip.",
    "No visible camelCase action or field keys in Arabic or English admin workspaces.",
    "Quick actions, KPI cards, Khalifa rows, sidebar buttons, finance cards, and map controls show visible icons at 100% zoom.",
    "Empty admin tables render a professional empty state instead of a blank center canvas.",
    "Map controls call real Leaflet zoomIn, zoomOut, setView, and fitBounds methods.",
    "Arabic mode remains Arabic-only except approved technical terms: COD, PDF, DB-backed, RPC, API, VAT.",
    "English mode remains English-only with translated labels and action titles.",
  ];
}
