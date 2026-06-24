import type { Order } from "../types";

function csvEscape(value: unknown) {
  const str = String(value ?? "");
  return `"${str.replaceAll("\"", "\"\"")}"`;
}

export function exportOrdersCsv(orders: Order[]) {
  const headers = ["id", "sender_name", "receiver_name", "sender_city", "receiver_city", "status", "delivery_price", "created_at"];
  const rows = orders.map((o) => headers.map((k) => csvEscape((o as any)[k])).join(","));
  return [headers.join(","), ...rows].join("\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function backupPlanSummary() {
  return {
    cron: "Supabase Cron daily backup job",
    restore: "Manual restore through approved SQL scripts and platform backup tool"
  };
}
