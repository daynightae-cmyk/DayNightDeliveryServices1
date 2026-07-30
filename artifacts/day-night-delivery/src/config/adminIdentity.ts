export const ADMIN_IDENTITY = {
  logoUrl: "https://i.postimg.cc/FHF9HQxq/cropped-circle-image-(1).png",
  nameAr: "منصور علي",
  nameEn: "Mansour Ali",
  roleAr: "المدير العام",
  roleEn: "General Manager",
} as const;

export function adminIdentityName(isArabic: boolean) {
  return isArabic ? ADMIN_IDENTITY.nameAr : ADMIN_IDENTITY.nameEn;
}

export function adminIdentityRole(isArabic: boolean) {
  return isArabic ? ADMIN_IDENTITY.roleAr : ADMIN_IDENTITY.roleEn;
}
