import { useEffect, useRef, useState } from "react";
import {
  Building2,
  Camera,
  CheckCircle2,
  FileUp,
  Landmark,
  MapPin,
  Plus,
  ShieldCheck,
  Store,
  UserRound,
  Users,
} from "lucide-react";
import type { MerchantPortalCallbacks } from "./merchantCallbacks";
import { merchantDate, maskIban } from "./merchantFormatters";
import type {
  MerchantAddressBookEntryViewModel,
  MerchantBranchViewModel,
  MerchantDocumentViewModel,
  MerchantProfileViewModel,
  MerchantTeamMemberViewModel,
} from "./merchantViewModels";
import {
  MerchantButton,
  MerchantCard,
  MerchantField,
  MerchantSectionHeader,
  MerchantStatePanel,
  MerchantStatusBadge,
} from "./MerchantUi";

export type MerchantBusinessSection =
  | "branches"
  | "pickup_addresses"
  | "address_book"
  | "profile"
  | "branding"
  | "business_details"
  | "bank_details"
  | "documents"
  | "team";

export interface MerchantBusinessWorkspaceProps {
  isArabic: boolean;
  section: MerchantBusinessSection;
  merchant: MerchantProfileViewModel;
  branches: MerchantBranchViewModel[];
  addressBook: MerchantAddressBookEntryViewModel[];
  documents: MerchantDocumentViewModel[];
  team: MerchantTeamMemberViewModel[];
  callbacks: MerchantPortalCallbacks;
  readOnly?: boolean;
}

const emptyBranch: Partial<MerchantBranchViewModel> = {
  name: "",
  code: "",
  contactName: "",
  phone: "",
  email: "",
  emirate: "Abu Dhabi",
  city: "",
  address: "",
  workingHours: "09:00-18:00",
  pickupInstructions: "",
  isDefault: false,
  active: true,
};

const emptyRecipient: Partial<MerchantAddressBookEntryViewModel> = {
  recipientName: "",
  phone: "",
  alternatePhone: "",
  email: "",
  emirate: "Abu Dhabi",
  city: "",
  area: "",
  address: "",
  building: "",
  floor: "",
  landmark: "",
  notes: "",
  tags: [],
};

const emptyTeam: Partial<MerchantTeamMemberViewModel> = {
  name: "",
  email: "",
  phone: "",
  role: "viewer",
  status: "invited",
  permissions: ["view_orders"],
};

