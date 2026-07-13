export type LocalizedOption = {
  value: string;
  ar: string;
  en: string;
};

export type UaeLocation = LocalizedOption & {
  areas: LocalizedOption[];
};

const otherArea: LocalizedOption = { value: "Other", ar: "منطقة أخرى", en: "Other area" };

export const UAE_LOCATIONS: UaeLocation[] = [
  {
    value: "Abu Dhabi",
    ar: "أبوظبي",
    en: "Abu Dhabi",
    areas: [
      { value: "Mussafah", ar: "مصفح", en: "Mussafah" },
      { value: "Khalifa City", ar: "مدينة خليفة", en: "Khalifa City" },
      { value: "Mohammed Bin Zayed City", ar: "مدينة محمد بن زايد", en: "Mohammed Bin Zayed City" },
      { value: "Baniyas", ar: "بني ياس", en: "Baniyas" },
      { value: "Al Shamkha", ar: "الشامخة", en: "Al Shamkha" },
      { value: "Al Shawamekh", ar: "الشوامخ", en: "Al Shawamekh" },
      { value: "Al Reem Island", ar: "جزيرة الريم", en: "Al Reem Island" },
      { value: "Al Maryah Island", ar: "جزيرة المارية", en: "Al Maryah Island" },
      { value: "Al Khalidiyah", ar: "الخالدية", en: "Al Khalidiyah" },
      { value: "Al Bateen", ar: "البطين", en: "Al Bateen" },
      { value: "Tourist Club Area", ar: "منطقة النادي السياحي", en: "Tourist Club Area" },
      { value: "Yas Island", ar: "جزيرة ياس", en: "Yas Island" },
      { value: "Saadiyat Island", ar: "جزيرة السعديات", en: "Saadiyat Island" },
      { value: "Al Ain", ar: "العين", en: "Al Ain" },
      { value: "Al Dhafra", ar: "الظفرة", en: "Al Dhafra" },
      otherArea,
    ],
  },
  {
    value: "Dubai",
    ar: "دبي",
    en: "Dubai",
    areas: [
      { value: "Deira", ar: "ديرة", en: "Deira" },
      { value: "Bur Dubai", ar: "بر دبي", en: "Bur Dubai" },
      { value: "Downtown Dubai", ar: "وسط مدينة دبي", en: "Downtown Dubai" },
      { value: "Business Bay", ar: "الخليج التجاري", en: "Business Bay" },
      { value: "Jumeirah", ar: "جميرا", en: "Jumeirah" },
      { value: "Dubai Marina", ar: "دبي مارينا", en: "Dubai Marina" },
      { value: "Jumeirah Lake Towers", ar: "أبراج بحيرات جميرا", en: "Jumeirah Lake Towers" },
      { value: "Jumeirah Village Circle", ar: "قرية جميرا الدائرية", en: "Jumeirah Village Circle" },
      { value: "Al Barsha", ar: "البرشاء", en: "Al Barsha" },
      { value: "Al Quoz", ar: "القوز", en: "Al Quoz" },
      { value: "Mirdif", ar: "مردف", en: "Mirdif" },
      { value: "Dubai Silicon Oasis", ar: "واحة دبي للسيليكون", en: "Dubai Silicon Oasis" },
      { value: "International City", ar: "المدينة العالمية", en: "International City" },
      { value: "Dubai Investment Park", ar: "مجمع دبي للاستثمار", en: "Dubai Investment Park" },
      { value: "Dubai South", ar: "دبي الجنوب", en: "Dubai South" },
      { value: "Palm Jumeirah", ar: "نخلة جميرا", en: "Palm Jumeirah" },
      otherArea,
    ],
  },
  {
    value: "Sharjah",
    ar: "الشارقة",
    en: "Sharjah",
    areas: [
      { value: "Al Majaz", ar: "المجاز", en: "Al Majaz" },
      { value: "Al Nahda Sharjah", ar: "النهدة الشارقة", en: "Al Nahda Sharjah" },
      { value: "Al Taawun", ar: "التعاون", en: "Al Taawun" },
      { value: "Muwailih", ar: "مويلح", en: "Muwailih" },
      { value: "Al Khan", ar: "الخان", en: "Al Khan" },
      { value: "Al Qasimia", ar: "القاسمية", en: "Al Qasimia" },
      { value: "Rolla", ar: "الرولة", en: "Rolla" },
      { value: "Sharjah Industrial Area", ar: "الصناعية الشارقة", en: "Sharjah Industrial Area" },
      { value: "University City", ar: "المدينة الجامعية", en: "University City" },
      { value: "Al Rahmaniya", ar: "الرحمانية", en: "Al Rahmaniya" },
      otherArea,
    ],
  },
  {
    value: "Ajman",
    ar: "عجمان",
    en: "Ajman",
    areas: [
      { value: "Al Nuaimiya", ar: "النعيمية", en: "Al Nuaimiya" },
      { value: "Al Rashidiya", ar: "الراشدية", en: "Al Rashidiya" },
      { value: "Al Jurf", ar: "الجرف", en: "Al Jurf" },
      { value: "Al Rawda", ar: "الروضة", en: "Al Rawda" },
      { value: "Al Mowaihat", ar: "المويهات", en: "Al Mowaihat" },
      { value: "Al Hamidiya", ar: "الحميدية", en: "Al Hamidiya" },
      { value: "Al Zahra", ar: "الزهراء", en: "Al Zahra" },
      { value: "Al Bustan", ar: "البستان", en: "Al Bustan" },
      { value: "Al Rumailah", ar: "الرميلة", en: "Al Rumailah" },
      { value: "Ajman Industrial Area", ar: "الصناعية عجمان", en: "Ajman Industrial Area" },
      { value: "Al Helio", ar: "الحليو", en: "Al Helio" },
      { value: "Al Yasmeen", ar: "الياسمين", en: "Al Yasmeen" },
      otherArea,
    ],
  },
  {
    value: "Umm Al Quwain",
    ar: "أم القيوين",
    en: "Umm Al Quwain",
    areas: [
      { value: "Al Salamah", ar: "السلامة", en: "Al Salamah" },
      { value: "Al Rass", ar: "الرأس", en: "Al Rass" },
      { value: "Falaj Al Mualla", ar: "فلج المعلا", en: "Falaj Al Mualla" },
      { value: "Umm Al Thuoob", ar: "أم الثعوب", en: "Umm Al Thuoob" },
      otherArea,
    ],
  },
  {
    value: "Ras Al Khaimah",
    ar: "رأس الخيمة",
    en: "Ras Al Khaimah",
    areas: [
      { value: "Al Nakheel", ar: "النخيل", en: "Al Nakheel" },
      { value: "Al Hamra", ar: "الحمرا", en: "Al Hamra" },
      { value: "Khuzam", ar: "خزام", en: "Khuzam" },
      { value: "Julphar", ar: "جلفار", en: "Julphar" },
      { value: "Al Dhait", ar: "الظيت", en: "Al Dhait" },
      { value: "Mina Al Arab", ar: "ميناء العرب", en: "Mina Al Arab" },
      otherArea,
    ],
  },
  {
    value: "Fujairah",
    ar: "الفجيرة",
    en: "Fujairah",
    areas: [
      { value: "Fujairah City", ar: "مدينة الفجيرة", en: "Fujairah City" },
      { value: "Dibba", ar: "دبا", en: "Dibba" },
      { value: "Khorfakkan", ar: "خورفكان", en: "Khorfakkan" },
      { value: "Kalba", ar: "كلباء", en: "Kalba" },
      { value: "Masafi", ar: "مسافي", en: "Masafi" },
      { value: "Mirbah", ar: "مربح", en: "Mirbah" },
      { value: "Qidfa", ar: "قدفع", en: "Qidfa" },
      otherArea,
    ],
  },
];

export function getLocationLabel(value: string | undefined, isArabic: boolean) {
  const emirate = UAE_LOCATIONS.find((item) => item.value === value);
  if (emirate) return isArabic ? emirate.ar : emirate.en;
  for (const item of UAE_LOCATIONS) {
    const area = item.areas.find((entry) => entry.value === value);
    if (area) return isArabic ? area.ar : area.en;
  }
  return value || "";
}

export function getAreasForEmirate(emirate: string | undefined) {
  return UAE_LOCATIONS.find((item) => item.value === emirate)?.areas || UAE_LOCATIONS[0].areas;
}

export function getDefaultAreaForEmirate(emirate: string | undefined) {
  return getAreasForEmirate(emirate)[0]?.value || "";
}
