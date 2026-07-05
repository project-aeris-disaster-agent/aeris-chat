/**
 * Verified Philippine emergency hotline directory.
 *
 * EVERY entry must carry `sources` and `verifiedAsOf`. Numbers come only from
 * official sites or official republications; where aggregators disagreed we
 * kept the format confirmed by the agency's own page (e.g. OCD R7 publishes
 * 7-digit provincial landlines — the 2019 8-digit migration applied to the
 * (02) Metro Manila area code only).
 *
 * DO NOT add numbers from memory. The chat persona is contractually limited
 * to numbers this file injects into its context — an invented digit here
 * ships straight into SOS answers.
 */

export type PhRegionCode =
  | "NCR"
  | "CAR"
  | "I"
  | "II"
  | "III"
  | "IV-A"
  | "IV-B"
  | "V"
  | "VI"
  | "VII"
  | "VIII"
  | "IX"
  | "X"
  | "XI"
  | "XII"
  | "XIII"
  | "NIR"
  | "BARMM";

export type Hotline = {
  org: string;
  numbers: string[];
  scope: "national" | "regional" | "city";
  region?: PhRegionCode;
  city?: string;
  kind: "emergency" | "disaster" | "weather" | "medical" | "traffic";
  notes?: string;
  sources: string[];
  verifiedAsOf: string;
};

const OCD_DIRECTORY_SOURCES = [
  "https://drrnetphils.org/hotlines/ (DRRNet PH hotline directory)",
  "https://ocdr7.wordpress.com/directory/ (OCD R7 official site, confirms 7-digit provincial format)",
];

const EMBASSY_OCD_SOURCE =
  "https://www.philembassy.no/newsroom/office-of-civil-defense-contact-numbers (PH Embassy republication of OCD directory)";

