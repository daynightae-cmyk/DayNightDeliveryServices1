import { useEffect, useState } from "react";
import { useAppContext } from "../lib/AppContext";
import { fetchAdminOrders, fetchFinanceSummary, fetchMerchants, type FinanceSummary } from "../lib/adminData";
import type { Merchant } from "../types";
import AdminSystemSupportCenter from "./admin/AdminSystemSupportCenter";

export default function AdminProspectingLinks() {
  const { language } = useAppContext();
  const isArabic = language === "ar";
  const [orders, setOrders] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);

  async function refresh() {
    const [ordersResult, merchantsResult, financeResult] = await Promise.allSettled([
      fetchAdminOrders(),
      fetchMerchants(),
      fetchFinanceSummary(),
    ]);
    if (ordersResult.status === "fulfilled") setOrders(Array.isArray(ordersResult.value) ? ordersResult.value : []);
    if (merchantsResult.status === "fulfilled") setMerchants(Array.isArray(merchantsResult.value) ? merchantsResult.value : []);
    if (financeResult.status === "fulfilled") setFinanceSummary(financeResult.value.summary);
  }

  useEffect(() => { void refresh(); }, []);

  return <AdminSystemSupportCenter isArabic={isArabic} orders={orders} merchants={merchants} financeSummary={financeSummary} />;
}
