import { useMemo, useState, type FormEvent } from "react";
import { Camera, CheckCircle2, Loader2, MapPin, Phone, Save, ShieldCheck, UserRound } from "lucide-react";
import { driverErrorMessage, updateDriverOwnProfile, uploadDriverAvatarFile } from "../../lib/driverData";
import type { DriverProfile, ProfileRole } from "../../types/driver";

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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const previewUrl = useMemo(() => (avatarFile ? URL.createObjectURL(avatarFile) : driver.avatar_url || ""), [avatarFile, driver.avatar_url]);

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
      setMessage(isArabic ? "تم حفظ ملفك وصورتك بنجاح." : "Your profile and avatar were saved.");
    } catch (profileError) {
      setError(driverErrorMessage(profileError, isArabic));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="dn-driver-profile-editor" onSubmit={(event) => void submit(event)}>
      <section className="dn-driver-profile-hero">
        <div className="dn-driver-profile-photo">
          {previewUrl ? <img src={previewUrl} alt={driver.full_name || "Driver"} /> : <UserRound />}
          <label>
            <Camera />
            <span>{isArabic ? "اختيار صورة" : "Choose photo"}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="user"
              onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
            />
          </label>
        </div>
        <div>
          <small>{isArabic ? "الملف التشغيلي" : "Operational profile"}</small>
          <h3>{driver.full_name || profile.full_name || "DAY NIGHT Driver"}</h3>
          <p>{driver.email || (isArabic ? "حساب مندوب موثّق" : "Verified driver account")}</p>
          <span><ShieldCheck /> {driver.status || "active"}</span>
        </div>
      </section>

      <div className="dn-driver-profile-form-grid">
        <label>
          <span><Phone /> {isArabic ? "رقم الهاتف" : "Phone"}</span>
          <input name="phone" defaultValue={driver.phone || profile.phone || ""} inputMode="tel" />
        </label>
        <label>
          <span><Phone /> {isArabic ? "اتصال الطوارئ" : "Emergency contact"}</span>
          <input name="emergency_contact" defaultValue={driver.emergency_contact || ""} inputMode="tel" />
        </label>
        <label>
          <span><MapPin /> {isArabic ? "منطقة العمل" : "Work area"}</span>
          <input name="work_area" defaultValue={driver.work_area || driver.emirate || ""} />
        </label>
        <label>
          <span>{isArabic ? "اللغة المفضلة" : "Preferred language"}</span>
          <select name="preferred_language" defaultValue={driver.preferred_language || (isArabic ? "ar" : "en")}>
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="is-wide">
          <span><MapPin /> {isArabic ? "العنوان" : "Address"}</span>
          <input name="address" defaultValue={driver.address || ""} />
        </label>
        <label className="is-wide">
          <span>{isArabic ? "نبذة تشغيلية" : "Operational bio"}</span>
          <textarea name="bio" rows={4} defaultValue={driver.bio || ""} placeholder={isArabic ? "خبرتك، المناطق التي تعرفها، وأي معلومات تشغيلية مهمة..." : "Experience, known areas and operational notes..."} />
        </label>
      </div>

      <section className="dn-driver-profile-static">
        <article><CheckCircle2 /><small>{isArabic ? "المركبة" : "Vehicle"}</small><strong>{driver.vehicle_type || "—"}</strong></article>
        <article><CheckCircle2 /><small>{isArabic ? "رقم اللوحة" : "Plate"}</small><strong>{driver.vehicle_plate || "—"}</strong></article>
        <article><CheckCircle2 /><small>{isArabic ? "الإمارة" : "Emirate"}</small><strong>{driver.emirate || "—"}</strong></article>
        <article><CheckCircle2 /><small>{isArabic ? "الرخصة" : "License"}</small><strong>{driver.license_number || "—"}</strong></article>
      </section>

      {message && <div className="dn-driver-profile-message is-success">{message}</div>}
      {error && <div className="dn-driver-profile-message is-error">{error}</div>}
      <button className="dn-driver-profile-save" type="submit" disabled={saving}>
        {saving ? <Loader2 className="animate-spin" /> : <Save />}
        {isArabic ? "حفظ الملف الشخصي" : "Save profile"}
      </button>
    </form>
  );
}