export const PH_HOTLINES: Hotline[] = [
  // ---------- National ----------
  {
    org: "National Emergency Hotline",
    numbers: ["911"],
    scope: "national",
    kind: "emergency",
    notes:
      "Unified nationwide since June 2026: police, fire, medical, and disaster response through one number.",
    sources: [
      "https://pia.gov.ph/news/one-number-for-all-emergencies-unified-911-to-launch-nationwide/",
      "https://e911.gov.ph/",
    ],
    verifiedAsOf: "2026-07",
  },
  {
    org: "Philippine Red Cross",
    numbers: ["143", "(02) 8790-2300"],
    scope: "national",
    kind: "medical",
    notes: "Ambulance, rescue, and welfare assistance, 24/7.",
    sources: ["https://redcross.org.ph/ (official site)"],
    verifiedAsOf: "2026-07",
  },
  {
    org: "NDRRMC Operations Center",
    numbers: [
      "(02) 8911-1406",
      "(02) 8912-2665",
      "(02) 8912-5668",
      "(02) 8911-1873",
    ],
    scope: "national",
    kind: "disaster",
    notes: "Trunk line (02) 8911-5061 to 65.",
    sources: [
      "https://ndrrmc.gov.ph/ (official hotlines page)",
      "https://drrnetphils.org/hotlines/",
    ],
    verifiedAsOf: "2026-07",
  },
  {
    org: "PAGASA (weather)",
    numbers: ["(02) 8284-0800"],
    scope: "national",
    kind: "weather",
    sources: ["https://drrnetphils.org/hotlines/"],
    verifiedAsOf: "2026-07",
  },
  {
    org: "PHIVOLCS (earthquake/volcano)",
    numbers: ["(02) 8426-1468 to 79"],
    scope: "national",
    kind: "disaster",
    sources: ["https://drrnetphils.org/hotlines/"],
    verifiedAsOf: "2026-07",
  },
  {
    org: "Philippine Coast Guard",
    numbers: ["(02) 8527-8481 to 89"],
    scope: "national",
    kind: "emergency",
    sources: ["https://drrnetphils.org/hotlines/"],
    verifiedAsOf: "2026-07",
  },

  // ---------- Regional (OCD regional operations centers) ----------
  {
    org: "MMDA (Metro Manila)",
    numbers: ["136"],
    scope: "regional",
    region: "NCR",
    kind: "traffic",
    notes: "Flood, rescue, and traffic incidents in Metro Manila.",
    sources: ["https://drrnetphils.org/hotlines/"],
    verifiedAsOf: "2026-07",
  },
  {
    org: "OCD NCR",
    numbers: ["(02) 8421-1918", "(02) 8913-2786"],
    scope: "regional",
    region: "NCR",
    kind: "disaster",
    sources: [EMBASSY_OCD_SOURCE],
    verifiedAsOf: "2026-07",
  },
  {
    org: "OCD Cordillera (CAR)",
    numbers: ["(074) 304-2256", "(074) 619-0986", "(074) 444-5298"],
    scope: "regional",
    region: "CAR",
    kind: "disaster",
    sources: OCD_DIRECTORY_SOURCES,
    verifiedAsOf: "2026-07",
  },
  {
    org: "OCD Region I (Ilocos)",
    numbers: ["(072) 607-6528", "(072) 700-4747"],
    scope: "regional",
    region: "I",
    kind: "disaster",
    sources: OCD_DIRECTORY_SOURCES,
    verifiedAsOf: "2026-07",
  },
  {
    org: "OCD Region II (Cagayan Valley)",
    numbers: ["(078) 304-1630", "(078) 304-1631"],
    scope: "regional",
    region: "II",
    kind: "disaster",
    sources: OCD_DIRECTORY_SOURCES,
    verifiedAsOf: "2026-07",
  },
  {
    org: "OCD Region III (Central Luzon)",
    numbers: ["(045) 455-1526", "(045) 455-0033"],
    scope: "regional",
    region: "III",
    kind: "disaster",
    sources: OCD_DIRECTORY_SOURCES,
    verifiedAsOf: "2026-07",
  },
  {
    org: "OCD Region IV-A (CALABARZON)",
    numbers: ["(049) 834-4344", "(049) 531-7266"],
    scope: "regional",
    region: "IV-A",
    kind: "disaster",
    sources: OCD_DIRECTORY_SOURCES,
    verifiedAsOf: "2026-07",
  },
  {
    org: "OCD Region IV-B (MIMAROPA)",
    numbers: ["(043) 723-4248", "(043) 702-9361"],
    scope: "regional",
    region: "IV-B",
    kind: "disaster",
    sources: OCD_DIRECTORY_SOURCES,
    verifiedAsOf: "2026-07",
  },
  {
    org: "OCD Region V (Bicol)",
    numbers: ["(052) 742-1176"],
    scope: "regional",
    region: "V",
    kind: "disaster",
    sources: OCD_DIRECTORY_SOURCES,
    verifiedAsOf: "2026-07",
  },
  {
    org: "OCD Region VI (Western Visayas)",
    numbers: ["(033) 336-9353", "(033) 337-6671", "(033) 509-7319"],
    scope: "regional",
    region: "VI",
    kind: "disaster",
    sources: OCD_DIRECTORY_SOURCES,
    verifiedAsOf: "2026-07",
  },
  {
    org: "OCD Region VII (Central Visayas)",
    numbers: ["(032) 416-5025", "(032) 253-6162", "(032) 253-8730"],
    scope: "regional",
    region: "VII",
    kind: "disaster",
    sources: OCD_DIRECTORY_SOURCES,
    verifiedAsOf: "2026-07",
  },
  {
    org: "OCD Region VIII (Eastern Visayas)",
    numbers: ["+63 917-842-7606 (cell/Viber)"],
    scope: "regional",
    region: "VIII",
    kind: "disaster",
    sources: [EMBASSY_OCD_SOURCE],
    verifiedAsOf: "2026-07",
  },
  {
    org: "OCD Region IX (Zamboanga Peninsula)",
    numbers: ["+63 915-647-8884 (cell/Viber)"],
    scope: "regional",
    region: "IX",
    kind: "disaster",
    sources: [EMBASSY_OCD_SOURCE],
    verifiedAsOf: "2026-07",
  },
  {
    org: "OCD Region X (Northern Mindanao)",
    numbers: ["+63 917-159-4486 (cell/Viber)"],
    scope: "regional",
    region: "X",
    kind: "disaster",
    sources: [EMBASSY_OCD_SOURCE],
    verifiedAsOf: "2026-07",
  },
  {
    org: "OCD Region XI (Davao)",
    numbers: ["+63 917-178-9711 (cell/Viber)"],
    scope: "regional",
    region: "XI",
    kind: "disaster",
    sources: [EMBASSY_OCD_SOURCE],
    verifiedAsOf: "2026-07",
  },
  {
    org: "OCD Region XII (SOCCSKSARGEN)",
    numbers: ["+63 917-770-7771 (cell/Viber)"],
    scope: "regional",
    region: "XII",
    kind: "disaster",
    sources: [EMBASSY_OCD_SOURCE],
    verifiedAsOf: "2026-07",
  },

  // ---------- City (NCR quick access) ----------
  {
    org: "Marikina City Rescue",
    numbers: ["161", "(02) 8646-2436"],
    scope: "city",
    region: "NCR",
    city: "Marikina",
    kind: "emergency",
    sources: [
      "https://www.facebook.com/MarikinaRescue161/ (official page)",
      "https://goldenislandsenorita.net/manila-emergency-hotlines/",
    ],
    verifiedAsOf: "2026-07",
  },
  {
    org: "Quezon City Helpline",
    numbers: ["122", "(02) 8988-4242"],
    scope: "city",
    region: "NCR",
    city: "Quezon City",
    kind: "emergency",
    sources: ["https://quezoncity.gov.ph/ (official site)"],
    verifiedAsOf: "2026-07",
  },
  {
    org: "Pasig City Hotline",
    numbers: ["(02) 8643-0000"],
    scope: "city",
    region: "NCR",
    city: "Pasig",
    kind: "emergency",
    sources: ["https://goldenislandsenorita.net/manila-emergency-hotlines/"],
    verifiedAsOf: "2026-07",
  },
  {
    org: "Makati Rescue",
    numbers: ["168", "(02) 8236-5790"],
    scope: "city",
    region: "NCR",
    city: "Makati",
    kind: "emergency",
    sources: ["https://goldenislandsenorita.net/manila-emergency-hotlines/"],
    verifiedAsOf: "2026-07",
  },
  {
    org: "Manila City Hotline",
    numbers: ["(02) 8527-5174"],
    scope: "city",
    region: "NCR",
    city: "Manila",
    kind: "emergency",
    sources: ["https://goldenislandsenorita.net/manila-emergency-hotlines/"],
    verifiedAsOf: "2026-07",
  },
];

