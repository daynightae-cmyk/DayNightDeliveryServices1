from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx"
source = TARGET.read_text(encoding="utf-8")

source = source.replace(
'''  AlertTriangle,
  Calculator,
  CheckCircle2,
  FileText,
''',
'''  AlertTriangle,
  Bug,
  Calculator,
  CheckCircle2,
  Copy,
  FileText,
''',
1,
)
source = source.replace(
'''  Save,
  ShieldCheck,
  Store,
''',
'''  Save,
  ShieldCheck,
  Sparkles,
  Store,
''',
1,
)

old_classes = '''const inputClass = () =>
  "w-full rounded-xl border border-white/10 bg-brand-deep/75 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-white/30 focus:border-brand-gold/60 focus:ring-2 focus:ring-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-45";
const labelClass = "block space-y-1 text-xs font-black text-white/65";
const sectionClass =
  "space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4";
'''
new_classes = '''const inputClass = () =>
  "w-full rounded-2xl border border-white/10 bg-[#06182d]/80 px-4 py-3.5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-200 placeholder:text-white/30 hover:border-white/20 focus:-translate-y-px focus:border-brand-gold/70 focus:bg-[#071c35] focus:ring-4 focus:ring-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-45";
const labelClass =
  "block space-y-2 text-xs font-black tracking-[0.01em] text-white/65";
const sectionClass =
  "space-y-4 rounded-[1.65rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(2,18,38,0.66))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-sm sm:p-5";
'''
if old_classes not in source:
    raise SystemExit("base visual classes not found")
source = source.replace(old_classes, new_classes, 1)

money_anchor = '''function moneyDiffers(left: unknown, right: unknown) {
  const a = Number(left || 0);
  const b = Number(right || 0);
  return !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > 0.005;
}
'''
helpers = money_anchor + '''
function safeEditDiagnostic(detail: string) {
  return clean(detail)
    .replace(/bearer\\s+[a-z0-9._~-]+/gi, "Bearer [hidden]")
    .replace(/eyJ[a-z0-9_-]+\\.[a-z0-9_-]+\\.[a-z0-9_-]+/gi, "[token hidden]")
    .replace(/https?:\\/\\/[^\\s|]+/gi, "[endpoint]")
    .replace(/\\s+/g, " ")
    .slice(0, 700);
}

function editErrorReference(detail: string) {
  const reason = clean(detail).toLowerCase();
  const databaseCode = reason.match(
    /\\b(?:pgrst\\d{3}|(?:22|23|25|28|40|42|53|55|57|58)[0-9a-z]{3})\\b/i,
  )?.[0];
  const symbolicCode = reason.match(
    /\\b(?:admin|order|merchant|financial|coupon|delivery|complete)_[a-z0-9_]{3,}\\b/i,
  )?.[0];
  return clean(databaseCode || symbolicCode || "ORDER_SAVE_REJECTED").toUpperCase();
}
'''
if money_anchor not in source:
    raise SystemExit("moneyDiffers anchor not found")
source = source.replace(money_anchor, helpers, 1)

