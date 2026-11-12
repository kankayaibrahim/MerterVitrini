export interface CountryDialOption {
  readonly iso: string;
  readonly dial: string;
  readonly label: string;
}

export const COUNTRY_DIAL_CODES: readonly CountryDialOption[] = [
  { iso: "TR", dial: "+90", label: "TR (+90)" },
  { iso: "RU", dial: "+7", label: "RU (+7)" },
  { iso: "DE", dial: "+49", label: "DE (+49)" },
  { iso: "FR", dial: "+33", label: "FR (+33)" },
  { iso: "PL", dial: "+48", label: "PL (+48)" },
  { iso: "BG", dial: "+359", label: "BG (+359)" },
  { iso: "GB", dial: "+44", label: "GB (+44)" },
  { iso: "US", dial: "+1", label: "US (+1)" },
  { iso: "SA", dial: "+966", label: "SA (+966)" },
  { iso: "AE", dial: "+971", label: "AE (+971)" },
  { iso: "IQ", dial: "+964", label: "IQ (+964)" },
  { iso: "KW", dial: "+965", label: "KW (+965)" },
  { iso: "QA", dial: "+974", label: "QA (+974)" },
  { iso: "EG", dial: "+20", label: "EG (+20)" },
  { iso: "MA", dial: "+212", label: "MA (+212)" },
  { iso: "DZ", dial: "+213", label: "DZ (+213)" },
  { iso: "TN", dial: "+216", label: "TN (+216)" },
  { iso: "LY", dial: "+218", label: "LY (+218)" },
  { iso: "JO", dial: "+962", label: "JO (+962)" },
  { iso: "LB", dial: "+961", label: "LB (+961)" },
  { iso: "IR", dial: "+98", label: "IR (+98)" },
  { iso: "AZ", dial: "+994", label: "AZ (+994)" },
  { iso: "UZ", dial: "+998", label: "UZ (+998)" },
  { iso: "KZ", dial: "+7", label: "KZ (+7)" },
  { iso: "UA", dial: "+380", label: "UA (+380)" },
  { iso: "RO", dial: "+40", label: "RO (+40)" },
  { iso: "MD", dial: "+373", label: "MD (+373)" },
  { iso: "LT", dial: "+370", label: "LT (+370)" },
  { iso: "NL", dial: "+31", label: "NL (+31)" },
  { iso: "BE", dial: "+32", label: "BE (+32)" },
  { iso: "IT", dial: "+39", label: "IT (+39)" },
  { iso: "ES", dial: "+34", label: "ES (+34)" },
  { iso: "GR", dial: "+30", label: "GR (+30)" },
  { iso: "RS", dial: "+381", label: "RS (+381)" },
  { iso: "BA", dial: "+387", label: "BA (+387)" },
  { iso: "AL", dial: "+355", label: "AL (+355)" },
  { iso: "MK", dial: "+389", label: "MK (+389)" },
  { iso: "XK", dial: "+383", label: "XK (+383)" },
  { iso: "GE", dial: "+995", label: "GE (+995)" },
  { iso: "KE", dial: "+254", label: "KE (+254)" },
  { iso: "NG", dial: "+234", label: "NG (+234)" },
  { iso: "CI", dial: "+225", label: "CI (+225)" },
  { iso: "SN", dial: "+221", label: "SN (+221)" },
  { iso: "ZA", dial: "+27", label: "ZA (+27)" },
] as const;

const LANG_DEFAULT_ISO: Readonly<Record<string, string>> = {
  tr: "TR",
  ru: "RU",
  de: "DE",
  fr: "FR",
  pl: "PL",
  bg: "BG",
  ar: "SA",
  en: "GB",
};

const DIAL_PLACEHOLDERS: Readonly<Record<string, string>> = {
  "+90": "5XX XXX XX XX",
  "+7": "9XX XXX XX XX",
  "+49": "17X XXXXXXX",
  "+33": "6 XX XX XX XX",
  "+48": "5XX XXX XXX",
  "+359": "88 XXX XXXX",
  "+44": "7XXX XXXXXX",
  "+1": "2XX XXX XXXX",
  "+966": "5X XXX XXXX",
};

const PAIRED_TEST_TAILS_6 = new Set<string>([
  "112233",
  "223344",
  "334455",
  "445566",
  "556677",
  "667788",
  "778899",
  "001122",
  "998877",
  "654321",
  "123123",
  "321321",
  "000111",
  "111000",
]);

const PAIRED_TEST_TAILS_7 = new Set<string>([
  "1112233",
  "1234123",
  "1231231",
  "0000111",
  "1111000",
]);

const TURKISH_MOBILE_SECOND_DIGITS = new Set(["0", "1", "3", "4", "5", "6"]);
const TURKISH_GEO_FIRST_DIGITS = new Set(["2", "3", "4", "8"]);

export function getDefaultCountryIsoForLang(lang: string): string {
  const key = (lang || "tr").trim().toLowerCase();
  return LANG_DEFAULT_ISO[key] || "TR";
}

export function getDialCodeByIso(iso: string): string {
  const found = COUNTRY_DIAL_CODES.find((item) => item.iso === iso);
  return found ? found.dial : "+90";
}

export function getDefaultDialCodeForLang(lang: string): string {
  return getDialCodeByIso(getDefaultCountryIsoForLang(lang));
}

export function getLocalPhonePlaceholder(dialCode: string): string {
  return DIAL_PLACEHOLDERS[dialCode] || "5XX XXX XXXX";
}

