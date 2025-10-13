// src/lib/format.js

function toNumeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Nombre générique
 * formatNumber(1234.56, 1) -> "1 234,6"
 */
export function formatNumber(value, decimals = 0, locale = "fr-FR") {
  const n = toNumeric(value);
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
  } catch {
    // Fallback ultra simple
    return decimals ? n.toFixed(decimals) : String(Math.round(n));
  }
}

/**
 * Devise
 * formatCurrency(1234.5, "EUR") -> "1 234,50 €"
 */
export function formatCurrency(
  value,
  currency = "EUR",
  locale = "fr-FR",
  decimals
) {
  const n = toNumeric(value);
  const opts = {
    style: "currency",
    currency,
  };
  if (typeof decimals === "number") {
    opts.minimumFractionDigits = decimals;
    opts.maximumFractionDigits = decimals;
  }
  try {
    return new Intl.NumberFormat(locale, opts).format(n);
  } catch {
    const d = typeof decimals === "number" ? decimals : 2;
    return `${formatNumber(n, d, locale)} ${currency}`;
  }
}

/**
 * Pourcentage
 * formatPercent(0.123, 1) -> "12,3 %"
 * formatPercent(12, 1) -> "12,0 %" (si déjà en %)
 */
export function formatPercent(value, decimals = 0, locale = "fr-FR") {
  let n = toNumeric(value);
  if (Math.abs(n) <= 1) n *= 100; // suppose fraction
  return `${formatNumber(n, decimals, locale)} %`;
}

/**
 * Notation compacte (K, M…)
 * formatCompact(15300) -> "15 K"
 */
export function formatCompact(value, decimals = 0, locale = "fr-FR") {
  const n = toNumeric(value);
  try {
    return new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    }).format(n);
  } catch {
    return formatNumber(n, decimals, locale);
  }
}

/**
 * Export par défaut compatible :
 * - utilisable comme fonction: default(1234, 0)
 * - ou comme objet: default.number(...)
 */
const defaultFormat = function (value, decimals = 0, locale = "fr-FR") {
  return formatNumber(value, decimals, locale);
};

defaultFormat.number = formatNumber;
defaultFormat.currency = formatCurrency;
defaultFormat.percent = formatPercent;
defaultFormat.compact = formatCompact;

export default defaultFormat;
