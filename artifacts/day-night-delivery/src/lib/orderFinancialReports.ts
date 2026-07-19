import type { Order } from "../types";
import { financialsFromOrder } from "./orderFinancials";

export type OrderFinancialReportRow = Record<string, unknown> & {
  id: string;
  order_id: string;
  tracking_number: string;
  merchant_id?: string;
  merchant_name?: string;
  coupon_number?: string;
  entry_date: string;
  entry_type: string;
  goods_value: number;
  delivery_fee: number;
  discount_amount: number;
  customer_total: number;
  collected_amount: number;
  merchant_due: number;
  company_revenue: number;
  delivery_fee_mode: string;
  debit: number;
  credit: number;
  balance: number;
  posted: boolean;
  status: string;
  notes: string;
  created_at?: string;
};

const clean = (value: unknown) => String(value ?? "").trim();
const normalizeStatus = (value: unknown) =>
  clean(value).toLowerCase().replace(/[\s-]+/g, "_");
const isDelivered = (order: Order) =>
  ["delivered", "completed", "complete"].includes(normalizeStatus(order.status));
const reference = (order: Order) =>
  clean(order.tracking_number || order.invoice_number || order.coupon_number || order.id || "—");
const entryDate = (order: Order) =>
  clean(order.financial_posted_at || order.updated_at || order.created_at || new Date().toISOString()).slice(0, 10);

function selectedOrders(merchantId: string | undefined, orders: Order[]) {
  return orders
    .filter((order) => !merchantId || order.merchant_id === merchantId)
    .sort(
      (a, b) =>
        new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
    );
}

export function deriveMerchantFinancialStatementFromOrders(
  merchantId: string | undefined,
  orders: Order[] = [],
): OrderFinancialReportRow[] {
  let balance = 0;

  return selectedOrders(merchantId, orders).map((order) => {
    const finance = financialsFromOrder(order as Order & Record<string, unknown>);
    const posted = Boolean(order.financial_posted_at) || isDelivered(order);
    const credit = posted && finance.merchantDue >= 0 ? finance.merchantDue : 0;
    const debit = posted && finance.merchantDue < 0 ? Math.abs(finance.merchantDue) : 0;
    balance = Math.round((balance + credit - debit + Number.EPSILON) * 100) / 100;

    return {
      id: `merchant-financial-${order.id}`,
      order_id: order.id,
      tracking_number: reference(order),
      merchant_id: order.merchant_id,
      merchant_name: order.merchant_name || order.sender_name,
      coupon_number: order.coupon_number,
      entry_date: entryDate(order),
      entry_type: posted ? "merchant_order_settlement" : "merchant_order_calculated",
      goods_value: finance.goodsValue,
      delivery_fee: finance.deliveryFee,
      discount_amount: finance.discountAmount,
      customer_total: finance.customerTotal,
      collected_amount: posted ? finance.customerTotal : Number(order.collected_amount || 0),
      merchant_due: finance.merchantDue,
      company_revenue: finance.companyRevenue,
      delivery_fee_mode: finance.deliveryFeeMode,
      debit,
      credit,
      balance,
      posted,
      status: order.status,
      notes: posted
        ? "Delivered order financial snapshot posted to merchant and company accounts."
        : "Financial values calculated at order entry and awaiting delivery confirmation.",
      created_at: order.created_at,
    };
  });
}

export function deriveCompanyFinancialStatementFromOrders(
  orders: Order[] = [],
): OrderFinancialReportRow[] {
  let balance = 0;

  return selectedOrders(undefined, orders).map((order) => {
    const finance = financialsFromOrder(order as Order & Record<string, unknown>);
    const posted = Boolean(order.financial_posted_at) || isDelivered(order);
    const credit = posted ? finance.companyRevenue : 0;
    balance = Math.round((balance + credit + Number.EPSILON) * 100) / 100;

    return {
      id: `company-financial-${order.id}`,
      order_id: order.id,
      tracking_number: reference(order),
      merchant_id: order.merchant_id,
      merchant_name: order.merchant_name || order.sender_name,
      coupon_number: order.coupon_number,
      entry_date: entryDate(order),
      entry_type: posted ? "daynight_delivery_revenue" : "daynight_revenue_calculated",
      goods_value: finance.goodsValue,
      delivery_fee: finance.deliveryFee,
      discount_amount: finance.discountAmount,
      customer_total: finance.customerTotal,
      collected_amount: posted ? finance.customerTotal : Number(order.collected_amount || 0),
      merchant_due: finance.merchantDue,
      company_revenue: finance.companyRevenue,
      delivery_fee_mode: finance.deliveryFeeMode,
      debit: 0,
      credit,
      balance,
      posted,
      status: order.status,
      notes: posted
        ? "DAY NIGHT delivery revenue posted from delivered order."
        : "Delivery revenue calculated and awaiting delivery confirmation.",
      created_at: order.created_at,
    };
  });
}

export function financialReportSummary(rows: OrderFinancialReportRow[]) {
  return rows.reduce(
    (summary, row) => ({
      orders: summary.orders + 1,
      goodsValue: summary.goodsValue + row.goods_value,
      deliveryFee: summary.deliveryFee + row.delivery_fee,
      discountAmount: summary.discountAmount + row.discount_amount,
      customerTotal: summary.customerTotal + row.customer_total,
      collectedAmount: summary.collectedAmount + row.collected_amount,
      merchantDue: summary.merchantDue + row.merchant_due,
      companyRevenue: summary.companyRevenue + row.company_revenue,
      postedOrders: summary.postedOrders + (row.posted ? 1 : 0),
    }),
    {
      orders: 0,
      goodsValue: 0,
      deliveryFee: 0,
      discountAmount: 0,
      customerTotal: 0,
      collectedAmount: 0,
      merchantDue: 0,
      companyRevenue: 0,
      postedOrders: 0,
    },
  );
}
