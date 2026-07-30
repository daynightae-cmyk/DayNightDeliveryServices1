export const ADMIN_IDENTITY = {
  logoUrl: "https://i.postimg.cc/DZNg8Fsc/cropped-circle-image-(2).png",
  nameAr: "بو خليفة",
  nameEn: "Abu Khalifa",
  roleAr: "المدير العام",
  roleEn: "General Manager",
} as const;

export function adminIdentityName(isArabic: boolean) {
  return isArabic ? ADMIN_IDENTITY.nameAr : ADMIN_IDENTITY.nameEn;
}

export function adminIdentityRole(isArabic: boolean) {
  return isArabic ? ADMIN_IDENTITY.roleAr : ADMIN_IDENTITY.roleEn;
}
