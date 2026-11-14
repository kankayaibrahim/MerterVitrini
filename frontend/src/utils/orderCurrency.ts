export interface OrderCurrencyCarrier {
  readonly total_amount: number;
  readonly currency?: string | null;
  readonly customer_currency?: string | null;
  readonly customer_total_amount?: number | null;
  readonly total_amount_try?: number | null;
  readonly currency_totals?: Readonly<Record<string, number>> | null;
}

const CURRENCY_SORT_PRIORITY: Readonly<Record<string, number>> = {
  USD: 1,
  EUR: 2,
  GBP: 3,
  RUB: 4,
  TRY: 5,
};

export function normalizeCurrencyCode(raw?: string | null): string {
  const cleaned = (raw ?? "").trim().toUpperCase();
  if (!cleaned || cleaned === "TL" || cleaned === "₺" || cleaned === "TRY") {
    return "TRY";
  }
  if (cleaned === "$" || cleaned === "USD") {
    return "USD";
  }
  if (cleaned === "€" || cleaned === "EUR") {
    return "EUR";
  }
  if (cleaned === "£" || cleaned === "GBP") {
    return "GBP";
  }
  if (cleaned === "₽" || cleaned === "RUB") {
    return "RUB";
  }
  return cleaned.length > 3 ? cleaned.slice(0, 3) : cleaned;
}

export function formatCurrencyAmount(
  amount: number,
  currency?: string | null,
  locale = "tr-TR"
): string {
  const code = normalizeCurrencyCode(currency);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    return `${safeAmount.toFixed(2)} ${code}`;
  }
}

export function getNormalizedCurrencyTotals(
  order: OrderCurrencyCarrier
): Record<string, number> {
  const raw = order.currency_totals;
  if (raw && typeof raw === "object") {
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        continue;
      }
      const code = normalizeCurrencyCode(key);
      out[code] = (out[code] ?? 0) + value;
    }
    if (Object.keys(out).length > 0) {
      return out;
    }
  }
  return {
    [normalizeCurrencyCode(order.currency)]: Number.isFinite(order.total_amount)
      ? order.total_amount
      : 0,
  };
}

export function sortCurrencyCodes(codes: readonly string[]): string[] {
  return [...codes].sort((a, b) => {
    const pa = CURRENCY_SORT_PRIORITY[a] ?? 99;
    const pb = CURRENCY_SORT_PRIORITY[b] ?? 99;
    if (pa !== pb) {
      return pa - pb;
    }
    return a.localeCompare(b);
  });
}

export function hasMultipleCurrencies(order: OrderCurrencyCarrier): boolean {
  return Object.keys(getNormalizedCurrencyTotals(order)).length > 1;
}

export function formatOrderPrimaryTotal(
  order: OrderCurrencyCarrier,
  locale = "tr-TR"
): string {
  const totals = getNormalizedCurrencyTotals(order);
  const codes = sortCurrencyCodes(Object.keys(totals));
  if (codes.length === 0) {
    return formatCurrencyAmount(order.total_amount, order.currency, locale);
  }
  return codes
    .map((code) => formatCurrencyAmount(totals[code] ?? 0, code, locale))
    .join(" + ");
}

export function shouldShowTryEquivalent(order: OrderCurrencyCarrier): boolean {
  const tryTotal = order.total_amount_try ?? 0;
  if (!Number.isFinite(tryTotal) || tryTotal <= 0) {
    return false;
  }
  return (
    hasMultipleCurrencies(order) ||
    normalizeCurrencyCode(order.currency) !== "TRY"
  );
}
