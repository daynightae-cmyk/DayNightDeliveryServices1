import type { ReactNode } from "react";

export type MerchantSectionId =
  | "dashboard"
  | "new_order"
  | "orders"
  | "order_details"
  | "tracking"
  | "pickup_requests"
  | "returns"
  | "cancelled"
  | "postponed"
  | "under_review"
  | "import_shipments"
  | "cod"
  | "settlements"
  | "statements"
  | "invoices"
  | "wallet"
  | "transactions"
  | "analytics"
  | "reports"
  | "branches"
  | "pickup_addresses"
  | "address_book"
  | "profile"
  | "branding"
  | "business_details"
  | "bank_details"
  | "documents"
  | "team"
  | "notifications"
  | "support"
  | "integrations"
  | "settings"
  | "security";

export type DataSourceState = "live" | "derived" | "unavailable";
export type RealtimeState = "connected" | "reconnecting" | "offline" | "stale" | "unavailable";
export type MerchantAsyncState = "idle" | "loading" | "success" | "error";

export type MerchantNavigationPayloadMap = {
  dashboard: undefined;
  new_order: { couponImageUrl?: string } | undefined;
  orders: { status?: string; query?: string } | undefined;
  order_details: { orderId: string };
  tracking: { orderId?: string; trackingNumber?: string } | undefined;
  pickup_requests: undefined;
  returns: { orderId?: string } | undefined;
  cancelled: undefined;
  postponed: undefined;
  under_review: undefined;
  import_shipments: undefined;
  cod: undefined;
  settlements: { settlementId?: string } | undefined;
  statements: { statementId?: string } | undefined;
  invoices: { invoiceId?: string } | undefined;
  wallet: undefined;
  transactions: undefined;
  analytics: undefined;
  reports: undefined;
  branches: { branchId?: string } | undefined;
  pickup_addresses: undefined;
  address_book: undefined;
  profile: undefined;
  branding: undefined;
  business_details: undefined;
  bank_details: undefined;
  documents: undefined;
  team: undefined;
  notifications: undefined;
  support: { orderId?: string; settlementId?: string } | undefined;
  integrations: undefined;
  settings: undefined;
  security: undefined;
};

export type MerchantNavigate = <T extends MerchantSectionId>(
  section: T,
  payload: MerchantNavigationPayloadMap[T],
) => void;

