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

export interface Order {
  id: string; // Tracking Number e.g., DN-491026-X or database UUID depending on source
  tracking_code?: string;
  tracking_number?: string;
  sender_name: string;
  sender_phone: string;
  sender_city: string;
  sender_address: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_city: string;
  receiver_address: string;
  package_type: string;
  weight: number;
  pieces: number;
  service_type: "standard" | "express" | string;
  delivery_price: number;
  payment_method: "sender_pays" | "cod" | "receiver_pays" | string;
  cod_amount?: number;
  notes?: string;
  package_description?: string;
  price?: number;
  base_price?: number;
  express_surcharge?: number;
  additional_piece_fee?: number;
  customer_id?: string;
  driver_code?: string;
  driver_phone?: string;
  driver_name?: string;
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
