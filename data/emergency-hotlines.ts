export interface EmergencyHotline {
  agency: string;
  hotline: string | null;
  trunkDirectLine: string[];
  area: string;
}

export type HotlineTier = "quick" | "local" | "regional" | "national" | "other";

export type QuickAccessHotlineIcon =
  | "radio"
  | "shield-alert"
  | "flame"
  | "shield"
  | "heart-pulse"
  | "cross";

export interface QuickAccessHotline {
  label: string;
  shortLabel: string;
  number: string;
  icon: QuickAccessHotlineIcon;
}

/** One-tap disaster hotlines for Naga City citizens. */
export const nagaQuickAccessHotlines: QuickAccessHotline[] = [
  {
    label: "Naga City Central Command Center (Comcen)",
    shortLabel: "Comcen",
    number: "0963-220-9700",
    icon: "radio",
  },
  {
    label: "Naga City Disaster Risk Reduction & Management Office (CDRRMO)",
    shortLabel: "CDRRMO",
    number: "0947-633-0066",
    icon: "shield-alert",
  },
  {
    label: "Bureau of Fire Protection (Naga City)",
    shortLabel: "Fire",
    number: "0923-083-9429",
    icon: "flame",
  },
  {
    label: "Naga City Police Office (NCPO)",
    shortLabel: "Police",
    number: "0908-325-4787",
    icon: "shield",
  },
  {
    label: "Bicol Medical Center (BMC) - Emergency",
    shortLabel: "Hospital",
    number: "(054) 472-6125",
    icon: "heart-pulse",
  },
  {
    label: "Philippine Red Cross - Camarines Sur Chapter",
    shortLabel: "Red Cross",
    number: "0951-652-4563",
    icon: "cross",
  },
];

const QUICK_ACCESS_AGENCIES = new Set(
  nagaQuickAccessHotlines.map((entry) => entry.label),
);

const NATIONAL_DISASTER_AGENCIES = new Set([
  "Emergency 911 National Office",
  "National Disaster Risk Reduction Management Council",
  "PAGASA",
  "Philippine Institute of Volcanology and Seismology",
  "Philippine Red Cross",
  "Philippine Coast Guard",
  "Department of Social Welfare and Development",
]);

const TIER_SORT_ORDER: Record<HotlineTier, number> = {
  quick: 0,
  local: 1,
  regional: 2,
  national: 3,
  other: 4,
};

export function getHotlineTier(hotline: EmergencyHotline): HotlineTier {
  if (hotline.area === "NAGA CITY") {
    return QUICK_ACCESS_AGENCIES.has(hotline.agency) ? "quick" : "local";
  }
  if (hotline.area === "R V") return "regional";
  if (NATIONAL_DISASTER_AGENCIES.has(hotline.agency)) return "national";
  return "other";
}

export function isPrimaryDisasterHotline(hotline: EmergencyHotline): boolean {
  return getHotlineTier(hotline) !== "other";
}

export function sortHotlinesForNaga(
  a: EmergencyHotline,
  b: EmergencyHotline,
): number {
  const tierDiff = TIER_SORT_ORDER[getHotlineTier(a)] - TIER_SORT_ORDER[getHotlineTier(b)];
  if (tierDiff !== 0) return tierDiff;
  return a.agency.localeCompare(b.agency);
}

export function getTopLevelArea(area: string): string {
  if (area.startsWith("NCR") || area === "PASAY") return "NCR";
  return area;
}

export type HotlineRegionFilter =
  | "naga-city"
  | "bicol"
  | "manila-hq"
  | "luzon"
  | "visayas"
  | "mindanao"
  | "other";

export const HOTLINE_REGION_FILTERS: { id: HotlineRegionFilter; label: string }[] = [
  { id: "naga-city", label: "Naga City" },
  { id: "bicol", label: "Bicol Region" },
  { id: "manila-hq", label: "Manila" },
  { id: "luzon", label: "Luzon" },
  { id: "visayas", label: "Visayas" },
  { id: "mindanao", label: "Mindanao" },
  { id: "other", label: "Other Regions" },
];