export type MerchantProfileViewModel = {
  id: string;
  merchantCode?: string;
  tradeName: string;
  ownerName?: string;
  logoUrl?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  businessType?: string;
  emirate?: string;
  city?: string;
  address?: string;
  pickupAddress?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  trn?: string;
  bankName?: string;
  maskedIban?: string;
  settlementCycle?: string;
  defaultPaymentMethod?: string;
  status?: string;
  portalAccessStatus?: string;
  codEnabled?: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type MerchantOrderViewModel = {
  id: string;
  trackingNumber: string;
  invoiceNumber?: string;
  couponNumber?: string;
  merchantReference?: string;
  status: string;
  recipientName: string;
  recipientPhone?: string;
  recipientAlternatePhone?: string;
  recipientEmail?: string;
  deliveryEmirate?: string;
  deliveryCity?: string;
  deliveryArea?: string;
  deliveryAddress?: string;
  deliveryLandmark?: string;
  pickupBranch?: string;
  pickupAddress?: string;
  senderName?: string;
  senderPhone?: string;
  serviceType?: string;
  packageType?: string;
  packageDescription?: string;
  pieces?: number;
  weight?: number;
  fragile?: boolean;
  sensitive?: boolean;
  paymentMethod?: string;
  codAmount?: number | null;
  collectedAmount?: number | null;
  deliveryFee?: number | null;
  merchantDue?: number | null;
  goodsValue?: number | null;
  currency?: string;
  driverName?: string;
  driverPhone?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLocationAt?: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  driverLat?: number | null;
  driverLng?: number | null;
  notes?: string;
};

export type MerchantTimelineEventViewModel = {
  id: string;
  status: string;
  labelAr: string;
  labelEn: string;
  note?: string | null;
  timestamp?: string | null;
  source?: DataSourceState;
};

export type MerchantMetricViewModel = {
  id: string;
  labelAr: string;
  labelEn: string;
  value: string | number | null;
  currency?: "AED";
  source: DataSourceState;
  status?: "neutral" | "good" | "warning" | "critical";
  actionSection?: MerchantSectionId;
};

export type MerchantCodSummaryViewModel = {
  pending: number | null;
  collected: number | null;
  available: number | null;
  settled: number | null;
  onHold: number | null;
  overdue: number | null;
  discrepancy: number | null;
  orderCount: number;
  currency: "AED";
  source: DataSourceState;
  lastUpdatedAt?: string | null;
};

export type MerchantCodTransactionViewModel = {
  id: string;
  trackingNumber: string;
  recipientName: string;
  codAmount: number | null;
  collectedAmount: number | null;
  status: string;
  collectedAt?: string | null;
  settlementId?: string | null;
  note?: string | null;
  currency: "AED";
};

export type MerchantSettlementViewModel = {
  id: string;
  periodStart?: string;
  periodEnd?: string;
  codTotal?: number | null;
  deliveryFees?: number | null;
  adjustments?: number | null;
  refunds?: number | null;
  netPayable?: number | null;
  status: string;
  scheduledAt?: string;
  paidAt?: string;
  paymentReference?: string;
  maskedBankAccount?: string;
  currency: "AED";
  source: DataSourceState;
};

export type MerchantStatementEntryViewModel = {
  id: string;
  date?: string;
  type: string;
  reference?: string;
  descriptionAr: string;
  descriptionEn: string;
  debit?: number | null;
  credit?: number | null;
  balance?: number | null;
  currency: "AED";
};

export type MerchantStatementViewModel = {
  id: string;
  periodLabelAr: string;
  periodLabelEn: string;
  openingBalance?: number | null;
  closingBalance?: number | null;
  entries: MerchantStatementEntryViewModel[];
  status: string;
  generatedAt?: string;
  currency: "AED";
  source: DataSourceState;
};

export type MerchantInvoiceViewModel = {
  id: string;
  invoiceNumber: string;
  orderId?: string;
  trackingNumber?: string;
  date?: string;
  amount?: number | null;
  status: string;
  settlementId?: string;
  currency: "AED";
};

export type MerchantWalletViewModel = {
  available: number | null;
  pending: number | null;
  reserved: number | null;
  totalCredits: number | null;
  totalDebits: number | null;
  currency: "AED";
  source: DataSourceState;
  lastUpdatedAt?: string | null;
};

export type MerchantTransactionViewModel = {
  id: string;
  type: string;
  amount: number | null;
  reference?: string;
  orderId?: string;
  settlementId?: string;
  status: string;
  date?: string;
  balanceAfter?: number | null;
  currency: "AED";
};

export type MerchantBranchViewModel = {
  id: string;
  name: string;
  code?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  emirate?: string;
  city?: string;
  address?: string;
  workingHours?: string;
  pickupInstructions?: string;
  isDefault?: boolean;
  active?: boolean;
};

export type MerchantPickupRequestViewModel = {
  id: string;
  branchName?: string;
  pickupAddress?: string;
  requestedDate?: string;
  timeWindow?: string;
  shipmentCount?: number;
  pieceCount?: number;
  status: string;
  driverName?: string;
  notes?: string;
  updatedAt?: string;
};

export type MerchantAddressBookEntryViewModel = {
  id: string;
  recipientName: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  emirate?: string;
  city?: string;
  area?: string;
  address?: string;
  building?: string;
  floor?: string;
  landmark?: string;
  notes?: string;
  tags?: string[];
};

export type MerchantDocumentViewModel = {
  id: string;
  type: string;
  number?: string;
  issueDate?: string;
  expiryDate?: string;
  status: "valid" | "expiring_soon" | "expired" | "under_review" | "rejected" | "missing";
  fileUrl?: string;
  reviewNote?: string;
};

export type MerchantTeamMemberViewModel = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: "owner" | "manager" | "operations" | "finance" | "viewer" | string;
  status: string;
  lastActiveAt?: string;
  branchNames?: string[];
  permissions?: string[];
};