permission_anchor = '''  if (/not_authorized|permission denied|row-level security|rls/.test(reason)) {
    return isArabic
      ? "لا يملك الحساب الحالي صلاحية تعديل هذا الطلب. استخدم حساب مدير أو دعم معتمد. لم يُحفظ أي تعديل جزئي."
      : "The current account is not authorized to edit this order. Use an approved admin or support account. No partial change was stored.";
  }
'''
extra_errors = permission_anchor + '''  if (/admin_edit_reason_required_min_6|reason.*minimum|reason.*required/.test(reason)) {
    return isArabic
      ? "سبب التعديل مطلوب لهذه العملية ويجب أن يكون واضحًا وألا يقل عن 6 أحرف. لم يُحفظ أي تعديل جزئي."
      : "A clear edit reason of at least 6 characters is required. No partial change was stored.";
  }
  if (/23502|null value.*violates|not-null constraint/.test(reason)) {
    return isArabic
      ? "يوجد حقل أساسي لم تصل قيمته إلى قاعدة البيانات. راجع الحقول الإلزامية الموضحة داخل الكارت ثم أعد الحفظ. لم يُحفظ أي تعديل جزئي."
      : "A required database field is missing. Review the required fields shown in the editor and save again. No partial change was stored.";
  }
  if (/23503|foreign key|violates foreign key/.test(reason)) {
    return isArabic
      ? "يرتبط الطلب بسجل غير صالح أو محذوف، مثل التاجر أو الحساب المرتبط. أعد اختيار السجل الصحيح ثم احفظ. لم يُحفظ أي تعديل جزئي."
      : "The order references an invalid or deleted related record. Select the correct merchant or linked record and save again. No partial change was stored.";
  }
  if (/23514|check constraint|violates check/.test(reason)) {
    return isArabic
      ? "إحدى القيم تخالف قاعدة تشغيل معتمدة في النظام. راجع المبالغ وطريقة التحصيل وحالة الطلب، وسيظهر رمز القاعدة في التفاصيل التشخيصية. لم يُحفظ أي تعديل جزئي."
      : "A value violates an approved business rule. Review the amounts, payment method, and order state. The rule code is shown in diagnostics. No partial change was stored.";
  }
  if (/22p02|invalid input syntax|invalid text representation/.test(reason)) {
    return isArabic
      ? "تنسيق إحدى القيم غير صحيح، مثل رقم أو معرّف أو رمز دولة. صحح القيمة الموضحة ثم أعد الحفظ. لم يُحفظ أي تعديل جزئي."
      : "A value has an invalid format, such as a number, identifier, or country code. Correct it and save again. No partial change was stored.";
  }
  if (/40001|40p01|serialization|deadlock|concurrent update|concurrent modification/.test(reason)) {
    return isArabic
      ? "تم تعديل الطلب من عملية أخرى في اللحظة نفسها. أغلق الكارت وافتح الطلب مجددًا للحصول على أحدث نسخة، ثم أعد الحفظ. لم يُحفظ أي تعديل جزئي."
      : "Another operation changed the order at the same time. Reopen the order to load the latest version, then save again. No partial change was stored.";
  }
  if (/pgrst116|order_not_found|no rows|returned no rows/.test(reason)) {
    return isArabic
      ? "لم تعد الطلبية موجودة بالمرجع الحالي أو لم يعد الحساب مخولًا لقراءتها. حدّث قائمة الطلبات ثم افتحها من جديد. لم يُحفظ أي تعديل جزئي."
      : "The order no longer exists under this reference or is no longer readable by this account. Refresh the order list and reopen it. No partial change was stored.";
  }
  if (/readback.*mismatch|verification_failed|returned_no_order|returned no order/.test(reason)) {
    return isArabic
      ? "نفذت قاعدة البيانات العملية لكن التحقق النهائي من القيم المحفوظة لم يطابق الطلب. أُلغيت العملية للحماية، ويظهر رمز التحقق داخل التفاصيل."
      : "The database operation ran, but saved-value verification did not match. The transaction was rolled back for safety; see the diagnostic code.";
  }
  if (/locked_order_merchant_change_requires_complete_audited_edit/.test(reason)) {
    return isArabic
      ? "لا يمكن نقل طلب مُسلّم إلى تاجر آخر عبر تعديل البيانات العادي. اكتب سبب النقل وأكد المراجعة ليُنفذ النقل المالي المُدقّق. لم يُحفظ أي تعديل جزئي."
      : "A delivered order cannot be moved to another merchant through a core-data edit. Enter a reason and confirm the audited financial transfer. No partial change was stored.";
  }
'''
if permission_anchor not in source:
    raise SystemExit("permission mapping anchor not found")
source = source.replace(permission_anchor, extra_errors, 1)

old_fallback = '''  return isArabic
    ? "تعذر حفظ التعديلات لأن قاعدة البيانات رفضت العملية. تم إلغاء العملية بالكامل دون حفظ جزئي. حدّث الصفحة ثم أعد المحاولة."
    : "The database rejected the update. The entire transaction was rolled back with no partial save. Refresh and try again.";
'''
new_fallback = '''  return isArabic
    ? "رفضت قاعدة البيانات العملية لسبب لم يُصنَّف بعد. ستجد رمز الرد والتفصيل التشخيصي الدقيق داخل بطاقة الخطأ أدناه. أُلغيت العملية بالكامل دون حفظ جزئي."
    : "The database rejected the update for an unclassified reason. The exact response code and diagnostic detail are shown below. The transaction rolled back with no partial save.";
'''
if old_fallback not in source:
    raise SystemExit("generic fallback not found")
source = source.replace(old_fallback, new_fallback, 1)

state_anchor = '''  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
'''
state_new = '''  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [errorReference, setErrorReference] = useState("");
  const [errorDiagnostic, setErrorDiagnostic] = useState("");
'''
if state_anchor not in source:
    raise SystemExit("feedback state anchor not found")
source = source.replace(state_anchor, state_new, 1)

reset_anchor = '''    setMessage("");
    setError("");
  }, [merchants, open, order]);
'''
reset_new = '''    setMessage("");
    setError("");
    setErrorReference("");
    setErrorDiagnostic("");
  }, [merchants, open, order]);
'''
if reset_anchor not in source:
    raise SystemExit("effect feedback reset not found")