function ProfileEditor({ isArabic, merchant, callbacks, readOnly, mode }: {
  isArabic: boolean;
  merchant: MerchantProfileViewModel;
  callbacks: MerchantPortalCallbacks;
  readOnly?: boolean;
  mode: "profile" | "business_details" | "bank_details" | "branding";
}) {
  const [draft, setDraft] = useState<MerchantProfileViewModel>(merchant);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(merchant), [merchant]);

  async function saveProfile() {
    setBusy(true);
    setNotice("");
    const result = mode === "bank_details" && callbacks.onUpdateBankDetails
      ? await callbacks.onUpdateBankDetails(draft)
      : await callbacks.onUpdateProfile(draft);
    setBusy(false);
    setNotice(result.success
      ? mode === "bank_details"
        ? (isArabic ? "تم إرسال البيانات البنكية للمراجعة الآمنة." : "Bank details were submitted for secure review.")
        : (isArabic ? "تم حفظ بيانات النشاط." : "Business details were saved.")
      : result.error?.message || (isArabic ? "تعذر حفظ البيانات." : "The details could not be saved."));
  }

  async function uploadLogo(file?: File) {
    if (!file || !callbacks.onUploadLogo) return;
    setBusy(true);
    setNotice("");
    const result = await callbacks.onUploadLogo(file);
    setBusy(false);
    if (result.success && result.url) {
      setDraft((current) => ({ ...current, logoUrl: result.url }));
      setNotice(isArabic ? "تم رفع الشعار وربطه بالمتجر." : "The logo was uploaded and linked to the store.");
    } else setNotice(result.error?.message || (isArabic ? "تعذر رفع الشعار." : "The logo could not be uploaded."));
  }

  const title = mode === "profile"
    ? ["الملف التجاري", "Merchant profile"]
    : mode === "business_details"
      ? ["بيانات المنشأة", "Business details"]
      : mode === "bank_details"
        ? ["البيانات البنكية", "Bank details"]
        : ["هوية المتجر", "Store branding"];

  return <div className="dn-merchant-stack">
    <MerchantSectionHeader
      eyebrowAr="إدارة النشاط"
      eyebrowEn="BUSINESS MANAGEMENT"
      titleAr={title[0]}
      titleEn={title[1]}
      descriptionAr="تُحفظ التعديلات من خلال خدمات التاجر الموثوقة وتبقى المراجعات المالية تحت رقابة DAY NIGHT."
      descriptionEn="Updates use authoritative merchant services; sensitive financial changes remain subject to DAY NIGHT review."
      isArabic={isArabic}
    />
    <MerchantCard>
      {mode === "branding" ? <div className="dn-merchant-branding-editor">
        <div className="dn-merchant-logo-preview">{draft.logoUrl ? <img src={draft.logoUrl} alt={draft.tradeName} /> : <Store />}</div>
        <div>
          <h3>{draft.tradeName}</h3>
          <p>{isArabic ? "يظهر شعار متجرك داخل مساحته المخصصة، بينما تظل DAY NIGHT هوية المنصة الأساسية." : "Your store logo appears in its assigned areas while DAY NIGHT remains the primary platform identity."}</p>
          <MerchantButton disabled={readOnly || busy || !callbacks.onUploadLogo} onClick={() => logoInput.current?.click()}>
            <Camera />{isArabic ? "رفع أو استبدال الشعار" : "Upload or replace logo"}
          </MerchantButton>
          <input ref={logoInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadLogo(event.target.files?.[0])} />
        </div>
      </div> : <div className="dn-merchant-form-grid">
        {mode === "profile" ? <>
          <MerchantField label={isArabic ? "الاسم التجاري" : "Trade name"} required><input value={draft.tradeName} onChange={(event) => setDraft({ ...draft, tradeName: event.target.value })} /></MerchantField>
          <MerchantField label={isArabic ? "اسم المسؤول" : "Owner / contact"}><input value={draft.ownerName || ""} onChange={(event) => setDraft({ ...draft, ownerName: event.target.value })} /></MerchantField>
          <MerchantField label={isArabic ? "الهاتف" : "Phone"} required><input dir="ltr" value={draft.phone || ""} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></MerchantField>
          <MerchantField label={isArabic ? "الهاتف البديل" : "Alternate phone"}><input dir="ltr" value={draft.alternatePhone || ""} onChange={(event) => setDraft({ ...draft, alternatePhone: event.target.value })} /></MerchantField>
          <MerchantField label={isArabic ? "البريد" : "Email"}><input dir="ltr" type="email" value={draft.email || ""} readOnly aria-readonly="true" title={isArabic ? "تغيير البريد يتطلب إجراء أمان منفصل" : "Changing email requires a separate security flow"} /></MerchantField>
          <MerchantField label={isArabic ? "الإمارة" : "Emirate"}><input value={draft.emirate || ""} onChange={(event) => setDraft({ ...draft, emirate: event.target.value })} /></MerchantField>
          <MerchantField label={isArabic ? "المدينة / المنطقة" : "City / area"}><input value={draft.city || ""} onChange={(event) => setDraft({ ...draft, city: event.target.value })} /></MerchantField>
          <MerchantField label={isArabic ? "العنوان التجاري" : "Business address"}><input value={draft.address || ""} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></MerchantField>
          <MerchantField label={isArabic ? "عنوان الاستلام" : "Pickup address"}><input value={draft.pickupAddress || ""} onChange={(event) => setDraft({ ...draft, pickupAddress: event.target.value })} /></MerchantField>
        </> : null}
        {mode === "business_details" ? <>
          <MerchantField label={isArabic ? "الاسم القانوني" : "Legal trade name"} required><input value={draft.tradeName} onChange={(event) => setDraft({ ...draft, tradeName: event.target.value })} /></MerchantField>
          <MerchantField label={isArabic ? "نوع النشاط" : "Business type"}><input value={draft.businessType || ""} onChange={(event) => setDraft({ ...draft, businessType: event.target.value })} /></MerchantField>
          <MerchantField label={isArabic ? "رقم الرخصة" : "Trade licence number"}><input dir="ltr" value={draft.licenseNumber || ""} onChange={(event) => setDraft({ ...draft, licenseNumber: event.target.value })} /></MerchantField>
          <MerchantField label={isArabic ? "انتهاء الرخصة" : "Licence expiry"}><input type="date" value={draft.licenseExpiry || ""} onChange={(event) => setDraft({ ...draft, licenseExpiry: event.target.value })} /></MerchantField>
          <MerchantField label="TRN"><input dir="ltr" value={draft.trn || ""} onChange={(event) => setDraft({ ...draft, trn: event.target.value })} /></MerchantField>
          <MerchantField label={isArabic ? "حالة بوابة التاجر" : "Portal access status"}><input readOnly value={draft.portalAccessStatus || "—"} /></MerchantField>
        </> : null}
        {mode === "bank_details" ? <>
          <MerchantField label={isArabic ? "اسم البنك" : "Bank name"} required><input value={draft.bankName || ""} onChange={(event) => setDraft({ ...draft, bankName: event.target.value })} /></MerchantField>
          <MerchantField label={isArabic ? "صاحب الحساب" : "Account holder"}><input value={draft.ownerName || ""} onChange={(event) => setDraft({ ...draft, ownerName: event.target.value })} /></MerchantField>
          <MerchantField label="IBAN" hint={isArabic ? `المسجل حالياً: ${maskIban(merchant.maskedIban)}` : `Currently registered: ${maskIban(merchant.maskedIban)}`}><input dir="ltr" autoComplete="off" value={draft.maskedIban || ""} onChange={(event) => setDraft({ ...draft, maskedIban: event.target.value.toUpperCase().replace(/\s+/g, "") })} /></MerchantField>
          <MerchantField label={isArabic ? "دورة التسوية" : "Settlement cycle"}><select value={draft.settlementCycle || "weekly"} onChange={(event) => setDraft({ ...draft, settlementCycle: event.target.value })}><option value="weekly">{isArabic ? "أسبوعية" : "Weekly"}</option><option value="biweekly">{isArabic ? "كل أسبوعين" : "Biweekly"}</option><option value="monthly">{isArabic ? "شهرية" : "Monthly"}</option></select></MerchantField>
        </> : null}
      </div>}
      {mode !== "branding" ? <footer className="dn-merchant-form-actions"><MerchantButton disabled={readOnly || busy || !draft.tradeName || (mode === "bank_details" && !callbacks.onUpdateBankDetails)} onClick={() => void saveProfile()}><ShieldCheck />{busy ? (isArabic ? "جاري الحفظ..." : "Saving...") : (isArabic ? "حفظ آمن" : "Save securely")}</MerchantButton></footer> : null}
    </MerchantCard>
    {notice ? <p className="dn-merchant-inline-notice" role="status">{notice}</p> : null}
  </div>;
}

