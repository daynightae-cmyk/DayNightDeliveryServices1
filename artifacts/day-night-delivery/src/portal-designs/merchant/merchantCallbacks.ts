import type {
  MerchantAddressBookEntryViewModel,
  MerchantBranchViewModel,
  MerchantDocumentViewModel,
  MerchantNavigate,
  MerchantOrderFormDraft,
  MerchantOrderViewModel,
  MerchantPickupRequestViewModel,
  MerchantProfileViewModel,
  MerchantSupportTicketViewModel,
  MerchantTeamMemberViewModel,
} from "./merchantViewModels";

export type MerchantOperationError = {
  code: string;
  message: string;
  retryable?: boolean;
};

export type MerchantCreateOrderResult = {
  success: boolean;
  orderId?: string;
  trackingNumber?: string;
  invoiceNumber?: string;
  amount?: number | null;
  currency?: "AED";
  createdAt?: string;
  error?: MerchantOperationError;
};

export type MerchantPricingResult = {
  confirmed: boolean;
  source: "rpc" | "system" | "manual" | "unavailable";
  baseFee?: number | null;
  weightFee?: number | null;
  serviceSurcharge?: number | null;
  remoteAreaSurcharge?: number | null;
  discount?: number | null;
  tax?: number | null;
  total?: number | null;
  currency: "AED";
  error?: MerchantOperationError;
};

export type MerchantOrderTransitionResult = {
  success: boolean;
  orderId: string;
  newStatus?: string;
  updatedAt?: string;
  error?: MerchantOperationError;
};

export type MerchantFileUploadResult = {
  success: boolean;
  path?: string;
  url?: string;
  error?: MerchantOperationError;
};

export type MerchantCouponExtractionResult = {
  success: boolean;
  extractionSource?: "barcode" | "qr" | "ocr" | "manual";
  confidence?: number | null;
  fields?: Partial<MerchantOrderFormDraft>;
  warnings?: string[];
  error?: MerchantOperationError;
};

export type MerchantPickupRequestInput = {
  branchId?: string;
  pickupAddress: string;
  requestedDate: string;
  timeWindow: string;
  shipmentCount: number;
  pieceCount?: number;
  notes?: string;
};

export type MerchantPickupRequestResult = {
  success: boolean;
  request?: MerchantPickupRequestViewModel;
  error?: MerchantOperationError;
};

export type MerchantImportPreviewInput = {
  file: File;
  branchId?: string;
  columnMapping: Record<string, string>;
};

export type MerchantImportPreviewResult = {
  success: boolean;
  batchId?: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warnings: number;
  duplicateRows: number;
  rowErrors: Array<{ row: number; field?: string; message: string }>;
  error?: MerchantOperationError;
};

export type MerchantImportCommitResult = {
  success: boolean;
  batchId: string;
  importedCount?: number;
  failedCount?: number;
  error?: MerchantOperationError;
};

export type MerchantDownloadResult = {
  success: boolean;
  fileName?: string;
  url?: string;
  error?: MerchantOperationError;
};

export type MerchantPrintResult = {
  success: boolean;
  jobId?: string;
  printedCount?: number;
  error?: MerchantOperationError;
};

export type MerchantProfileUpdateResult = {
  success: boolean;
  merchant?: MerchantProfileViewModel;
  reviewRequired?: boolean;
  error?: MerchantOperationError;
};

export type MerchantSupportRequestInput = {
  category: string;
  priority: string;
  subject: string;
  message: string;
  orderId?: string;
  settlementId?: string;
  attachment?: File;
  preferredContact?: string;
};

export type MerchantSupportResult = {
  success: boolean;
  ticket?: MerchantSupportTicketViewModel;
  error?: MerchantOperationError;
};

export type MerchantGlobalSearchResult = {
  query: string;
  results: Array<{
    id: string;
    type: "order" | "invoice" | "settlement" | "recipient" | "section";
    title: string;
    subtitle?: string;
    section: string;
  }>;
  error?: MerchantOperationError;
};

export type MerchantPortalCallbacks = {
  onNavigate: MerchantNavigate;
  onRefreshData(): Promise<void>;
  onCreateOrder(input: MerchantOrderFormDraft): Promise<MerchantCreateOrderResult>;
  onCalculatePrice(input: MerchantOrderFormDraft): Promise<MerchantPricingResult>;
  onUploadCouponImage?(file: File): Promise<MerchantFileUploadResult>;
  onExtractCoupon?(uploadedUrl: string): Promise<MerchantCouponExtractionResult>;
  onOpenOrder(orderId: string): void;
  onTrackOrder(order: MerchantOrderViewModel): void;
  onCancelOrder?(orderId: string, reason: string): Promise<MerchantOrderTransitionResult>;
  onRequestReturn?(orderId: string, reason: string): Promise<MerchantOrderTransitionResult>;
  onRequestReschedule?(orderId: string, date: string, reason?: string): Promise<MerchantOrderTransitionResult>;
  onRequestPickup?(input: MerchantPickupRequestInput): Promise<MerchantPickupRequestResult>;
  onCreateImportPreview?(input: MerchantImportPreviewInput): Promise<MerchantImportPreviewResult>;
  onCommitImport?(batchId: string): Promise<MerchantImportCommitResult>;
  onDownloadImportErrors?(batchId: string): Promise<MerchantDownloadResult>;
  onDownloadInvoice?(invoiceId: string): Promise<MerchantDownloadResult>;
  onDownloadStatement?(statementId: string, format: "pdf" | "csv"): Promise<MerchantDownloadResult>;
  onPrintLabels?(orderIds: string[]): Promise<MerchantPrintResult>;
  onUpdateProfile(input: Partial<MerchantProfileViewModel>): Promise<MerchantProfileUpdateResult>;
  onUploadLogo?(file: File): Promise<MerchantFileUploadResult>;
  onUpdateBankDetails?(input: Partial<MerchantProfileViewModel>): Promise<MerchantProfileUpdateResult>;
  onUploadDocument?(file: File, document: Partial<MerchantDocumentViewModel>): Promise<MerchantFileUploadResult>;
  onSaveBranch?(branch: Partial<MerchantBranchViewModel>): Promise<{ success: boolean; branch?: MerchantBranchViewModel; error?: MerchantOperationError }>;
  onSaveAddressBookEntry?(entry: Partial<MerchantAddressBookEntryViewModel>): Promise<{ success: boolean; entry?: MerchantAddressBookEntryViewModel; error?: MerchantOperationError }>;
  onSaveTeamMember?(member: Partial<MerchantTeamMemberViewModel>): Promise<{ success: boolean; member?: MerchantTeamMemberViewModel; error?: MerchantOperationError }>;
  onSubmitSupportRequest(input: MerchantSupportRequestInput): Promise<MerchantSupportResult>;
  onGlobalSearch(query: string): Promise<MerchantGlobalSearchResult>;
  onMarkNotificationRead?(notificationId: string): Promise<{ success: boolean; error?: MerchantOperationError }>;
  onToggleLanguage(): void;
  onToggleTheme(): void;
  onLogout(): Promise<void>;
};
