import { SupportedSeoLang, normalizeSeoLang } from "@/utils/seoHelpers";

const REPEATED_LETTER_REGEX = /(\p{L})\1{4,}/iu;
const CJK_REGEX = /[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;
const POSTAL_CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9\-\s]{0,18}[A-Za-z0-9]$/;
const ASCII_CONSONANT_RUN_REGEX = /[bcdfghjklmnpqrstvwxz]{7,}/i;

interface AddressValidationCopy {
  readonly nameLength: string;
  readonly nameLetters: string;
  readonly nameGibberish: string;
  readonly addressRequired: string;
  readonly addressMinLength: string;
  readonly addressMaxLength: string;
  readonly addressRepeated: string;
  readonly addressLetters: string;
  readonly addressVariety: string;
  readonly addressTokens: string;
  readonly addressGibberish: string;
  readonly postalInvalid: string;
}

const ADDRESS_VALIDATION_COPY: Record<SupportedSeoLang, AddressValidationCopy> = {
  tr: {
    nameLength: "Ad soyad 2 ile 120 karakter arasında olmalıdır.",
    nameLetters: "Lütfen geçerli bir ad soyad girin.",
    nameGibberish: "Lütfen rastgele karakterler yerine gerçek ad soyad bilgisi girin.",
    addressRequired: "Açık adres alanı zorunludur.",
    addressMinLength:
      "Lütfen mahalle, cadde/sokak ve bina no içeren en az 10 karakterlik açık adres girin.",
    addressMaxLength: "Adres satırı en fazla 500 karakter olabilir.",
    addressRepeated: "Adres alanında anlamsız tekrar eden karakterler kullanılamaz.",
    addressLetters:
      "Lütfen yalnızca rakam veya sembol yerine anlaşılır bir açık adres girin.",
    addressVariety: "Lütfen geçerli ve anlaşılır bir açık adres girin.",
    addressTokens:
      "Lütfen mahalle, sokak ve kapı numarasını boşluklarla ayırarak açıkça yazın.",
    addressGibberish:
      "Adres içinde anlamsız veya rastgele karakter dizisi tespit edildi. Lütfen gerçek açık adresinizi girin.",
    postalInvalid: "Lütfen geçerli bir posta kodu girin.",
  },
  en: {
    nameLength: "Name must be between 2 and 120 characters.",
    nameLetters: "Please enter a valid full name.",
    nameGibberish:
      "Please enter a realistic name without random or repeated characters.",
    addressRequired: "Street address line is required.",
    addressMinLength:
      "Please enter a complete street address (minimum 10 characters).",
    addressMaxLength: "Address line cannot exceed 500 characters.",
    addressRepeated: "Repeated gibberish characters are not allowed in the address.",
    addressLetters: "Please include street and neighborhood details using valid letters.",
    addressVariety: "Please enter a valid, meaningful street address.",
    addressTokens:
      "Please separate street name, neighborhood, and building number clearly with spaces.",
    addressGibberish:
      "Unrecognizable random text detected in address. Please enter a real street address.",
    postalInvalid: "Please enter a valid postal code.",
  },
  ru: {
    nameLength: "Имя и фамилия должны содержать от 2 до 120 символов.",
    nameLetters: "Пожалуйста, введите корректные имя и фамилию.",
    nameGibberish:
      "Пожалуйста, укажите реальные имя и фамилию без случайных символов.",
    addressRequired: "Поле полного адреса обязательно для заполнения.",
    addressMinLength:
      "Укажите полный адрес (улица, дом/офис, минимум 10 символов).",
    addressMaxLength: "Длина строки адреса не должна превышать 500 символов.",
    addressRepeated: "В адресе запрещены повторяющиеся бессмысленные символы.",
    addressLetters: "Укажите улицу и район буквами, а не только цифрами или знаками.",
    addressVariety: "Пожалуйста, введите корректный и понятный адрес.",
    addressTokens:
      "Разделяйте название улицы, района и номер здания пробелами.",
    addressGibberish:
      "В адресе обнаружен случайный набор символов. Введите реальный адрес.",
    postalInvalid: "Пожалуйста, введите корректный почтовый индекс.",
  },
  ar: {
    nameLength: "يجب أن يتراوح الاسم بين 2 و120 حرفاً.",
    nameLetters: "يرجى إدخال اسم كامل صحيح.",
    nameGibberish: "يرجى إدخال اسم حقيقي بدون أحرف عشوائية أو متكررة.",
    addressRequired: "حقل العنوان التفصيلي مطلوب.",
    addressMinLength: "يرجى إدخال عنوان كامل واضح (10 أحرف على الأقل).",
    addressMaxLength: "لا يمكن أن يتجاوز سطر العنوان 500 حرف.",
    addressRepeated: "لا يُسمح بتكرار الأحرف العشوائية في العنوان.",
    addressLetters: "يرجى تضمين تفاصيل الشارع والحي باستخدام أحرف صحيحة.",
    addressVariety: "يرجى إدخال عنوان شارع صالح وواضح.",
    addressTokens: "يرجى الفصل بين اسم الشارع والحي ورقم المبنى بمسافات واضحة.",
    addressGibberish:
      "تم اكتشاف نص عشوائي غير مفهوم في العنوان. يرجى إدخال عنوان حقيقي.",
    postalInvalid: "يرجى إدخال رمز بريدي صحيح.",
  },
  de: {
    nameLength: "Der Name muss zwischen 2 und 120 Zeichen lang sein.",
    nameLetters: "Bitte geben Sie einen gültigen Vor- und Nachnamen ein.",
    nameGibberish:
      "Bitte geben Sie einen realistischen Namen ohne zufällige Zeichenfolgen ein.",
    addressRequired: "Die vollständige Straßenadresse ist erforderlich.",
    addressMinLength:
      "Bitte geben Sie eine vollständige Adresse (mindestens 10 Zeichen) ein.",
    addressMaxLength: "Die Adresszeile darf maximal 500 Zeichen lang sein.",
    addressRepeated: "Sinnlos wiederholte Zeichen sind in der Adresse nicht zulässig.",
    addressLetters:
      "Bitte geben Sie Straße und Ortsteil mit Buchstaben statt nur Zahlen an.",
    addressVariety: "Bitte geben Sie eine gültige, verständliche Adresse ein.",
    addressTokens:
      "Bitte trennen Sie Straßenname, Stadtteil und Hausnummer deutlich durch Leerzeichen.",
    addressGibberish:
      "Unleserliche Zeichenfolge in der Adresse erkannt. Bitte geben Sie eine echte Adresse ein.",
    postalInvalid: "Bitte geben Sie eine gültige Postleitzahl ein.",
  },
  fr: {
    nameLength: "Le nom doit contenir entre 2 et 120 caractères.",
    nameLetters: "Veuillez saisir un nom complet valide.",
    nameGibberish:
      "Veuillez saisir un nom réel sans caractères aléatoires ou répétés.",
    addressRequired: "L'adresse complète est obligatoire.",
    addressMinLength:
      "Veuillez saisir une adresse complète d'au moins 10 caractères.",
    addressMaxLength: "La ligne d'adresse ne peut pas dépasser 500 caractères.",
    addressRepeated: "Les caractères répétés sans sens ne sont pas autorisés.",
    addressLetters:
      "Veuillez inclure la rue et le quartier en lettres plutôt qu'en chiffres seuls.",
    addressVariety: "Veuillez saisir une adresse valide et lisible.",
    addressTokens:
      "Veuillez séparer clairement le nom de rue, le quartier et le numéro par des espaces.",
    addressGibberish:
      "Texte aléatoire détecté dans l'adresse. Veuillez saisir une adresse réelle.",
    postalInvalid: "Veuillez saisir un code postal valide.",
  },
  pl: {
    nameLength: "Imię i nazwisko muszą mieć od 2 do 120 znaków.",
    nameLetters: "Proszę podać poprawne imię i nazwisko.",
    nameGibberish:
      "Proszę podać prawdziwe imię i nazwisko bez przypadkowych znaków.",
    addressRequired: "Pełny adres jest wymagany.",
    addressMinLength:
      "Proszę podać pełny adres (ulica, numer, minimum 10 znaków).",
    addressMaxLength: "Adres nie może przekraczać 500 znaków.",
    addressRepeated: "Powtarzające się losowe znaki w adresie są niedozwolone.",
    addressLetters:
      "Proszę wpisać nazwę ulicy i dzielnicy literami, nie samymi cyframi.",
    addressVariety: "Proszę podać poprawny, czytelny adres.",
    addressTokens:
      "Proszę oddzielić spacjami nazwę ulicy, dzielnicę oraz numer budynku.",
    addressGibberish:
      "Wykryto losowy ciąg znaków w adresie. Wpisz prawdziwy adres.",
    postalInvalid: "Proszę podać poprawny kod pocztowy.",
  },
  bg: {
    nameLength: "Името и фамилията трябва да са между 2 и 120 знака.",
    nameLetters: "Моля, въведете валидно пълно име.",
    nameGibberish:
      "Моля, въведете реално име без случайни или повтарящи се символи.",
    addressRequired: "Полето за пълен адрес е задължително.",
    addressMinLength:
      "Моля, въведете пълен адрес (улица, квартал, номер — минимум 10 знака).",
    addressMaxLength: "Адресът не може да надвишава 500 знака.",
    addressRepeated: "Не се допускат безсмислено повтарящи се символи в адреса.",
    addressLetters:
      "Моля, включете улица и квартал с букви, вместо само цифри или знаци.",
    addressVariety: "Моля, въведете валиден и ясен адрес.",
    addressTokens:
      "Моля, разделете името на улицата, квартала и номера на сградата с интервали.",
    addressGibberish:
      "Открит е произволен набор от знаци в адреса. Въведете реален адрес.",
    postalInvalid: "Моля, въведете валиден пощенски код.",
  },
};

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
  const copy = ADDRESS_VALIDATION_COPY[normalizeSeoLang(lang, "tr")];
  const clean = raw.trim();
  const chars = Array.from(clean);
  if (chars.length < 2 || chars.length > 120) {
    return copy.nameLength;
  }

  const letters = chars.filter((ch) => /\p{L}/u.test(ch));
  if (letters.length < 2) {
    return copy.nameLetters;
  }

  if (REPEATED_LETTER_REGEX.test(clean) || isGibberishAlphaWord(clean)) {
    return copy.nameGibberish;
  }

  return null;
}