source = source.replace(reset_anchor, reset_new, 1)

clear_anchor = '''  function clearFeedback() {
    setMessage("");
    setError("");
  }
'''
clear_new = '''  function clearFeedback() {
    setMessage("");
    setError("");
    setErrorReference("");
    setErrorDiagnostic("");
  }
'''
if clear_anchor not in source:
    raise SystemExit("clearFeedback not found")
source = source.replace(clear_anchor, clear_new, 1)

validation_anchor = '''    if (validation) {
      setError(validation);
      return;
    }
'''
validation_new = '''    if (validation) {
      setError(validation);
      setErrorReference("FORM_VALIDATION");
      setErrorDiagnostic("");
      return;
    }
'''
if validation_anchor not in source:
    raise SystemExit("validation feedback block not found")
source = source.replace(validation_anchor, validation_new, 1)

catch_anchor = '''    } catch (cause) {
      const detail = opsErrorDetail(cause);
      console.error("DAY NIGHT complete order save rejected:", detail || cause);
      setError(professionalEditError(detail, isArabic));
    } finally {
'''
catch_new = '''    } catch (cause) {
      const detail = opsErrorDetail(cause);
      console.error("DAY NIGHT complete order save rejected:", detail || cause);
      setError(professionalEditError(detail, isArabic));
      setErrorReference(editErrorReference(detail));
      setErrorDiagnostic(safeEditDiagnostic(detail));
    } finally {
'''
if catch_anchor not in source:
    raise SystemExit("save catch block not found")
source = source.replace(catch_anchor, catch_new, 1)

old_shell = '''    <div
      className="dn-admin-modal-backdrop"
      role="dialog"
      aria-modal="true"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <form
        className="dn-admin-action-modal flex h-[96dvh] max-h-[96dvh] !max-w-7xl flex-col overflow-hidden"
        onSubmit={save}
      >
        <header className="shrink-0">
          <div>
            <span>
              {isArabic
                ? "محرر الطلب الكامل المُدقّق"
                : "Audited complete order editor"}
            </span>
            <strong>{orderReference(order)}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy || !financials}
              className="!inline-flex !items-center !gap-2 !bg-brand-gold !text-brand-deep disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {busy
                ? isArabic
                  ? "جارٍ الحفظ الذري..."
                  : "Saving atomically..."
                : isArabic
                  ? "حفظ كل التعديلات"
                  : "Save all changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={isArabic ? "إغلاق" : "Close"}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
'''
new_shell = '''    <div
      className="dn-admin-modal-backdrop !bg-[radial-gradient(circle_at_top,rgba(20,91,139,0.22),rgba(1,7,18,0.88)_46%,rgba(0,3,10,0.96))] !p-2 backdrop-blur-md sm:!p-5"
      role="dialog"
      aria-modal="true"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <form
        className="dn-admin-action-modal relative flex h-[95dvh] max-h-[95dvh] !max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-cyan-200/20 !bg-[linear-gradient(155deg,rgba(7,29,54,0.98),rgba(2,16,34,0.99)_52%,rgba(5,25,47,0.98))] shadow-[0_38px_120px_rgba(0,0,0,0.72),0_0_0_1px_rgba(255,255,255,0.03)] ring-1 ring-white/5"
        onSubmit={save}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -start-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-24 top-1/3 h-80 w-80 rounded-full bg-brand-gold/8 blur-3xl"
        />
        <header className="relative z-20 flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#06182d]/82 px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-brand-gold/35 bg-brand-gold/10 text-brand-gold shadow-[0_0_28px_rgba(212,175,55,0.12)]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-brand-gold/75">
                {isArabic ? "تعديل آمن ومُدقّق" : "Secure audited edit"}
              </span>
              <strong className="mt-1 block truncate text-sm font-black text-white sm:text-base" dir="ltr">
                {orderReference(order)}
              </strong>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy || !financials}
              className="!inline-flex !items-center !gap-2 !rounded-2xl !bg-brand-gold !px-4 !py-3 !text-xs !font-black !text-brand-deep shadow-[0_12px_30px_rgba(212,175,55,0.18)] transition hover:!-translate-y-0.5 disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {busy
                ? isArabic
                  ? "جارٍ الحفظ..."
                  : "Saving..."
                : isArabic
                  ? "حفظ التعديلات"
                  : "Save changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={isArabic ? "إغلاق" : "Close"}
              className="!grid !h-11 !w-11 !place-items-center !rounded-2xl !border !border-white/10 !bg-white/5 !p-0 !text-white/70 transition hover:!border-rose-300/30 hover:!bg-rose-400/10 hover:!text-rose-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
'''
if old_shell not in source:
    raise SystemExit("modal shell block not found")
