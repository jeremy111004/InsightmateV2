// src/lib/detectKind.js

/**
 * Normalise un objet "row" en un Set de colonnes (lowercase)
 */
function colsOf(row) {
  const out = new Set();
  if (!row || typeof row !== "object") return out;
  for (const k of Object.keys(row)) {
    out.add(String(k).toLowerCase());
  }
  return out;
}

/**
 * Calcule un score par "kind" en fonction de la présence de colonnes typiques.
 * Plus le score est élevé, plus la probabilité est forte.
 */
function scoreRowKind(cols) {
  let sales = 0;
  let payments = 0;
  let banking = 0;

  // SALES (ventes / commandes)
  const salesHints = [
    "product", "sku", "item", "order_id", "orderid", "customer_id", "client",
    "qty", "quantity", "price", "unit_price", "amount", "revenue", "total",
  ];
  for (const h of salesHints) if (cols.has(h)) sales += 1;
  // combos fréquents
  if ((cols.has("product") || cols.has("sku") || cols.has("item")) && (cols.has("qty") || cols.has("quantity"))) sales += 2;
  if ((cols.has("price") || cols.has("unit_price")) && (cols.has("qty") || cols.has("quantity"))) sales += 2;

  // PAYMENTS (Stripe/PayPal)
  const payHints = [
    "gross", "fee", "net", "payout", "balance_transaction",
    "payment_intent", "charge", "refund", "currency", "method",
  ];
  for (const h of payHints) if (cols.has(h)) payments += 1;
  // combos typiques Stripe
  if (cols.has("gross") && cols.has("net")) payments += 2;
  if (cols.has("fee") && (cols.has("gross") || cols.has("net"))) payments += 2;
  if (cols.has("balance_transaction") || cols.has("payment_intent")) payments += 2;

  // BANKING (relevés bancaires)
  const bankHints = [
    "inflow", "outflow", "credit", "debit", "amount", "balance",
    "iban", "bic", "category", "description", "label",
  ];
  for (const h of bankHints) if (cols.has(h)) banking += 1;
  // combos typiques relevé
  if ((cols.has("inflow") || cols.has("credit")) && (cols.has("outflow") || cols.has("debit"))) banking += 2;
  if (cols.has("amount") && (cols.has("category") || cols.has("description") || cols.has("label"))) banking += 2;

  return { sales, payments, banking };
}

/**
 * Détecte le "kind" de dataset parmi "sales" | "payments" | "banking".
 * @param {Array<object>} rows
 * @returns {"sales"|"payments"|"banking"}
 */
export function detectDatasetKind(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return "sales"; // fallback utile pour démo

  // Échantillonne jusqu'à 20 lignes (ou toutes si < 20)
  const sampleCount = Math.min(20, rows.length);
  let agg = { sales: 0, payments: 0, banking: 0 };

  for (let i = 0; i < sampleCount; i++) {
    const cols = colsOf(rows[i]);
    const s = scoreRowKind(cols);
    agg.sales += s.sales;
    agg.payments += s.payments;
    agg.banking += s.banking;
  }

  // Choisit le score max
  const entries = Object.entries(agg).sort((a, b) => b[1] - a[1]);
  const best = entries[0]; // [kind, score]

  // En cas d'égalité parfaite, privilégie "sales" puis "banking"
  if (entries.length > 1 && best[1] === entries[1][1]) {
    if (best[0] !== "sales" && entries[1][0] === "sales") return "sales";
    if (best[0] !== "banking" && entries[1][0] === "banking") return "banking";
  }

  return (best && best[0]) || "sales";
}

/**
 * Détecte à partir d'un tableau de noms de colonnes (strings)
 */
export function detectDatasetKindFromHeaders(headers = []) {
  const cols = new Set((headers || []).map((h) => String(h).toLowerCase()));
  const s = scoreRowKind(cols);
  const arr = Object.entries(s).sort((a, b) => b[1] - a[1]);
  return (arr[0] && arr[0][0]) || "sales";
}

export default { detectDatasetKind, detectDatasetKindFromHeaders };
