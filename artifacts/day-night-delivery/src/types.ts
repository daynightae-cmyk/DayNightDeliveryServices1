/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OrderStatusHistoryItem {
  id?: string;
  order_id?: string;
  status: string;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
  timestamp?: string;
  date?: string;
  changed_by?: string | null;
}

export interface Merchant {
  id: string;
  merchant_code?: string;
  trade_name: string;
  owner_name?: string;
  phone: string;
  alt_phone?: string;
  email?: string;
  emirate?: string;
  city?: string;
  address?: string;
  pickup_address?: string;
  license_number?: string;
  trn?: string;
  tax_number?: string;
  logo_url?: string;
  bank_name?: string;
  iban?: string;
  settlement_cycle?: string;
  commission_type?: string;
  default_payment_method?: string;
  notes?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Order {
  id: string; // Tracking Number e.g., DN-491026-X or database UUID depending on source
  tracking_code?: string;
  tracking_number?: string;
  invoice_number?: string;
  invoiceNumber?: string;
  coupon_number?: string;
  merchant_id?: string;
  merchant_name?: string;
  merchant_code?: string;
  order_count?: number;
  shipping_scope?: "local" | "international" | string;
  destination_country?: string;
  source_channel?: string;
  sender_name: string;
  sender_phone: string;
  sender_email?: string;
  sender_city: string;
  sender_address: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_email?: string;
  receiver_city: string;
  receiver_address: string;
  package_type: string;
  weight: number;
  pieces: number;
  service_type: "standard" | "express" | string;
  delivery_price: number;
  delivery_date?: string;
  payment_method: "sender_pays" | "cod" | "receiver_pays" | string;
  cod_amount?: number;
  notes?: string;
  package_description?: string;
  price?: number;
  base_price?: number;
  express_surcharge?: number;
  additional_piece_fee?: number;
  customer_id?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_name?: string;
  driver_code?: string;
  driver_phone?: string;
  driver_name?: string;
  pickup_lat?: number | string | null;
  pickup_lng?: number | string | null;
  sender_lat?: number | string | null;
  sender_lng?: number | string | null;
  receiver_lat?: number | string | null;
  receiver_lng?: number | string | null;
  delivery_lat?: number | string | null;
  delivery_lng?: number | string | null;
  driver_lat?: number | string | null;
  driver_lng?: number | string | null;
  current_lat?: number | string | null;
  current_lng?: number | string | null;
  live_lat?: number | string | null;
  live_lng?: number | string | null;
  driver_location_updated_at?: string | null;
  live_location_updated_at?: string | null;
  live_location_source?: string | null;

  /** Authoritative order financial breakdown, calculated when the order is created. */
  goods_value?: number;
  product_value?: number;
  merchant_goods_value?: number;
  delivery_fee?: number;
  discount_amount?: number;
  discount?: number;
  delivery_fee_mode?: "customer_pays" | "deduct_from_merchant" | string;
  customer_total?: number;
  collected_amount?: number;
  merchant_due?: number;
  company_revenue?: number;
  financial_posted_at?: string | null;
  financial_version?: number;
  manual_delivery_price?: number | string | null;
  price_source?: "system" | "manual" | string;
  subtotal?: number;
  total?: number;
  total_amount?: number;
  total_price?: number;
  amount?: number;
  currency?: string;

  status: string;
  created_at: string;
  updated_at?: string;
  status_history?: OrderStatusHistoryItem[];
}

export interface CityPrice {
  city: string;
  arabic: string;
  price: number;
  regions?: string[];
}

export interface InternationalRate {
  destination: string;
  arabic: string;
  first_kg: number;
  additional_kg: number;
  type: "gcc" | "global";
}

export interface FAQItem {
  question: string;
  questionAr?: string;
  answer: string;
  answerAr?: string;
}
