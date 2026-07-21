/**
 * DAY NIGHT MERCHANT PORTAL - SHARED UTILITIES
 * Formatters, validators, and helpers
 */

import type { StatusType } from './components';

// ==================== STATUS LOCALIZATION ====================

export interface StatusTranslation {
  en: string;
  ar: string;
}

export const statusTranslations: Record<string, StatusTranslation> = {
  pending: { en: 'Pending', ar: 'بانتظار التأكيد' },
  confirmed: { en: 'Confirmed', ar: 'مؤكد' },
  assigned: { en: 'Assigned', ar: 'تم التعيين' },
  accepted: { en: 'Accepted', ar: 'قبله المندوب' },
  picked_up: { en: 'Picked Up', ar: 'تم الاستلام' },
  in_transit: { en: 'In Transit', ar: 'في الطريق' },
  out_for_delivery: { en: 'Out for Delivery', ar: 'خرج للتسليم' },
  delivered: { en: 'Delivered', ar: 'تم التسليم' },
  failed: { en: 'Delivery Failed', ar: 'تعذر التسليم' },
  returned: { en: 'Returned', ar: 'مرتجع' },
  cancelled: { en: 'Cancelled', ar: 'ملغي' },
  postponed: { en: 'Postponed', ar: 'مؤجل' },
  under_review: { en: 'Under Review', ar: 'قيد المراجعة' },
};

export function getStatusLabel(status: string, lang: 'en' | 'ar' = 'en'): string {
  const normalized = status.toLowerCase().replace(/[\s-]+/g, '_');
  return statusTranslations[normalized]?.[lang] || status;
}

// ==================== PHONE VALIDATION ====================

export function normalizeUAEPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  // Remove leading 971 or 0
  let cleaned = digits;
  if (cleaned.startsWith('971')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  
  // Must be 9 digits after country code removal
  if (cleaned.length !== 9) {
    return '';
  }
  
  // UAE numbers start with 5
  if (!cleaned.startsWith('5')) {
    return '';
  }
  
  return `+971${cleaned}`;
}

export function isValidUAEDigit(phone: string): boolean {
  return normalizeUAEPhone(phone).length > 0;
}

export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizeUAEPhone(phone);
  if (!normalized) return phone;
  
  // Format: +971 5X XXX XXXX
  const digits = normalized.replace(/\D/g, '').slice(3);
  return `+971 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
}

// ==================== MONEY FORMATTERS ====================

export function formatMoney(
  amount: number | null | undefined,
  currency: string = 'AED',
  locale: string = 'en-AE'
): string {
  if (amount === null || amount === undefined) return '—';
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseMoney(value: string): number {
  const cleaned = value.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

// ==================== DATE FORMATTERS ====================

export function formatDate(
  value: string | Date | null | undefined,
  options?: {
    showTime?: boolean;
    format?: 'short' | 'medium' | 'long';
    locale?: string;
  }
): string {
  if (!value) return '—';
  
  const date = typeof value === 'string' ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) return String(value);
  
  const {
    showTime = false,
    format = 'medium',
    locale = 'en-AE',
  } = options || {};
  
  const dateOptions: Intl.DateTimeFormatOptions = {
    dateStyle: format,
    ...(showTime && { timeStyle: 'short' }),
  };
  
  return date.toLocaleDateString(locale, dateOptions);
}

export function formatRelativeTime(date: Date | string, locale: string = 'en-AE'): string {
  const target = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffSecs = Math.round(diffMs / 1000);
  const diffMins = Math.round(diffSecs / 60);
  const diffHours = Math.round(diffMins / 60);
  const diffDays = Math.round(diffHours / 24);
  
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  
  if (Math.abs(diffDays) >= 1) {
    return rtf.format(diffDays, 'day');
  }
  if (Math.abs(diffHours) >= 1) {
    return rtf.format(diffHours, 'hour');
  }
  if (Math.abs(diffMins) >= 1) {
    return rtf.format(diffMins, 'minute');
  }
  return rtf.format(diffSecs, 'second');
}

// ==================== TRACKING NUMBER UTILS ====================

export function isValidTrackingNumber(tracking: string): boolean {
  return tracking && tracking.trim().length >= 6;
}

export function formatTrackingNumber(tracking: string): string {
  return tracking.trim().toUpperCase();
}

// ==================== ORDER REFERENCE ====================

export function getOrderReference(order: any): string {
  return (
    order.tracking_code ||
    order.tracking_number ||
    order.invoice_number ||
    order.coupon_number ||
    order.id ||
    '—'
  );
}

// ==================== EMIRATE & CITY UTILS ====================

export const UAE_EMIRATES = [
  'Abu Dhabi',
  'Dubai',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah',
];

export const ABU_DHABI_AREAS = [
  'Mussafah',
  'Khalifa City',
  'Mohammed Bin Zayed City',
  'Al Shamkha',
  'Al Shawamekh',
  'Al Ain',
  'Al Dhafra',
  'Abu Dhabi City',
  'Yas Island',
  'Saadiyat Island',
  'Al Reem Island',
];

export const DUBAI_AREAS = [
  'Downtown Dubai',
  'Dubai Marina',
  'Deira',
  'Bur Dubai',
  'Jumeirah',
  'Business Bay',
  'Dubai Silicon Oasis',
  'International City',
  'Discovery Gardens',
  'JLT',
  'DMCC',
];

export function getAreasForEmirate(emirate: string): string[] {
  switch (emirate.toLowerCase()) {
    case 'abu dhabi':
      return ABU_DHABI_AREAS;
    case 'dubai':
      return DUBAI_AREAS;
    default:
      return [];
  }
}

// ==================== WEIGHT & DIMENSIONS ====================

export function formatWeight(weight: number | null | undefined): string {
  if (weight === null || weight === undefined) return '—';
  return `${weight.toFixed(2)} kg`;
}

// ==================== STRING UTILS ====================

export function truncate(str: string, length: number): string {
  if (!str || str.length <= length) return str;
  return str.slice(0, length) + '…';
}

export function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join('') || 'DN';
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

// ==================== FILE UTILS ====================

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

export function isImageFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// ==================== EXPORT FOR SHARED PACKAGE ====================

export * from './designTokens';
export * from './components';