function BranchesManager({ isArabic, branches, callbacks, readOnly, pickupOnly }: { isArabic: boolean; branches: MerchantBranchViewModel[]; callbacks: MerchantPortalCallbacks; readOnly?: boolean; pickupOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<MerchantBranchViewModel>>(emptyBranch);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function save() {
    if (!callbacks.onSaveBranch) return;
    setBusy(true);
    const result = await callbacks.onSaveBranch(draft);
    setBusy(false);
    setNotice(result.success ? (isArabic ? "تم حفظ الموقع." : "Location saved.") : result.error?.message || "Error");
    if (result.success) { setOpen(false); setDraft(emptyBranch); await callbacks.onRefreshData(); }
  }

  return <div className="dn-merchant-stack">
    <MerchantSectionHeader eyebrowAr="المواقع" eyebrowEn="LOCATIONS" titleAr={pickupOnly ? "عناوين الاستلام" : "الفروع"} titleEn={pickupOnly ? "Pickup addresses" : "Branches"} descriptionAr="أضف مواقع النشاط ونقاط الاستلام مع جهة الاتصال وساعات العمل." descriptionEn="Manage operating locations and pickup points with contacts and working hours." isArabic={isArabic} actions={<MerchantButton disabled={readOnly || !callbacks.onSaveBranch} onClick={() => setOpen((value) => !value)}><Plus />{isArabic ? "إضافة موقع" : "Add location"}</MerchantButton>} />
    {open ? <MerchantCard>
      <div className="dn-merchant-form-grid">
        <MerchantField label={isArabic ? "اسم الموقع" : "Location name"} required><input value={draft.name || ""} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></MerchantField>
        <MerchantField label={isArabic ? "الكود" : "Code"}><input dir="ltr" value={draft.code || ""} onChange={(event) => setDraft({ ...draft, code: event.target.value })} /></MerchantField>
        <MerchantField label={isArabic ? "جهة الاتصال" : "Contact name"}><input value={draft.contactName || ""} onChange={(event) => setDraft({ ...draft, contactName: event.target.value })} /></MerchantField>
        <MerchantField label={isArabic ? "الهاتف" : "Phone"}><input dir="ltr" value={draft.phone || ""} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></MerchantField>
        <MerchantField label={isArabic ? "الإمارة" : "Emirate"}><input value={draft.emirate || ""} onChange={(event) => setDraft({ ...draft, emirate: event.target.value })} /></MerchantField>
        <MerchantField label={isArabic ? "المدينة" : "City"}><input value={draft.city || ""} onChange={(event) => setDraft({ ...draft, city: event.target.value })} /></MerchantField>
        <MerchantField label={isArabic ? "العنوان" : "Address"} required><input value={draft.address || ""} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></MerchantField>
        <MerchantField label={isArabic ? "ساعات العمل" : "Working hours"}><input value={draft.workingHours || ""} onChange={(event) => setDraft({ ...draft, workingHours: event.target.value })} /></MerchantField>
      </div>
      <MerchantField label={isArabic ? "تعليمات الاستلام" : "Pickup instructions"}><textarea rows={3} value={draft.pickupInstructions || ""} onChange={(event) => setDraft({ ...draft, pickupInstructions: event.target.value })} /></MerchantField>
      <footer className="dn-merchant-form-actions"><MerchantButton variant="secondary" onClick={() => setOpen(false)}>{isArabic ? "إلغاء" : "Cancel"}</MerchantButton><MerchantButton disabled={busy || !draft.name || !draft.address} onClick={() => void save()}><CheckCircle2 />{isArabic ? "حفظ الموقع" : "Save location"}</MerchantButton></footer>
    </MerchantCard> : null}
    {notice ? <p className="dn-merchant-inline-notice">{notice}</p> : null}
    {branches.length ? <div className="dn-merchant-list-grid">{branches.map((branch) => <MerchantCard key={branch.id}>
      <header className="dn-merchant-card-header"><div><span dir="ltr">{branch.code || "—"}</span><h3>{branch.name}</h3></div><MerchantStatusBadge status={branch.active === false ? "inactive" : "active"} isArabic={isArabic} /></header>
      <p><MapPin /> {[branch.emirate, branch.city, branch.address].filter(Boolean).join(" · ") || "—"}</p>
      <dl className="dn-merchant-detail-list"><div><dt>{isArabic ? "الهاتف" : "Phone"}</dt><dd dir="ltr">{branch.phone || "—"}</dd></div><div><dt>{isArabic ? "الساعات" : "Hours"}</dt><dd>{branch.workingHours || "—"}</dd></div><div><dt>{isArabic ? "افتراضي" : "Default"}</dt><dd>{branch.isDefault ? (isArabic ? "نعم" : "Yes") : (isArabic ? "لا" : "No")}</dd></div></dl>
    </MerchantCard>)}</div> : <MerchantStatePanel type="empty" isArabic={isArabic} titleAr="لا توجد مواقع مسجلة" titleEn="No locations registered" />}
  </div>;
}

function AddressBookManager({ isArabic, entries, callbacks, readOnly }: { isArabic: boolean; entries: MerchantAddressBookEntryViewModel[]; callbacks: MerchantPortalCallbacks; readOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<MerchantAddressBookEntryViewModel>>(emptyRecipient);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!callbacks.onSaveAddressBookEntry) return;
    setBusy(true); const result = await callbacks.onSaveAddressBookEntry(draft); setBusy(false);
    setNotice(result.success ? (isArabic ? "تم حفظ المستلم." : "Recipient saved.") : result.error?.message || "Error");
    if (result.success) { setOpen(false); setDraft(emptyRecipient); await callbacks.onRefreshData(); }
  }
  return <div className="dn-merchant-stack">
    <MerchantSectionHeader eyebrowAr="العملاء" eyebrowEn="RECIPIENTS" titleAr="دفتر العناوين" titleEn="Address book" descriptionAr="احفظ العملاء المتكررين وأنشئ طلباً لهم بسرعة." descriptionEn="Save frequent recipients and create shipments faster." isArabic={isArabic} actions={<MerchantButton disabled={readOnly || !callbacks.onSaveAddressBookEntry} onClick={() => setOpen((value) => !value)}><Plus />{isArabic ? "إضافة مستلم" : "Add recipient"}</MerchantButton>} />
    {open ? <MerchantCard><div className="dn-merchant-form-grid">
      <MerchantField label={isArabic ? "الاسم" : "Name"} required><input value={draft.recipientName || ""} onChange={(event) => setDraft({ ...draft, recipientName: event.target.value })} /></MerchantField>
      <MerchantField label={isArabic ? "الهاتف" : "Phone"} required><input dir="ltr" value={draft.phone || ""} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></MerchantField>
      <MerchantField label={isArabic ? "هاتف بديل" : "Alternate phone"}><input dir="ltr" value={draft.alternatePhone || ""} onChange={(event) => setDraft({ ...draft, alternatePhone: event.target.value })} /></MerchantField>
      <MerchantField label={isArabic ? "الإمارة" : "Emirate"}><input value={draft.emirate || ""} onChange={(event) => setDraft({ ...draft, emirate: event.target.value })} /></MerchantField>
      <MerchantField label={isArabic ? "المدينة" : "City"}><input value={draft.city || ""} onChange={(event) => setDraft({ ...draft, city: event.target.value })} /></MerchantField>
      <MerchantField label={isArabic ? "المنطقة" : "Area"}><input value={draft.area || ""} onChange={(event) => setDraft({ ...draft, area: event.target.value })} /></MerchantField>
      <MerchantField label={isArabic ? "العنوان" : "Address"} required><input value={draft.address || ""} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></MerchantField>
      <MerchantField label={isArabic ? "علامة مميزة" : "Landmark"}><input value={draft.landmark || ""} onChange={(event) => setDraft({ ...draft, landmark: event.target.value })} /></MerchantField>
    </div><footer className="dn-merchant-form-actions"><MerchantButton variant="secondary" onClick={() => setOpen(false)}>{isArabic ? "إلغاء" : "Cancel"}</MerchantButton><MerchantButton disabled={busy || !draft.recipientName || !draft.phone || !draft.address} onClick={() => void save()}>{isArabic ? "حفظ" : "Save"}</MerchantButton></footer></MerchantCard> : null}
    {notice ? <p className="dn-merchant-inline-notice">{notice}</p> : null}
    {entries.length ? <div className="dn-merchant-list-grid">{entries.map((entry) => <MerchantCard key={entry.id}><UserRound /><h3>{entry.recipientName}</h3><p dir="ltr">{entry.phone}</p><p>{[entry.emirate, entry.city, entry.area, entry.address].filter(Boolean).join(" · ")}</p><MerchantButton variant="secondary" onClick={() => callbacks.onNavigate("new_order", undefined)}>{isArabic ? "إنشاء طلب" : "Create order"}</MerchantButton></MerchantCard>)}</div> : <MerchantStatePanel type="empty" isArabic={isArabic} />}
  </div>;
}