const BICOL_AREAS = new Set(["R V"]);
const VISAYAS_AREAS = new Set(["R VI", "R VII", "R VIII"]);
const MINDANAO_AREAS = new Set([
  "R IX",
  "R X",
  "R XI",
  "R XII",
  "R XIII",
  "BARMM",
  "CARAGA",
]);
const LUZON_AREAS = new Set([
  "R I",
  "R II",
  "R III",
  "R IV-A",
  "R IV-B",
  "CAR",
]);

function isMetroManilaCityArea(area: string): boolean {
  return area.startsWith("NCR -") || area === "PASAY";
}

export function getHotlineRegionFilter(
  hotline: EmergencyHotline,
): HotlineRegionFilter {
  const { area } = hotline;

  if (area === "NAGA CITY") return "naga-city";
  if (BICOL_AREAS.has(area)) return "bicol";
  if (area === "NCR") return "manila-hq";
  if (isMetroManilaCityArea(area)) return "luzon";
  if (VISAYAS_AREAS.has(area)) return "visayas";
  if (MINDANAO_AREAS.has(area)) return "mindanao";
  if (LUZON_AREAS.has(area)) return "luzon";
  return "other";
}

export function matchesHotlineRegionFilter(
  hotline: EmergencyHotline,
  filter: HotlineRegionFilter,
): boolean {
  return getHotlineRegionFilter(hotline) === filter;
}

