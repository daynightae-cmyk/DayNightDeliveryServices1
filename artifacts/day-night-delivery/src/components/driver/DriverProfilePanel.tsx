import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileCheck2,
  Languages,
  Loader2,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import { driverErrorMessage, updateDriverOwnProfile, uploadDriverAvatarFile } from "../../lib/driverData";
import type { DriverProfile, ProfileRole } from "../../types/driver";

function daysUntil(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.ceil((time - Date.now()) / 86_400_000);
}

export default function DriverProfilePanel({
  profile,
  driver,
  isArabic,
  onUpdated,
}: {
  profile: ProfileRole;
  driver: DriverProfile;
  isArabic: boolean;
  onUpdated: () => Promise<void> | void;
}) {
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(driver.avatar_url || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const licenseDays = daysUntil(driver.license_expiry);
  const registrationDays = daysUntil(driver.vehicle_registration_expiry);
  const completion = useMemo(() => {
    const values = [
      driver.avatar_path,
      driver.full_name || profile.full_name,
      driver.phone || profile.phone,
      driver.emergency_contact,
      driver.work_area,
      driver.address,
      driver.bio,
      driver.vehicle_type,
      driver.vehicle_plate,
      driver.emirate,
      driver.license_number,
    ];
    return Math.round((values.filter(Boolean).length / values.length) * 100);
  }, [driver, profile.full_name, profile.phone]);

  useEffect(() => {
    if (!avatarFile) {
      setPreviewUrl(driver.avatar_url || "");
      return;
    }
    const objectUrl = URL.createObjectURL(avatarFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile, driver.avatar_url]);

  function chooseAvatar(file: File | null) {
    setError("");
    if (!file) {
      setAvatarFile(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError(isArabic ? "اختر ملف صورة صالحًا." : "Choose a valid image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(isArabic ? "حجم الصورة يجب ألا يتجاوز 5MB." : "Avatar must be smaller than 5MB.");
      return;
    }
    setAvatarFile(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      let avatarPath = driver.avatar_path || null;
      if (avatarFile) avatarPath = await uploadDriverAvatarFile(driver.user_id || driver.id, avatarFile);

      await updateDriverOwnProfile({
        phone: String(form.get("phone") || "").trim() || null,
        emergencyContact: String(form.get("emergency_contact") || "").trim() || null,
        avatarPath,
        bio: String(form.get("bio") || "").trim() || null,
        workArea: String(form.get("work_area") || "").trim() || null,
        address: String(form.get("address") || "").trim() || null,
        preferredLanguage: String(form.get("preferred_language") || "ar").trim() || "ar",
      });
      await onUpdated();
      setAvatarFile(null);
      setMessage(isArabic ? "تم حفظ ملفك وصورتك وظهرت التغييرات لدى الإدارة." : "Profile saved and synced with admin operations.");
    } catch (profileError) {
      setError(driverErrorMessage(profileError, isArabic));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="dn-driver-profile-editor dn-driver-profile-editor-v2" onSubmit={(event) => void submit(event)}>
      <section className="dn-driver-profile-hero dn-driver-profile-hero-v2">
        <div className="dn-driver-profile-photo">
          {previewUrl ? <img src={previewUrl} alt={driver.full_name || "Driver"} /> : <UserRound />}
          <label>
            <Camera />
            <span>{isArabic ? "صورة من الكاميرا أو الهاتف" : "Camera or gallery photo"}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={(event) => chooseAvatar(event.target.files?.[0] || null)} />
          </label>
        </div>
        <div className="dn-driver-profile-hero-copy">
          <small>{isArabic ? "الملف التشغيلي" : "Operational profile"}</small>
          <h3>{driver.full_name || profile.full_name || "DAY NIGHT Driver"}</h3>
          <p>{driver.email || (isArabic ? "حساب مندوب موثّق" : "Verified driver account")}</p>
          <div className="dn-driver-profile-badges"><span><ShieldCheck /> {driver.status || "active"}</span><span><Truck /> {driver.shift_status || "offline"}</span></div>
          <div className="dn-driver-profile-completion"><div><strong>{completion}%</strong><span>{isArabic ? "اكتمال الملف" : "Profile completion"}</span></div><i><b style={{ width: `${completion}%` }} /></i></div>
        </div>
      </section>

      <section className="dn-driver-profile-guidance">
        <article><Camera /><div><strong>{isArabic ? "صورة واضحة" : "Clear photo"}</strong><p>{isArabic ? "تظهر صورتك داخل علامة موقعك في خريطة الإدارة." : "Your photo is shown inside your live map marker."}</p></div></article>
        <article><MapPin /><div><strong>{isArabic ? "منطقة العمل" : "Work area"}</strong><p>{isArabic ? "اكتب المناطق التي تعرفها فعليًا لتسهيل التوزيع." : "List areas you genuinely know for better dispatch."}</p></div></article>
        <article><Phone /><div><strong>{isArabic ? "اتصال صحيح" : "Reachable phone"}</strong><p>{isArabic ? "استخدم رقمًا متاحًا أثناء الوردية." : "Use a phone number reachable during your shift."}</p></div></article>
      </section>

      <div className="dn-driver-profile-form-grid">
        <label><span><Phone /> {isArabic ? "رقم الهاتف" : "Phone"}</span><input name="phone" defaultValue={driver.phone || profile.phone || ""} inputMode="tel" autoComplete="tel" /></label>
        <label><span><Phone /> {isArabic ? "اتصال الطوارئ" : "Emergency contact"}</span><input name="emergency_contact" defaultValue={driver.emergency_contact || ""} inputMode="tel" /></label>
        <label><span><MapPin /> {isArabic ? "منطقة العمل" : "Work area"}</span><input name="work_area" defaultValue={driver.work_area || driver.emirate || ""} /></label>
        <label><span><Languages /> {isArabic ? "اللغة المفضلة" : "Preferred language"}</span><select name="preferred_language" defaultValue={driver.preferred_language || (isArabic ? "ar" : "en")}><option value="ar">العربية</option><option value="en">English</option></select></label>
        <label className="is-wide"><span><MapPin /> {isArabic ? "العنوان" : "Address"}</span><input name="address" defaultValue={driver.address || ""} /></label>
        <label className="is-wide"><span>{isArabic ? "نبذة تشغيلية" : "Operational bio"}</span><textarea name="bio" rows={4} defaultValue={driver.bio || ""} placeholder={isArabic ? "خبرتك، المناطق التي تعرفها، وأي معلومات تشغيلية مهمة..." : "Experience, known areas and operational notes..."} /></label>
      </div>

      <section className="dn-driver-profile-static dn-driver-profile-static-v2">
        <article><Truck /><small>{isArabic ? "المركبة" : "Vehicle"}</small><strong>{driver.vehicle_type || "—"}</strong><em>{driver.vehicle_color || "—"}</em></article>
        <article><CheckCircle2 /><small>{isArabic ? "رقم اللوحة" : "Plate"}</small><strong>{driver.vehicle_plate || "—"}</strong></article>
        <article><MapPin /><small>{isArabic ? "الإمارة" : "Emirate"}</small><strong>{driver.emirate || "—"}</strong></article>
        <article><FileCheck2 /><small>{isArabic ? "رقم الرخصة" : "License"}</small><strong>{driver.license_number || "—"}</strong></article>
      </section>

      <section className="dn-driver-documents-grid">
        <article className={licenseDays != null && licenseDays <= 30 ? "has-warning" : ""}><div>{licenseDays != null && licenseDays <= 30 ? <AlertTriangle /> : <ShieldCheck />}<span>{isArabic ? "رخصة القيادة" : "Driving license"}</span></div><strong>{driver.license_expiry || (isArabic ? "غير مسجل" : "Not recorded")}</strong><small>{licenseDays == null ? "—" : licenseDays < 0 ? (isArabic ? "منتهية" : "Expired") : isArabic ? `${licenseDays} يوم متبقٍ` : `${licenseDays} days left`}</small></article>
        <article className={registrationDays != null && registrationDays <= 30 ? "has-warning" : ""}><div>{registrationDays != null && registrationDays <= 30 ? <AlertTriangle /> : <ShieldCheck />}<span>{isArabic ? "تسجيل المركبة" : "Vehicle registration"}</span></div><strong>{driver.vehicle_registration_expiry || (isArabic ? "غير مسجل" : "Not recorded")}</strong><small>{registrationDays == null ? "—" : registrationDays < 0 ? (isArabic ? "منتهٍ" : "Expired") : isArabic ? `${registrationDays} يوم متبقٍ` : `${registrationDays} days left`}</small></article>
      </section>

      <p className="dn-driver-admin-managed-note"><ShieldCheck /> {isArabic ? "بيانات المركبة والرخصة والحالة الرسمية تُدار من لوحة الإدارة لحماية السجل التشغيلي." : "Vehicle, license and account status are admin-managed to protect the operational record."}</p>
      {message && <div className="dn-driver-profile-message is-success">{message}</div>}
      {error && <div className="dn-driver-profile-message is-error">{error}</div>}
      <button className="dn-driver-profile-save" type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />}{isArabic ? "حفظ ومزامنة الملف" : "Save and sync profile"}</button>
    </form>
  );
}
