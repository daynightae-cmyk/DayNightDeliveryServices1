import { UAE_LOCATIONS, type LocalizedOption, type UaeLocation } from "./uaeLocations";

/**
 * DAY NIGHT operational delivery coverage for Al Ain.
 *
 * The backend historically stored Al Ain as an area under Abu Dhabi. Admin order
 * entry needs Al Ain to behave like a top-level emirate selector while keeping
 * the existing database value `Al Ain`, so pricing and saved orders remain
 * backwards compatible.
 */
export const AL_AIN_ORDER_AREAS: LocalizedOption[] = [
  { value: "Al Ain Central District", ar: "وسط مدينة العين", en: "Al Ain Central District" },
  { value: "Al Jimi", ar: "الجيمي", en: "Al Jimi" },
  { value: "Al Mutaredh", ar: "المطارد", en: "Al Mutaredh" },
  { value: "Al Muwaiji", ar: "المويجعي", en: "Al Muwaiji" },
  { value: "Al Hili", ar: "الهيلي", en: "Al Hili" },
  { value: "Al Foah", ar: "الفوعة", en: "Al Foah" },
  { value: "Al Towayya", ar: "الطوية", en: "Al Towayya" },
  { value: "Al Khabisi", ar: "الخبيصي", en: "Al Khabisi" },
  { value: "Al Markhaniya", ar: "المرخانية", en: "Al Markhaniya" },
  { value: "Al Qattara", ar: "القطارة", en: "Al Qattara" },
  { value: "Al Jahili", ar: "الجاهلي", en: "Al Jahili" },
  { value: "Al Sarooj", ar: "الصاروج", en: "Al Sarooj" },
  { value: "Al Kuwaitat", ar: "الكويتات", en: "Al Kuwaitat" },
  { value: "Al Niyadat", ar: "النيادات", en: "Al Niyadat" },
  { value: "Al Manaseer Al Ain", ar: "المناصير - العين", en: "Al Manaseer Al Ain" },
  { value: "Al Khalidiyah Al Ain", ar: "الخالدية - العين", en: "Al Khalidiyah Al Ain" },
  { value: "Al Bateen Al Ain", ar: "البطين - العين", en: "Al Bateen Al Ain" },
  { value: "Al Maqam", ar: "المقام", en: "Al Maqam" },
  { value: "Asharej", ar: "عشارج", en: "Asharej" },
  { value: "Falaj Hazza", ar: "فلج هزاع", en: "Falaj Hazza" },
  { value: "Zakher", ar: "زاخر", en: "Zakher" },
  { value: "Al Dhahir", ar: "الظاهر", en: "Al Dhahir" },
  { value: "Al Agabiyya", ar: "العقابية", en: "Al Agabiyya" },
  { value: "Al Masoudi", ar: "المسعودي", en: "Al Masoudi" },
  { value: "Al Muraijeb", ar: "المريجب", en: "Al Muraijeb" },
  { value: "Al Rawdah Al Ain", ar: "الروضة - العين", en: "Al Rawdah Al Ain" },
  { value: "Al Shuaibah", ar: "الشعيبة", en: "Al Shuaibah" },
  { value: "Al Noud", ar: "النود", en: "Al Noud" },
  { value: "Al Mutawaa", ar: "المطوع", en: "Al Mutawaa" },
  { value: "Neima", ar: "نعمة", en: "Neima" },
  { value: "Al Ain Industrial Area", ar: "العين الصناعية", en: "Al Ain Industrial Area" },
  { value: "Sanaiya Al Ain", ar: "الصناعية - العين", en: "Sanaiya Al Ain" },
  { value: "Al Ain Airport Area", ar: "منطقة مطار العين", en: "Al Ain Airport Area" },
  { value: "Al Ain Oasis", ar: "واحة العين", en: "Al Ain Oasis" },
  { value: "Jebel Hafeet", ar: "جبل حفيت", en: "Jebel Hafeet" },
  { value: "Green Mubazzarah", ar: "مبزرة الخضراء", en: "Green Mubazzarah" },
  { value: "Ain Al Fayda", ar: "عين الفايضة", en: "Ain Al Fayda" },
  { value: "Al Kharair", ar: "الخراير", en: "Al Kharair" },
  { value: "Al Amerah Al Ain", ar: "العامرة - العين", en: "Al Amerah Al Ain" },
  { value: "Al Saad", ar: "الساد", en: "Al Saad" },
  { value: "Al Yahar", ar: "اليحر", en: "Al Yahar" },
  { value: "Al Salamat", ar: "السلامات", en: "Al Salamat" },
  { value: "Mezyad", ar: "مزيد", en: "Mezyad" },
  { value: "Um Ghafa", ar: "أم غافة", en: "Um Ghafa" },
  { value: "Al Khaznah", ar: "الخزنة", en: "Al Khaznah" },
  { value: "Remah", ar: "رماح", en: "Remah" },
  { value: "Sweihan", ar: "سويحان", en: "Sweihan" },
  { value: "Nahil", ar: "ناهل", en: "Nahil" },
  { value: "Al Hayer", ar: "الهير", en: "Al Hayer" },
  { value: "Al Faqa", ar: "الفقع", en: "Al Faqa" },
  { value: "Al Shiwayb", ar: "الشويب", en: "Al Shiwayb" },
  { value: "Al Wagan", ar: "الوقن", en: "Al Wagan" },
  { value: "Al Qua'a", ar: "القوع", en: "Al Qua'a" },
  { value: "Other Al Ain Area", ar: "منطقة أخرى في العين", en: "Other Al Ain area" },
];

const AL_AIN_LOCATION: UaeLocation = {
  value: "Al Ain",
  ar: "العين",
  en: "Al Ain",
  areas: AL_AIN_ORDER_AREAS,
};

function mergeAreas(current: LocalizedOption[], incoming: LocalizedOption[]) {
  const byValue = new Map(current.map((area) => [area.value, area]));
  incoming.forEach((area) => byValue.set(area.value, area));
  return Array.from(byValue.values());
}

/**
 * Installs the standalone Al Ain selector before the application mounts.
 * It is idempotent, so React StrictMode, hot reload, and native shells cannot
 * create duplicate selector entries.
 */
export function installAlAinLocationOptions() {
  const abuDhabiIndex = UAE_LOCATIONS.findIndex((location) => location.value === "Abu Dhabi");
  const alAinIndex = UAE_LOCATIONS.findIndex((location) => location.value === "Al Ain");

  if (abuDhabiIndex >= 0) {
    UAE_LOCATIONS[abuDhabiIndex] = {
      ...UAE_LOCATIONS[abuDhabiIndex],
      areas: UAE_LOCATIONS[abuDhabiIndex].areas.filter((area) => area.value !== "Al Ain"),
    };
  }

  if (alAinIndex >= 0) {
    UAE_LOCATIONS[alAinIndex] = {
      ...UAE_LOCATIONS[alAinIndex],
      ...AL_AIN_LOCATION,
      areas: mergeAreas(UAE_LOCATIONS[alAinIndex].areas, AL_AIN_ORDER_AREAS),
    };
    return;
  }

  const insertAt = abuDhabiIndex >= 0 ? abuDhabiIndex + 1 : 0;
  UAE_LOCATIONS.splice(insertAt, 0, AL_AIN_LOCATION);
}