export const emergencyHotlines: EmergencyHotline[] = [
  // ============================================================
  // NAGA CITY (Camarines Sur, Bicol Region V)
  // Source: City of Naga official Emergency Hotline page
  // (www2.naga.gov.ph/emergency-hotline) — updated Aug 22, 2025
  // ============================================================
  {
    agency: "Naga City Central Command Center (Comcen)",
    hotline: "0963-220-9700",
    trunkDirectLine: [
      "0963-220-9700",
      "0908-525-3000 [Smart]",
      "0908-885-3000",
      "0956-776-3000",
      "(054) 472-3000",
      "(054) 871-2050 local 3000",
      "UHF: 406.3000"
    ],
    area: "NAGA CITY"
  },
  {
    agency: "Naga City Disaster Risk Reduction & Management Office (CDRRMO)",
    hotline: "(054) 205-2980 local 3060",
    trunkDirectLine: [
      "(054) 205-2980 local 3060",
      "0947-633-0066",
      "(054) 871-2050 local 3060 [PLDT]"
    ],
    area: "NAGA CITY"
  },
  {
    agency: "Naga City Police Office (NCPO)",
    hotline: "0908-325-4787",
    trunkDirectLine: [
      "0908-325-4787",
      "0908-737-4228"
    ],
    area: "NAGA CITY"
  },
  {
    agency: "Naga City Police Station 6 (Cararayan)",
    hotline: "0921-475-1636",
    trunkDirectLine: [
      "0921-475-1636"
    ],
    area: "NAGA CITY"
  },
  {
    agency: "Bureau of Fire Protection (Naga City)",
    hotline: "0923-083-9429",
    trunkDirectLine: [
      "0923-083-9429",
      "0920-986-1476"
    ],
    area: "NAGA CITY"
  },
  {
    agency: "Chin Po Tong Volunteer Fire Brigade",
    hotline: "0910-2968-888",
    trunkDirectLine: [
      "0910-2968-888",
      "0956-811-2000"
    ],
    area: "NAGA CITY"
  },
  {
    agency: "Naga White - Filipino-Chinese Volunteer Firefighters",
    hotline: "0917-308-1800",
    trunkDirectLine: [
      "0917-308-1800"
    ],
    area: "NAGA CITY"
  },
  {
    agency: "Bicol Medical Center (BMC) - Emergency",
    hotline: "(054) 472-6125 to 31",
    trunkDirectLine: [
      "(054) 472-6125 to 31"
    ],
    area: "NAGA CITY"
  },
  {
    agency: "NICC Doctors Hospital",
    hotline: "(054) 475-0000",
    trunkDirectLine: [
      "(054) 475-0000",
      "0917-894-1647"
    ],
    area: "NAGA CITY"
  },
  {
    agency: "Dr. Nilo O. Roa Memorial Foundation Hospital (Mother Seton)",
    hotline: "(054) 472-2998",
    trunkDirectLine: [
      "(054) 472-2998"
    ],
    area: "NAGA CITY"
  },
  {
    agency: "St. John Hospital, Inc.",
    hotline: "(054) 472-4521",
    trunkDirectLine: [
      "(054) 472-4521"
    ],
    area: "NAGA CITY"
  },
  {
    agency: "Philippine Red Cross - Camarines Sur Chapter",
    hotline: "143",
    trunkDirectLine: [
      "143 [National Hotline]",
      "0951-652-4563"
    ],
    area: "NAGA CITY"
  },
  {
    agency: "Camarines Sur Electric Cooperative II (CASURECO II)",
    hotline: "(054) 205-2900",
    trunkDirectLine: [
      "(054) 205-2900",
      "0933-868-4763"
    ],
    area: "NAGA CITY"
  },
  {
    agency: "Metro Naga Water District (MNWD)",
    hotline: "(054) 206-3040",
    trunkDirectLine: [
      "(054) 206-3040",
      "0919-648-6365 [Smart]",
      "0967-485-3675 [Globe]",
      "(054) 473-7813 [Trunk]",
      "(054) 472-1685 [Trunk]"
    ],
    area: "NAGA CITY"
  },
  {
    agency: "Naga City General Services Office (Streetlights)",
    hotline: "(054) 205-2980 local 3200",
    trunkDirectLine: [
      "(054) 205-2980 local 3200",
      "0948-108-3489"
    ],
    area: "NAGA CITY"
  },
  // ============================================================
  // BICOL REGION (Region V) — Regional disaster agencies
  // ============================================================
  {
    agency: "Office of Civil Defense - Region V (OCD-V)",
    hotline: "(052) 742-1176",
    trunkDirectLine: [
      "(052) 742-1176",
      "(052) 481-5031",
      "0928-505-3861 [Cell/Viber]"
    ],
    area: "R V"
  },
  {
    agency: "Camarines Sur PDRRMO - EDMERO (24/7)",
    hotline: "0998-576-2071",
    trunkDirectLine: [
      "0998-576-2071",
      "0998-576-2072"
    ],
    area: "R V"
  },
  {
    agency: "Camarines Sur One Hospital Command",
    hotline: "0908-860-6111",
    trunkDirectLine: [
      "0908-860-6111"
    ],
    area: "R V"
  },
  {
    agency: "PAGASA - Southern Luzon Regional Services (Legazpi)",
    hotline: "(052) 481-4454",
    trunkDirectLine: [
      "(052) 481-4454"
    ],
    area: "R V"
  },
  // National Agencies - NCR
  {
    agency: "Emergency 911 National Office",
    hotline: "911",
    trunkDirectLine: [
      "(02) 925-9111",
      "(02) 928-7281 [telefax]",
      "+63966-5000-299 [Globe]",
      "+63932-318-0440 [Smart]"
    ],
    area: "NCR"
  },
  {
    agency: "Bureau of Fire Protection",
    hotline: "(02) 8426-0219 | (02) 8426-0246",
    trunkDirectLine: [
      "(02) 426-0219",
      "(02) 426-3812",
      "(02)426-0246"
    ],
    area: "NCR"
  },
  {
    agency: "Department of Health",
    hotline: "Text: (632) 8651-7800 local 5003-5004",
    trunkDirectLine: [
      "(632) 8651-7800 local 5003-5004"
    ],
    area: "NCR"
  },
  {
    agency: "Department of Public Works and Highways",
    hotline: "165-02",
    trunkDirectLine: [
      "(02) 304-3000",
      "(02) 304-3713",
      "(02) 304-3904",
      "09616847084 [Cellphone/Viber]"
    ],
    area: "NCR"
  },
  {
    agency: "Department of Social Welfare and Development",
    hotline: "(02) 931-81-01",
    trunkDirectLine: [
      "(02) 931-81-01",
      "0918-912-2813 [Text Hotline]",
      "(02) 856-3665",
      "(02) 852-8081"
    ],
    area: "NCR"
  },
  {
    agency: "Department of Transportation",
    hotline: "7890",
    trunkDirectLine: [
      "(02) 8790-8300"
    ],
    area: "NCR"
  },
  {
    agency: "Manila Water",
    hotline: "1627",
    trunkDirectLine: [
      "1627"
    ],
    area: "NCR"
  },
  {
    agency: "Manila International Airport Authority",
    hotline: null,
    trunkDirectLine: [
      "+63917-839-6242",
      "Terminals 1, 2, & 4: +632 877-1109",
      "Terminal 3: +63 2 877-7888"
    ],
    area: "NCR"
  },
  {
    agency: "Metropolitan Manila Development Authority",
    hotline: "136",
    trunkDirectLine: [
      "(02) 8882-4151 to 77"
    ],
    area: "NCR"
  },
  {
    agency: "MERALCO",
    hotline: "16210",
    trunkDirectLine: [
      "16210",
      "(02) 16211"
    ],
    area: "NCR"
  },
  {
    agency: "National Disaster Risk Reduction Management Council",
    hotline: "(02) 8911-5061 to 65 local 100",
    trunkDirectLine: [
      "(02) 911-5061",
      "(02) 911-5062",
      "(02) 911-5063",
      "(02) 911-5064",
      "(02) 911-5065",
      "(02) 911-1406",
      "(02) 911-1873",
      "(02) 912-2665",
      "(02) 912-5668"
    ],
    area: "NCR"
  },
  {
    agency: "PAGASA",
    hotline: "(02) 824-0800",
    trunkDirectLine: [
      "(02) 824-0800"
    ],
    area: "NCR"
  },
  {
    agency: "Philippine Coast Guard",
    hotline: "(02) 8527-8481 to 89 | (02) 8527-3877",
    trunkDirectLine: [
      "(02) 527-8481",
      "(02) 527-8482",
      "(02) 527-8483",
      "(02) 527-8484",
      "(02) 527-8485",
      "(02) 527-8486",
      "(02) 527-8487",
      "(02) 527-8488",
      "(02) 527-8489",
      "(02) 527-3877",
      "0917-724-3682 [Globe]",
      "0918-967-4697 [Smart]"
    ],
    area: "NCR"
  },
  {
    agency: "Philippine National Police",
    hotline: null,
    trunkDirectLine: [
      "(02) 8790-2300",
      "(2) 722-0650",
      "+63917-847-5757"
    ],
    area: "NCR"
  },
  {
    agency: "Philippine Red Cross",
    hotline: "143",
    trunkDirectLine: [
      "(02) 527-0000",
      "(02)8527-8385 to 95",
      "(02) 8790-2300"
    ],
    area: "NCR"
  },
  {
    agency: "Philippine Red Cross - Staff",
    hotline: "134",
    trunkDirectLine: [
      "(02) 527-8386"
    ],
    area: "NCR"
  },
  {
    agency: "Philippine Red Cross - Manager",
    hotline: "132",
    trunkDirectLine: [
      "(02) 527-8387"
    ],
    area: "NCR"
  },
  {
    agency: "Philippine Red Cross - Radio Room",
    hotline: "133",
    trunkDirectLine: [
      "(02) 527-8388",
      "(02) 527-8389",
      "(02) 527-8390",
      "(02) 527-8391",
      "(02) 527-8392",
      "(02) 527-8393",
      "(02) 527-8394",
      "(02) 527-8395",
      "(02) 527-0864 [telefax]"
    ],
    area: "NCR"
  },
  {
    agency: "Philippine Institute of Volcanology and Seismology",
    hotline: null,
    trunkDirectLine: [
      "(02) 426-1468",
      "(02) 426-1469",
      "(02) 426-1470",
      "(02) 426-1471",
      "(02) 426-1472",
      "(02) 426-1473",
      "(02) 426-1474",
      "(02) 426-1475",
      "(02) 426-1476",
      "(02) 426-1477",
      "(02) 426-1478",
      "(02) 426-1479"
    ],
    area: "NCR"
  },
  {
    agency: "Maritime Industry Authority",
    hotline: null,
    trunkDirectLine: [
      "(02) 524-9126",
      "+63917-SUMBONG (7862664)"
    ],
    area: "NCR"
  },
  {
    agency: "Land Transportation Office",
    hotline: "Text LTOHELP to 2600 (All networks)",
    trunkDirectLine: [
      "(02) 922-9061",
      "(02) 922-9062",
      "(02) 922-9063",
      "(02) 922-9064",
      "(02) 922-9065",
      "(02) 922-9066"
    ],
    area: "NCR"
  },
  {
    agency: "Land Transportation Franchising and Regulatory Board",
    hotline: "1342",
    trunkDirectLine: [
      "+63917-550-1342",
      "+63998-550-1342"
    ],
    area: "NCR"
  },
  {
    agency: "Office for Transportation Security",
    hotline: null,
    trunkDirectLine: [
      "(02) 853-5249",
      "+63915-315-5377"
    ],
    area: "NCR"
  },
  {
    agency: "Civil Aviation Authority of the Philippines",
    hotline: null,
    trunkDirectLine: [
      "(02) 879-9112",
      "(02) 879-9110"
    ],
    area: "NCR"
  },
  {
    agency: "Civil Aeronautics Board",
    hotline: null,
    trunkDirectLine: [
      "(02) 542-5234"
    ],
    area: "NCR"
  },
  {
    agency: "North Luzon Expressway",
    hotline: null,
    trunkDirectLine: [
      "(02) 3-500",
      "(02) 580-8900"
    ],
    area: "NCR"
  },
  {
    agency: "South Luzon Expressway",
    hotline: null,
    trunkDirectLine: [
      "(02) 824-2282",
      "(02) 7763909",
      "(02) 584-4389",
      "(049) 508-7539",
      "(049) 502-8956",
      "+63917-687-75390",
      "Customer Assistance (02) 888-8787",
      "+63915-625-6231 [Globe]",
      "+63939-500-6910 [Smart]",
      "+63923-597-6105 [Sun]"
    ],
    area: "NCR"
  },
  {
    agency: "Subic-Clark-Tarlac Expressway",
    hotline: null,
    trunkDirectLine: [
      "(02) 362-2246",
      "(02) 362-9997",
      "0920-96-SCTEX [72839]"
    ],
    area: "NCR"
  },
  {
    agency: "CAVITEX",
    hotline: null,
    trunkDirectLine: [
      "(02) 825-4004",
      "+63942-822-8489"
    ],
    area: "NCR"
  },
  {
    agency: "Skyway System",
    hotline: null,
    trunkDirectLine: [
      "(02) 824-2282",
      "(02) 776-7777",
      "+63917-539-8762 [Globe]",
      "+63999-886-0893 [Smart]",
      "+63932-854-6980 [Sun]"
    ],
    area: "NCR"
  },
  {
    agency: "Philippine National Railways",
    hotline: null,
    trunkDirectLine: [
      "(02) 319-0044"
    ],
    area: "NCR"
  },
  {
    agency: "Light Rail Transit Authority",
    hotline: null,
    trunkDirectLine: [
      "(2) 853-0041 to 60",
      "(2) 647-3479 to 91"
    ],
    area: "NCR - Pasay"
  },
  {
    agency: "Metro Rail Transit (DOTr-MRT3)",
    hotline: null,
    trunkDirectLine: [
      "(02) 920-6683",
      "(02) 924-0054",
      "(02) 929-5347"
    ],
    area: "NCR"
  },
  {
    agency: "Southern TagaloG Arterial Road",
    hotline: null,
    trunkDirectLine: [
      "(043) 756-7870",
      "(043) 757-2277"
    ],
    area: "R IV-B"
  },
  // City-Specific Agencies - NCR
  {
    agency: "Caloocan City (North)",
    hotline: "277-28-85",
    trunkDirectLine: [
      "277-28-85"
    ],
    area: "NCR - Caloocan"
  },
  {
    agency: "Caloocan City (South)",
    hotline: "288-77-17",
    trunkDirectLine: [
      "288-77-17"
    ],
    area: "NCR - Caloocan"
  },
  {
    agency: "Las Piñas Traffic Hotline",
    hotline: null,
    trunkDirectLine: [
      "(02)874-5756",
      "(02)874-3927",
      "(02)874-5754"
    ],
    area: "NCR - Las Piñas"
  },
  {
    agency: "Makati City",
    hotline: "168",
    trunkDirectLine: [
      "168"
    ],
    area: "NCR - Makati"
  },
  {
    agency: "Malabon",
    hotline: "0917-689-8697",
    trunkDirectLine: [
      "0917-689-8697",
      "0225687"
    ],
    area: "NCR - Malabon"
  },
  {
    agency: "Mandaluyong City",
    hotline: "8533-2225",
    trunkDirectLine: [
      "(02)534-2993",
      "(02)533-2225",
      "(02)588-2200",
      "(02)588-2299"
    ],
    area: "NCR - Mandaluyong"
  },
  {
    agency: "Manila City",
    hotline: "927-13-35",
    trunkDirectLine: [
      "927-13-35",
      "978-53-12"
    ],
    area: "NCR - Manila"
  },
  {
    agency: "Manila Traffic Hotline",
    hotline: null,
    trunkDirectLine: [
      "(02)527-3087",
      "(02)527-3088",
      "(02)527-3065"
    ],
    area: "NCR - Manila"
  },
  {
    agency: "Marikina City",
    hotline: "161",
    trunkDirectLine: [
      "(02)646-1631",
      "(02)646-1633"
    ],
    area: "NCR - Marikina"
  },
  {
    agency: "Muntinlupa City",
    hotline: "137-175",
    trunkDirectLine: [
      "137-175"
    ],
    area: "NCR - Muntinlupa"
  },
  {
    agency: "Navotas City",
    hotline: "8281-1111",
    trunkDirectLine: [
      "8281-1111"
    ],
    area: "NCR - Navotas"
  },
  {
    agency: "Parañaque City",
    hotline: "8820-PQUE(7783)",
    trunkDirectLine: [
      "8820-PQUE(7783)"
    ],
    area: "NCR - Parañaque"
  },
  {
    agency: "Pasay City",
    hotline: "888-72729",
    trunkDirectLine: [
      "888-72729"
    ],
    area: "NCR - Pasay"
  },
  {
    agency: "Pasig City",
    hotline: "8643-0000",
    trunkDirectLine: [
      "(02)641-1907",
      "(02)643-0000",
      "(02)643-1111"
    ],
    area: "NCR - Pasig"
  },
  {
    agency: "Pasig Traffic",
    hotline: null,
    trunkDirectLine: [
      "(02)641-1907",
      "(02)643-0000",
      "(02)643-1111"
    ],
    area: "NCR - Pasig"
  },
  {
    agency: "Pateros",
    hotline: "642-51-59",
    trunkDirectLine: [
      "642-51-59"
    ],
    area: "NCR - Pateros"
  },
  {
    agency: "Quezon City",
    hotline: "122",
    trunkDirectLine: [
      "122"
    ],
    area: "NCR - Quezon City"
  },
  {
    agency: "San Juan City",
    hotline: "137-135",
    trunkDirectLine: [
      "137-135"
    ],
    area: "NCR - San Juan"
  },
  {
    agency: "Taguig City",
    hotline: "(02) 8789-3200",
    trunkDirectLine: [
      "(02) 8789-3200"
    ],
    area: "NCR - Taguig"
  },
  {
    agency: "Valenzuela City",
    hotline: "8352-2000",
    trunkDirectLine: [
      "8352-2000"
    ],
    area: "NCR - Valenzuela"
  },
  // Regional Agencies
  {
    agency: "Clark International Airport Corporation",
    hotline: null,
    trunkDirectLine: [
      "(045) 499-1468"
    ],
    area: "R III"
  },
  {
    agency: "Mactan-Cebu International Airport Authority",
    hotline: null,
    trunkDirectLine: [
      "(032) 340-2486 local 1560"
    ],
    area: "R VII"
  }
];