function DocumentsManager({ isArabic, documents, callbacks, readOnly }: { isArabic: boolean; documents: MerchantDocumentViewModel[]; callbacks: MerchantPortalCallbacks; readOnly?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [meta, setMeta] = useState<Partial<MerchantDocumentViewModel>>({ type: "trade_licence", status: "under_review" });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function upload(file?: File) {
    if (!file || !callbacks.onUploadDocument) return;
    setBusy(true); const result = await callbacks.onUploadDocument(file, meta); setBusy(false);
    setNotice(result.success ? (isArabic ? "تم رفع المستند للمراجعة." : "Document uploaded for review.") : result.error?.message || "Error");
    if (result.success) await callbacks.onRefreshData();
  }
  return <div className="dn-merchant-stack">
    <MerchantSectionHeader eyebrowAr="الامتثال" eyebrowEn="COMPLIANCE" titleAr="المستندات" titleEn="Documents" descriptionAr="الرخصة وTRN وخطاب البنك والاتفاقيات مع حالات المراجعة والانتهاء." descriptionEn="Trade licence, TRN, bank letter, and agreements with review and expiry states." isArabic={isArabic} />
    <MerchantCard><div className="dn-merchant-form-grid"><MerchantField label={isArabic ? "نوع المستند" : "Document type"}><select value={meta.type || "trade_licence"} onChange={(event) => setMeta({ ...meta, type: event.target.value })}><option value="trade_licence">{isArabic ? "الرخصة التجارية" : "Trade licence"}</option><option value="trn_certificate">TRN</option><option value="owner_id">{isArabic ? "هوية المالك" : "Owner ID"}</option><option value="bank_letter">{isArabic ? "خطاب البنك" : "Bank letter"}</option><option value="agreement">{isArabic ? "الاتفاقية" : "Agreement"}</option><option value="additional">{isArabic ? "مستند إضافي" : "Additional"}</option></select></MerchantField><MerchantField label={isArabic ? "الرقم" : "Number"}><input dir="ltr" value={meta.number || ""} onChange={(event) => setMeta({ ...meta, number: event.target.value })} /></MerchantField><MerchantField label={isArabic ? "تاريخ الإصدار" : "Issue date"}><input type="date" value={meta.issueDate || ""} onChange={(event) => setMeta({ ...meta, issueDate: event.target.value })} /></MerchantField><MerchantField label={isArabic ? "تاريخ الانتهاء" : "Expiry date"}><input type="date" value={meta.expiryDate || ""} onChange={(event) => setMeta({ ...meta, expiryDate: event.target.value })} /></MerchantField></div><MerchantButton disabled={readOnly || busy || !callbacks.onUploadDocument} onClick={() => input.current?.click()}><FileUp />{isArabic ? "اختيار ورفع المستند" : "Choose and upload document"}</MerchantButton><input ref={input} hidden type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => void upload(event.target.files?.[0])} /></MerchantCard>
    {notice ? <p className="dn-merchant-inline-notice">{notice}</p> : null}
    {documents.length ? <div className="dn-merchant-list-grid">{documents.map((document) => <MerchantCard key={document.id}><header className="dn-merchant-card-header"><div><span>{document.type}</span><h3 dir="ltr">{document.number || "—"}</h3></div><MerchantStatusBadge status={document.status} isArabic={isArabic} /></header><dl className="dn-merchant-detail-list"><div><dt>{isArabic ? "الإصدار" : "Issued"}</dt><dd>{merchantDate(document.issueDate, isArabic)}</dd></div><div><dt>{isArabic ? "الانتهاء" : "Expiry"}</dt><dd>{merchantDate(document.expiryDate, isArabic)}</dd></div></dl>{document.reviewNote ? <p>{document.reviewNote}</p> : null}</MerchantCard>)}</div> : <MerchantStatePanel type="empty" isArabic={isArabic} />}
  </div>;
}

