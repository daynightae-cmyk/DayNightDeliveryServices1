export function isLikelyMojibake(value?: unknown): boolean;
export function repairLikelyMojibake(value?: unknown): string;
export function sanitizeWhatsAppPhone(value?: unknown, defaultCountryCode?: string): string;
export function formatAed(value?: unknown, locale?: string): string;
export function extractTemplateVariables(template?: unknown): string[];
export function validateTemplateVariables(template: string, allowedVariables: readonly string[]): string[];
export function compactMessage(message?: unknown): string;
export function interpolateTemplate(template: string, variables: Record<string, unknown>): string;
export function buildWhatsAppUrl(phone: unknown, message: unknown): string;