export function combineDialCodeAndLocalPhone(dialCode: string, rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    return trimmed;
  }
  if (/[^0-9+\s().-]/.test(trimmed) || trimmed.indexOf("+") > 0) {
    return trimmed;
  }

  let localDigits = trimmed.replace(/\D/g, "");
  const dialDigits = dialCode.replace(/\D/g, "");
  if (!dialDigits) {
    return trimmed;
  }
  if (localDigits.startsWith(dialDigits) && localDigits.length >= dialDigits.length + 9) {
    return `+${localDigits}`;
  }
  if (localDigits.startsWith("0")) {
    localDigits = localDigits.slice(1);
  }
  return `+${dialDigits}${localDigits}`;
}

function extractCleanPhoneParts(raw: string): { digits: string; hasPlus: boolean } | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    const isDigit = ch >= "0" && ch <= "9";
    const isLeadingPlus = ch === "+" && i === 0;
    const isSeparator = ch === " " || ch === "-" || ch === "(" || ch === ")" || ch === ".";
    if (!isDigit && !isLeadingPlus && !isSeparator) {
      return null;
    }
  }

  let hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");

  if (!hasPlus && digits.startsWith("00")) {
    if (digits.length < 11 || digits.startsWith("000")) {
      return null;
    }
    digits = digits.slice(2);
    hasPlus = true;
  }

  if (hasPlus && (digits.length === 0 || digits[0] === "0")) {
    return null;
  }

  return { digits, hasPlus };
}

function isTurkishPhonePattern(digits: string, hasPlus: boolean): boolean {
  if (hasPlus && digits.startsWith("90")) {
    return true;
  }
  if (!hasPlus && digits.length === 12 && digits.startsWith("905")) {
    return true;
  }
  return !hasPlus && digits.length === 11 && digits.startsWith("05");
}

function validateTurkishNational(nat: string): boolean {
  if (nat.length !== 10) {
    return false;
  }
  if (nat[0] === "5") {
    if (!TURKISH_MOBILE_SECOND_DIGITS.has(nat[1])) {
      return false;
    }
    const prefix3 = nat.slice(0, 3);
    return prefix3 !== "500" && prefix3 !== "550";
  }
  if (!TURKISH_GEO_FIRST_DIGITS.has(nat[0])) {
    return false;
  }
  return nat.slice(0, 3) !== "800";
}

function normalizeStructuralPhone(
  digits: string,
  hasPlus: boolean
): { normalized: string; checkDigits: string } | null {
  if (isTurkishPhonePattern(digits, hasPlus)) {
    let nat =
      (hasPlus && digits.startsWith("90")) || (!hasPlus && digits.startsWith("905"))
        ? digits.slice(2)
        : digits.slice(1);
    if (nat.length === 11 && nat.startsWith("0")) {
      nat = nat.slice(1);
    }
    if (!validateTurkishNational(nat)) {
      return null;
    }
    return { normalized: `+90${nat}`, checkDigits: `90${nat}` };
  }

  if (hasPlus) {
    if (digits.length < 10 || digits.length > 15 || digits[0] < "1" || digits[0] > "9") {
      return null;
    }
    return { normalized: `+${digits}`, checkDigits: digits };
  }

  if (digits.length < 9 || digits.length > 13) {
    return null;
  }
  if (digits.length === 9 && (digits[0] < "4" || digits[0] > "9")) {
    return null;
  }
  if (digits[0] === "0" && (digits.length < 10 || digits.length > 12 || digits[1] === "0")) {
    return null;
  }

  return { normalized: digits, checkDigits: digits };
}

function countDistinctDigits(s: string): number {
  return new Set(s.split("")).size;
}

function hasExcessiveConsecutiveRepeat(s: string, maxAllowed: number): boolean {
  let run = 1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] === s[i - 1]) {
      run++;
      if (run > maxAllowed) {
        return true;
      }
    } else {
      run = 1;
    }
  }
  return false;
}

function hasSequentialRun(s: string, minRun: number): boolean {
  if (s.length < minRun) {
    return false;
  }
  let ascRun = 1;
  let descRun = 1;
  for (let i = 1; i < s.length; i++) {
    const diff = s.charCodeAt(i) - s.charCodeAt(i - 1);
    if (diff === 1) {
      ascRun++;
      descRun = 1;
    } else if (diff === -1) {
      descRun++;
      ascRun = 1;
    } else {
      ascRun = 1;
      descRun = 1;
    }
    if (ascRun >= minRun || descRun >= minRun) {
      return true;
    }
  }
  return false;
}

function validatePhoneRealism(digits: string): boolean {
  if (digits.length < 9) {
    return false;
  }
  if (hasExcessiveConsecutiveRepeat(digits, 4)) {
    return false;
  }
  if (countDistinctDigits(digits) < 3) {
    return false;
  }
  const last7 = digits.slice(-7);
  if (countDistinctDigits(last7) < 3) {
    return false;
  }
  const tail8 = digits.length > 8 ? digits.slice(-8) : digits;
  if (hasSequentialRun(tail8, 6)) {
    return false;
  }
  const last6 = digits.slice(-6);
  if (PAIRED_TEST_TAILS_6.has(last6) || PAIRED_TEST_TAILS_7.has(last7)) {
    return false;
  }
  return true;
}

export function validateAndNormalizeRealisticPhone(raw: string): {
  valid: boolean;
  normalized: string;
} {
  const parts = extractCleanPhoneParts(raw);
  if (!parts) {
    return { valid: false, normalized: "" };
  }
  const structural = normalizeStructuralPhone(parts.digits, parts.hasPlus);
  if (!structural) {
    return { valid: false, normalized: "" };
  }
  if (!validatePhoneRealism(structural.checkDigits)) {
    return { valid: false, normalized: "" };
  }
  return { valid: true, normalized: structural.normalized };
}

export function isRealisticPhoneNumber(raw: unknown): boolean {
  if (typeof raw !== "string") {
    return false;
  }
  return validateAndNormalizeRealisticPhone(raw).valid;
}