source = source.replace(old_shell, new_shell, 1)

source = source.replace(
'''        <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-4 pt-2 sm:px-2">''',
'''        <div className="relative z-10 min-h-0 flex-1 scroll-smooth overflow-y-auto px-2 pb-5 pt-3 sm:px-5 sm:pt-4">''',
1,
)

old_feedback = '''          {message && (
            <p className="dn-admin-modal-message sticky top-0 z-30">
              <CheckCircle2 className="h-4 w-4" />
              {message}
            </p>
          )}
          {error && (
            <p className="dn-admin-modal-message sticky top-0 z-30 border-rose-400/30 bg-rose-400/10 text-rose-100">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </p>
          )}
'''
new_feedback = '''          {message && (
            <section className="sticky top-0 z-40 mb-4 overflow-hidden rounded-[1.4rem] border border-emerald-300/30 bg-[linear-gradient(135deg,rgba(6,78,59,0.9),rgba(3,35,39,0.96))] p-4 text-emerald-50 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-emerald-200/25 bg-emerald-300/10">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <strong className="block text-sm font-black">
                    {isArabic ? "تم حفظ الطلب بنجاح" : "Order saved successfully"}
                  </strong>
                  <p className="mt-1 text-xs font-bold leading-6 text-emerald-50/85">{message}</p>
                </div>
              </div>
            </section>
          )}
          {error && (
            <section className="sticky top-0 z-40 mb-4 overflow-hidden rounded-[1.4rem] border border-rose-300/35 bg-[linear-gradient(135deg,rgba(88,17,38,0.94),rgba(37,9,25,0.97))] p-4 text-rose-50 shadow-[0_20px_60px_rgba(0,0,0,0.38)] backdrop-blur-xl" data-admin-order-error-card="true">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-rose-200/25 bg-rose-300/10 shadow-[0_0_26px_rgba(251,113,133,0.12)]">
                  <Bug className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm font-black">
                      {isArabic ? "تعذر حفظ تعديلات الطلب" : "Order changes were not saved"}
                    </strong>
                    <code
                      className="rounded-full border border-rose-200/20 bg-black/20 px-3 py-1 text-[10px] font-black tracking-wide text-rose-100"
                      dir="ltr"
                      data-admin-error-reference="true"
                    >
                      {errorReference || "ORDER_SAVE_REJECTED"}
                    </code>
                  </div>
                  <p className="mt-2 text-xs font-bold leading-6 text-rose-50/90">{error}</p>
                </div>
              </div>
              {errorDiagnostic && (
                <details className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <summary className="cursor-pointer text-[11px] font-black text-rose-100/85">
                    {isArabic ? "عرض السبب التشخيصي الدقيق" : "Show exact diagnostic reason"}
                  </summary>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                    <code
                      className="min-w-0 flex-1 break-all rounded-xl border border-white/10 bg-black/30 p-3 text-[10px] font-bold leading-5 text-white/65"
                      dir="ltr"
                    >
                      {errorDiagnostic}
                    </code>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(`${errorReference}: ${errorDiagnostic}`)}
                      className="!inline-flex !items-center !justify-center !gap-2 !rounded-xl !border !border-white/10 !bg-white/5 !px-3 !py-2 !text-[10px] !font-black !text-white/75"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {isArabic ? "نسخ التشخيص" : "Copy diagnostic"}
                    </button>
                  </div>
                </details>
              )}
            </section>
          )}
'''
if old_feedback not in source:
    raise SystemExit("feedback rendering block not found")
source = source.replace(old_feedback, new_feedback, 1)

source = source.replace(
'''        <footer className="sticky bottom-0 z-20 shrink-0 border-t border-white/10 bg-[#06172c]/98 p-4 shadow-[0_-18px_35px_rgba(0,0,0,0.35)] backdrop-blur-xl">''',
'''        <footer className="relative z-20 shrink-0 border-t border-white/10 bg-[linear-gradient(180deg,rgba(5,22,43,0.92),rgba(3,15,31,0.99))] p-4 shadow-[0_-24px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:px-6">''',
1,
)
source = source.replace(
'''                className="!min-w-[220px] !bg-brand-gold !text-brand-deep disabled:opacity-40"''',
'''                className="!min-w-[220px] !rounded-2xl !bg-brand-gold !px-5 !py-3.5 !font-black !text-brand-deep shadow-[0_14px_34px_rgba(212,175,55,0.2)] transition hover:!-translate-y-0.5 disabled:opacity-40"''',
1,
)

TARGET.write_text(source, encoding="utf-8")
print("PASS: polished order edit card and exact diagnostics applied")
