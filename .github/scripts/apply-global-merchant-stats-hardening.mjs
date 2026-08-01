import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "artifacts/day-night-delivery/src/lib/adminData.ts");
let source = fs.readFileSync(file, "utf8");

const replacement = `export async function fetchAdminStats(): Promise<AdminStats> {
  const [orders, merchants] = await Promise.all([
    fetchAdminOrders(),
    fetchMerchants(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return orders.reduce<AdminStats>((stats, order) => {
    const status = orderStatus(order);
    stats.total_orders += 1;
    if (String(order.created_at || "").slice(0, 10) === today) stats.today_orders += 1;
    if (status.includes("deliver") || status.includes("complete")) stats.delivered += 1;
    else if (status.includes("cancel") || status.includes("fail")) stats.cancelled += 1;
    else if (status.includes("transit") || status.includes("assign") || status.includes("pick")) stats.in_transit += 1;
    else stats.pending += 1;
    stats.cod_total += numberValue(order.cod_amount, 0);
    stats.delivery_income += orderDeliveryIncome(order);
    return stats;
  }, {
    pending: 0,
    in_transit: 0,
    delivered: 0,
    cancelled: 0,
    total_orders: 0,
    today_orders: 0,
    active_merchants: merchants.filter((merchant) => clean(merchant.status || "active").toLowerCase() !== "paused").length,
    cod_total: 0,
    delivery_income: 0,
  });
}

`;

const pattern = /export async function fetchAdminStats\(\): Promise<AdminStats> \{[\s\S]*?\n}\n\n(?=export async function updateOrderStatus)/;
const matches = [...source.matchAll(new RegExp(pattern.source, "g"))].length;
if (matches !== 1) throw new Error(`fetchAdminStats patch expected one match, found ${matches}`);
source = source.replace(pattern, replacement);

if (source.includes('Promise.allSettled([fetchAdminOrders(), fetchMerchants()])')) {
  throw new Error("False-zero allSettled fallback remains in fetchAdminStats");
}
fs.writeFileSync(file, source, "utf8");
console.log("Admin statistics now fail explicitly instead of rendering false zeros.");