/**
 * Normalizes a phone number for tel: link usage
 * Removes formatting characters and ensures proper format for dialing
 */
export function normalizePhoneNumber(phone: string): string {
  // Handle special cases that shouldn't be dialed
  if (phone.toLowerCase().includes('text') || 
      phone.toLowerCase().includes('telefax') ||
      phone.toLowerCase().includes('fax')) {
    return '';
  }
  
  // Remove brackets and text inside them (like [Globe], [Smart], etc.)
  let normalized = phone.replace(/\[.*?\]/g, '').trim();
  
  // Handle descriptive text before numbers (like "Terminals 1,2, and 4:")
  const colonIndex = normalized.indexOf(':');
  if (colonIndex > 0) {
    normalized = normalized.substring(colonIndex + 1).trim();
  }
  
  // Handle "Customer Assistance" or other text prefixes
  if (normalized.toLowerCase().includes('customer assistance')) {
    const match = normalized.match(/\((\d+)\)/);
    if (match) {
      normalized = match[1];
    } else {
      normalized = normalized.replace(/[^\d+]/g, '');
    }
  }
  
  // Handle special cases with Local extensions
  if (normalized.includes('Local') || normalized.includes('local')) {
    // Extract just the main number before "Local"
    normalized = normalized.split(/Local|local/i)[0].trim();
  }
  
  // Handle alphanumeric numbers (like SCTEX, SUMBONG)
  if (normalized.includes('SCTEX') || normalized.includes('SUM')) {
    // Extract numeric part from parentheses if available
    const match = normalized.match(/\((\d+)\)/);
    if (match) {
      normalized = match[1];
    } else {
      // Try to extract numbers from brackets
      const bracketMatch = normalized.match(/\[(\d+)\]/);
      if (bracketMatch) {
        normalized = bracketMatch[1];
      } else {
        // Try to extract all numbers
        const numbers = normalized.match(/\d+/g);
        if (numbers && numbers.length > 0) {
          normalized = numbers.join('');
        } else {
          return '';
        }
      }
    }
  }
  
  // Handle ranges (like "853-0041 to 60")
  if (normalized.includes('to')) {
    normalized = normalized.split('to')[0].trim();
  }
  
  // Remove common formatting characters
  normalized = normalized.replace(/[\s\-\(\)]/g, '');
  
  // If starts with +63, keep it (international format)
  if (normalized.startsWith('+63')) {
    return normalized;
  }
  
  // If starts with 63 (without +), add +
  if (normalized.startsWith('63') && normalized.length > 2) {
    return '+' + normalized;
  }
  
  // If starts with 0, replace with +63
  if (normalized.startsWith('0')) {
    return '+63' + normalized.substring(1);
  }
  
  // If starts with 02 (area code), convert to +632
  if (normalized.startsWith('02')) {
    return '+632' + normalized.substring(2);
  }
  
  // Handle other area codes (like 032, 043, 045, 049)
  const areaCodeMatch = normalized.match(/^(\d{2,3})(\d{7,8})$/);
  if (areaCodeMatch) {
    const areaCode = areaCodeMatch[1];
    const number = areaCodeMatch[2];
    return '+63' + areaCode + number;
  }
  
  // If it's a short number (like 911, 143, 161), return as is
  if (normalized.length <= 4 && /^\d+$/.test(normalized)) {
    return normalized;
  }
  
  // Default: if it's all digits, try to format it
  if (/^\d+$/.test(normalized)) {
    // If it looks like a mobile number (10 digits starting with 9)
    if (normalized.length === 10 && normalized.startsWith('9')) {
      return '+63' + normalized;
    }
    // If it looks like a landline (7-8 digits)
    if (normalized.length >= 7 && normalized.length <= 8) {
      return '+632' + normalized; // Default to NCR area code
    }
  }
  
  return normalized;
}