export type MerchantNotificationViewModel = {
  id: string;
  type: string;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  createdAt?: string;
  read: boolean;
  priority?: "low" | "normal" | "high" | "critical";
  relatedEntityId?: string;
};

export type MerchantSupportTicketViewModel = {
  id: string;
  category: string;
  priority: string;
  subject: string;
  message: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  orderId?: string;
  settlementId?: string;
  response?: string;
};

export type MerchantAnalyticsViewModel = {
  orderVolume: Array<{ label: string; value: number }>;
  statusDistribution: Array<{ status: string; value: number }>;
  topCities: Array<{ city: string; value: number }>;
  successRate: number | null;
  failureRate: number | null;
  returnRate: number | null;
  cancellationRate: number | null;
  averageDeliveryHours: number | null;
  codShare: number | null;
  averageCod: number | null;
  source: DataSourceState;
};

export type MerchantIntegrationViewModel = {
  id: string;
  name: string;
  type: string;
  status: "connected" | "disconnected" | "unavailable" | "error";
  lastActivityAt?: string;
  descriptionAr: string;
  descriptionEn: string;
};

export type MerchantConnectionViewModel = {
  state: RealtimeState;
  lastSuccessfulSyncAt?: string | null;
  messageAr?: string;
  messageEn?: string;
};

export type MerchantOrderFormDraft = {
  pickupBranchId?: string;
  pickupAddress?: string;
  senderName?: string;
  senderPhone?: string;
  pickupEmirate?: string;
  pickupCity?: string;
  pickupArea?: string;
  pickupBuilding?: string;
  pickupFloor?: string;
  pickupLandmark?: string;
  pickupInstructions?: string;
  pickupTime?: string;
  merchantReference?: string;
  couponNumber?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAlternatePhone?: string;
  recipientEmail?: string;
  deliveryEmirate?: string;
  deliveryCity?: string;
  deliveryArea?: string;
  deliveryAddress?: string;
  deliveryBuilding?: string;
  deliveryFloor?: string;
  deliveryLandmark?: string;
  deliveryInstructions?: string;
  packageType?: string;
  packageDescription?: string;
  pieces?: number;
  weight?: number;
  dimensions?: string;
  goodsValue?: number;
  fragile?: boolean;
  temperatureSensitive?: boolean;
  specialHandling?: string;
  serviceType?: string;
  paymentMethod?: string;
  deliveryFeeMode?: string;
  codAmount?: number;
};

export type MerchantPortalData = {
  merchant: MerchantProfileViewModel;
  metrics: MerchantMetricViewModel[];
  orders: MerchantOrderViewModel[];
  selectedOrder?: MerchantOrderViewModel | null;
  timeline?: MerchantTimelineEventViewModel[];
  connection: MerchantConnectionViewModel;
  codSummary: MerchantCodSummaryViewModel;
  codTransactions: MerchantCodTransactionViewModel[];
  settlements: MerchantSettlementViewModel[];
  statements: MerchantStatementViewModel[];
  invoices: MerchantInvoiceViewModel[];
  wallet?: MerchantWalletViewModel | null;
  transactions: MerchantTransactionViewModel[];
  branches: MerchantBranchViewModel[];
  pickupRequests: MerchantPickupRequestViewModel[];
  addressBook: MerchantAddressBookEntryViewModel[];
  documents: MerchantDocumentViewModel[];
  team: MerchantTeamMemberViewModel[];
  notifications: MerchantNotificationViewModel[];
  supportTickets: MerchantSupportTicketViewModel[];
  analytics: MerchantAnalyticsViewModel;
  integrations: MerchantIntegrationViewModel[];
  mapSlot?: ReactNode;
  loading?: boolean;
  error?: string | null;
  readOnly?: boolean;
};