function TeamManager({ isArabic, team, callbacks, readOnly }: { isArabic: boolean; team: MerchantTeamMemberViewModel[]; callbacks: MerchantPortalCallbacks; readOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<MerchantTeamMemberViewModel>>(emptyTeam);
  const [notice, setNotice] = useState("");
  async function save() {
    if (!callbacks.onSaveTeamMember) return;
    const result = await callbacks.onSaveTeamMember(draft);
    setNotice(result.success ? (isArabic ? "تم حفظ عضو الفريق." : "Team member saved.") : result.error?.message || "Error");
    if (result.success) { setOpen(false); setDraft(emptyTeam); await callbacks.onRefreshData(); }
  }
  return <div className="dn-merchant-stack">
    <MerchantSectionHeader eyebrowAr="الفريق" eyebrowEn="TEAM" titleAr="المستخدمون والصلاحيات" titleEn="Users and permissions" descriptionAr="الصلاحيات المعروضة لا تتجاوز حماية الخادم وRLS." descriptionEn="Displayed permissions never replace server authorization and RLS." isArabic={isArabic} actions={<MerchantButton disabled={readOnly || !callbacks.onSaveTeamMember} onClick={() => setOpen((value) => !value)}><Plus />{isArabic ? "إضافة عضو" : "Add member"}</MerchantButton>} />
    {open ? <MerchantCard><div className="dn-merchant-form-grid"><MerchantField label={isArabic ? "الاسم" : "Name"} required><input value={draft.name || ""} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></MerchantField><MerchantField label={isArabic ? "البريد" : "Email"} required><input dir="ltr" type="email" value={draft.email || ""} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></MerchantField><MerchantField label={isArabic ? "الهاتف" : "Phone"}><input dir="ltr" value={draft.phone || ""} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></MerchantField><MerchantField label={isArabic ? "الدور" : "Role"}><select value={draft.role || "viewer"} onChange={(event) => setDraft({ ...draft, role: event.target.value })}><option value="owner">Owner</option><option value="manager">Manager</option><option value="operations">Operations</option><option value="finance">Finance</option><option value="viewer">Viewer</option></select></MerchantField></div><footer className="dn-merchant-form-actions"><MerchantButton variant="secondary" onClick={() => setOpen(false)}>{isArabic ? "إلغاء" : "Cancel"}</MerchantButton><MerchantButton disabled={!draft.name || !draft.email} onClick={() => void save()}>{isArabic ? "حفظ العضو" : "Save member"}</MerchantButton></footer></MerchantCard> : null}
    {notice ? <p className="dn-merchant-inline-notice">{notice}</p> : null}
    {team.length ? <div className="dn-merchant-list-grid">{team.map((member) => <MerchantCard key={member.id}><Users /><h3>{member.name}</h3><p dir="ltr">{member.email || "—"}</p><p>{member.role} · {member.status}</p><div className="dn-merchant-tags">{(member.permissions || []).map((permission) => <span key={permission}>{permission}</span>)}</div></MerchantCard>)}</div> : <MerchantStatePanel type="empty" isArabic={isArabic} />}
  </div>;
}

export function MerchantBusinessWorkspace(props: MerchantBusinessWorkspaceProps) {
  const { section } = props;
  if (section === "profile" || section === "business_details" || section === "bank_details" || section === "branding") return <ProfileEditor {...props} mode={section} />;
  if (section === "branches" || section === "pickup_addresses") return <BranchesManager isArabic={props.isArabic} branches={props.branches} callbacks={props.callbacks} readOnly={props.readOnly} pickupOnly={section === "pickup_addresses"} />;
  if (section === "address_book") return <AddressBookManager isArabic={props.isArabic} entries={props.addressBook} callbacks={props.callbacks} readOnly={props.readOnly} />;
  if (section === "documents") return <DocumentsManager isArabic={props.isArabic} documents={props.documents} callbacks={props.callbacks} readOnly={props.readOnly} />;
  return <TeamManager isArabic={props.isArabic} team={props.team} callbacks={props.callbacks} readOnly={props.readOnly} />;
}
