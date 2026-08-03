from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def patch(path: str, old: str, new: str, label: str, count: int = 1) -> None:
    target = ROOT / path
    source = target.read_text(encoding="utf-8")
    found = source.count(old)
    if found < count:
        raise SystemExit(f"{label}: expected at least {count}, found {found}")
    target.write_text(source.replace(old, new, count), encoding="utf-8")


patch(
    "artifacts/day-night-delivery/src/components/AdminPanelLuxury.tsx",
    'bodyAr: `يوجد COD معلق بقيمة ${money(Number(financeSummary.cod_pending || 0), false)}.`,',
    'bodyAr: `يوجد تحصيل معلق بقيمة ${money(Number(financeSummary.cod_pending || 0), true)}.`,',
    "Arabic pending collection notification",
)

patch(
    "artifacts/day-night-delivery/src/components/admin/AdminNewOrderComplete.tsx",
    'className={`mt-1 block text-lg font-black ${accent ? "text-brand-gold" : "text-white"}`} dir="ltr">',
    'className={`mt-1 block text-lg font-black ${accent ? "text-brand-gold" : "text-white"}`} dir={isArabic ? "rtl" : "ltr"}>',
    "new-order money direction",
)

patch(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '<b className="mt-1 block text-sm" dir="ltr">',
    '<b className="mt-1 block text-sm" dir={isArabic ? "rtl" : "ltr"}>',
    "edit metric money direction",
)
patch(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderEditModalComplete.tsx",
    '''                    dir="ltr"
                  >
                    {formatAdminMoney(activeDeliveryFee, isArabic)}''',
    '''                    dir={isArabic ? "rtl" : "ltr"}
                  >
                    {formatAdminMoney(activeDeliveryFee, isArabic)}''',
    "edit delivery money direction",
)

patch(
    "artifacts/day-night-delivery/src/components/admin/AdminOrderBulkOperations.tsx",
    '<td dir="ltr">${escapeHtml(formatAdminMoney(order.cod_amount, isArabic))}</td>',
    '<td dir="${isArabic ? "rtl" : "ltr"}">${escapeHtml(formatAdminMoney(order.cod_amount, isArabic))}</td>',
    "printed COD money direction",
)

print("PASS: Arabic currency text and direction are professionally aligned")
