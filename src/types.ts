/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Order {
  id: string; // Tracking Number e.g., DN-491026-X
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
  service_type: "standard" | "express";
  delivery_price: number;
  payment_method: "sender_pays" | "cod" | "receiver_pays";
  cod_amount?: number;
  notes?: string;
  status: "Pending" | "Confirmed" | "Assigned" | "Picked Up" | "In Transit" | "Out For Delivery" | "Delivered" | "Failed" | "Cancelled";
  created_at: string;
  status_history?: { status: string; date: string; note?: string }[];
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