export function validateHumanAddressClient(raw: string, lang = "tr"): string | null {
  const copy = ADDRESS_VALIDATION_COPY[normalizeSeoLang(lang, "tr")];
  const clean = raw.trim();
  if (!clean) {
    return copy.addressRequired;
  }

  const chars = Array.from(clean);
  if (chars.length < 10) {
    return copy.addressMinLength;
  }

  if (chars.length > 500) {
    return copy.addressMaxLength;
  }

  if (REPEATED_LETTER_REGEX.test(clean)) {
    return copy.addressRepeated;
  }

  const letters = chars.filter((ch) => /\p{L}/u.test(ch));
  if (letters.length < 4) {
    return copy.addressLetters;
  }

  const hasCjk = CJK_REGEX.test(clean);
  const uniqueLetters = new Set(letters.map((ch) => ch.toLocaleLowerCase()));
  if (!hasCjk && letters.length >= 8 && uniqueLetters.size < 4) {
    return copy.addressVariety;
  }

  const tokens = clean.split(/\s+/).filter(Boolean);
  if (!hasCjk && tokens.length < 2) {
    return copy.addressTokens;
  }

  for (const tok of tokens) {
    if (isGibberishAlphaWord(tok)) {
      return copy.addressGibberish;
    }
  }

  return null;
}

export function validatePostalCodeClient(raw: string, lang = "tr"): string | null {
  const copy = ADDRESS_VALIDATION_COPY[normalizeSeoLang(lang, "tr")];
  const clean = raw.trim();
  if (!POSTAL_CODE_REGEX.test(clean)) {
    return copy.postalInvalid;
  }
  return null;
}