/**
 * Province/area (as used in PH_MAJOR_CITIES `region` field) → administrative
 * region. NIR reflects the Negros Island Region re-established in 2024.
 */
export const PROVINCE_TO_REGION: Record<string, PhRegionCode> = {
  NCR: "NCR",
  Rizal: "IV-A",
  Benguet: "CAR",
  Pampanga: "III",
  Zambales: "III",
  Batangas: "IV-A",
  Quezon: "IV-A",
  Albay: "V",
  "Camarines Sur": "V",
  "Camarines Norte": "V",
  Cagayan: "II",
  "Ilocos Norte": "I",
  "Ilocos Sur": "I",
  Pangasinan: "I",
  "La Union": "I",
  Palawan: "IV-B",
  Iloilo: "VI",
  "Negros Occidental": "NIR",
  Cebu: "VII",
  Leyte: "VIII",
  Samar: "VIII",
  "Eastern Samar": "VIII",
  "Negros Oriental": "NIR",
  Bohol: "VII",
  "Misamis Oriental": "X",
  "Agusan del Norte": "XIII",
  "Surigao del Norte": "XIII",
  "Davao del Sur": "XI",
  "South Cotabato": "XII",
  "Zamboanga del Sur": "IX",
  Maguindanao: "BARMM",
  "Lanao del Norte": "X",
  "Zamboanga del Norte": "IX",
};
