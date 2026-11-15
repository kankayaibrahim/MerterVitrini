const REPEATED_LETTER_REGEX = /(\p{L})\1{4,}/iu;
const CJK_REGEX = /[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;
const POSTAL_CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9\-\s]{0,18}[A-Za-z0-9]$/;
const ASCII_CONSONANT_RUN_REGEX = /[bcdfghjklmnpqrstvwxz]{7,}/i;

function isGibberishAlphaWord(word: string): boolean {
  const parts = word
    .split(/[^\p{L}]+/u)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    const chars = Array.from(part);
    const len = chars.length;
    if (len === 0) continue;
    if (len > 24 && !CJK_REGEX.test(part)) {
      return true;
    }
    if (len >= 12 && ASCII_CONSONANT_RUN_REGEX.test(part)) {
      return true;
    }
    if (len >= 14) {
      const unique = new Set(chars.map((ch) => ch.toLocaleLowerCase()));
      if (unique.size / len < 0.38) {
        return true;
      }
    }
  }
  return false;
}

export function validateHumanPersonNameClient(raw: string, lang = "tr"): string | null {
  const clean = raw.trim();
  const chars = Array.from(clean);
  if (chars.length < 2 || chars.length > 120) {
    return lang === "tr"
      ? "Ad soyad 2 ile 120 karakter arasında olmalıdır."
      : "Name must be between 2 and 120 characters.";
  }

  const letters = chars.filter((ch) => /\p{L}/u.test(ch));
  if (letters.length < 2) {
    return lang === "tr"
      ? "Lütfen geçerli bir ad soyad girin."
      : "Please enter a valid full name.";
  }

  if (REPEATED_LETTER_REGEX.test(clean) || isGibberishAlphaWord(clean)) {
    return lang === "tr"
      ? "Lütfen rastgele karakterler yerine gerçek ad soyad bilgisi girin."
      : "Please enter a realistic name without random or repeated characters.";
  }

  return null;
}

export function validateHumanAddressClient(raw: string, lang = "tr"): string | null {
  const clean = raw.trim();
  if (!clean) {
    return lang === "tr"
      ? "Açık adres alanı zorunludur."
      : "Street address line is required.";
  }

  const chars = Array.from(clean);
  if (chars.length < 10) {
    return lang === "tr"
      ? "Lütfen mahalle, cadde/sokak ve bina no içeren en az 10 karakterlik açık adres girin."
      : "Please enter a complete street address (minimum 10 characters).";
  }

  if (chars.length > 500) {
    return lang === "tr"
      ? "Adres satırı en fazla 500 karakter olabilir."
      : "Address line cannot exceed 500 characters.";
  }

  if (REPEATED_LETTER_REGEX.test(clean)) {
    return lang === "tr"
      ? "Adres alanında anlamsız tekrar eden karakterler kullanılamaz."
      : "Repeated gibberish characters are not allowed in the address.";
  }

  const letters = chars.filter((ch) => /\p{L}/u.test(ch));
  if (letters.length < 4) {
    return lang === "tr"
      ? "Lütfen yalnızca rakam veya sembol yerine anlaşılır bir açık adres girin."
      : "Please include street and neighborhood details using valid letters.";
  }

  const hasCjk = CJK_REGEX.test(clean);
  const uniqueLetters = new Set(letters.map((ch) => ch.toLocaleLowerCase()));
  if (!hasCjk && letters.length >= 8 && uniqueLetters.size < 4) {
    return lang === "tr"
      ? "Lütfen geçerli ve anlaşılır bir açık adres girin."
      : "Please enter a valid, meaningful street address.";
  }

  const tokens = clean.split(/\s+/).filter(Boolean);
  if (!hasCjk && tokens.length < 2) {
    return lang === "tr"
      ? "Lütfen mahalle, sokak ve kapı numarasını boşluklarla ayırarak açıkça yazın."
      : "Please separate street name, neighborhood, and building number clearly with spaces.";
  }

  for (const tok of tokens) {
    if (isGibberishAlphaWord(tok)) {
      return lang === "tr"
        ? "Adres içinde anlamsız veya rastgele karakter dizisi tespit edildi. Lütfen gerçek açık adresinizi girin."
        : "Unrecognizable random text detected in address. Please enter a real street address.";
    }
  }

  return null;
}

export function validatePostalCodeClient(raw: string, lang = "tr"): string | null {
  const clean = raw.trim();
  if (!POSTAL_CODE_REGEX.test(clean)) {
    return lang === "tr"
      ? "Lütfen geçerli bir posta kodu girin."
      : "Please enter a valid postal code.";
  }
  return null;
}
