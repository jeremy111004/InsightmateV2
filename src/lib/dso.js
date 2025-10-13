// src/lib/dso.js
// Calculs autour des factures: parsing CSV, aging, DSO, risques.

import { parseCSVText } from "./csv";
import { toDateKey } from "./date";

/** Parse texte CSV -> lignes "factures" normalisées */
export function parseInvoicesCsv(text) {
  const rows = parseCSVText(text); // [{...}]
  // mapping & normalisation
  const out = rows
    .map((r) => {
      const invoice_id = String(r.invoice_id ?? r.invoiceid ?? r.id ?? "").trim();
      const client = String(r.client ?? r.customer ?? r.account ?? "").trim();
      const email = String(r.email ?? "").trim();
      const phone = String(r.phone ?? "").trim();
      const issue_date = r.issue_date ? toDateKey(r.issue_date) : ""; // "YYYY-MM-DD"
      const due_date = r.due_date ? toDateKey(r.due_date) : "";
      const paid_date = r.paid_date ? toDateKey(r.paid_date) : "";
      const amount = toNumberSafe(r.amount, 0);
      const currency = String(r.currency ?? "EUR").trim().toUpperCase();
      const status = String(r.status ?? "ISSUED").trim().toUpperCase(); // ISSUED|PAID|CANCELED...
      const stripe_url = String(r.stripe_url ?? r.url ?? "").trim();

      return {
        invoice_id,
        client,
        email,
        phone,
        issue_date: issue_date || null,
        due_date: due_date || null,
        amount,
        currency,
        status,
        paid_date: paid_date || null,
        stripe_url,
      };
    })
    // filtre: id, due_date, montant > 0
    .filter((x) => !!x.invoice_id && !!x.due_date && Number(x.amount) > 0);

  return out;
}

function toNumberSafe(v, def = 0) {
  if (v == null || v === "") return def;
  if (typeof v === "number") return Number.isFinite(v) ? v : def;
  const n = Number(String(v).replace?.(",", "."));
  return Number.isFinite(n) ? n : def;
}

/** Différence entière en jours: b - a */
export function daysBetween(a, b) {
  const da = toDate(a);
  const db = toDate(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 0;
  const MS = 24 * 60 * 60 * 1000;
  const la = new Date(da.getFullYear(), da.getMonth(), da.getDate());
  const lb = new Date(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.floor((lb.getTime() - la.getTime()) / MS);
}

function toDate(d) {
  if (!d) return new Date(NaN);
  if (d instanceof Date) return new Date(d);
  // support "YYYY-MM-DD"
  return new Date(d);
}

export function bucketLabel(d) {
  if (d <= 0) return "À échéance/À venir";
  if (d <= 15) return "1–15 j";
  if (d <= 30) return "16–30 j";
  if (d <= 60) return "31–60 j";
  return "61+ j";
}

/**
 * Calcule l'aging à la date asOf.
 * @param {Array<{due_date:string|Date, amount:number, status:string}>} invoices
 * @param {string|Date} asOf
 * @returns {{ buckets: Record<string,number>, overdueTotal:number, open:Array }}
 */
export function computeAging(invoices = [], asOf = new Date()) {
  const buckets = {
    "À échéance/À venir": 0,
    "1–15 j": 0,
    "16–30 j": 0,
    "31–60 j": 0,
    "61+ j": 0,
  };
  let overdueTotal = 0;

  const asOfD = toDate(asOf);

  // factures "ouvertes" uniquement
  const open = (invoices || []).filter(
    (v) => String(v.status).toUpperCase() !== "PAID" && String(v.status).toUpperCase() !== "CANCELED"
  );

  const enriched = open.map((v) => {
    const due = toDate(v.due_date || v.issue_date);
    const d = Math.max(0, daysBetween(due, asOfD));
    const past = d > 0;

    if (past) overdueTotal += toNumberSafe(v.amount, 0);
    buckets[bucketLabel(d)] += toNumberSafe(v.amount, 0);

    return { ...v, days_past_due: d, past_due: past };
  });

  // arrondis propres
  for (const k of Object.keys(buckets)) {
    buckets[k] = Math.round(buckets[k]);
  }
  overdueTotal = Math.round(overdueTotal);

  return { buckets, overdueTotal, open: enriched };
}

/** Score de risque simple basé sur retard & montant (0..100) */
export function riskScore(inv) {
  const d = toNumberSafe(inv?.days_past_due, 0);
  const amt = toNumberSafe(inv?.amount, 0);

  const base = 40;
  const byDays = Math.min(40, d * 0.8);
  const byAmt = Math.min(20, amt / 200);
  return Math.round(Math.max(0, Math.min(100, base + byDays + byAmt)));
}

/**
 * DSO (Days Sales Outstanding) moyen pondéré sur les factures ouvertes.
 * @param {Array} invoices
 * @param {string|Date} asOf
 * @returns {number} jours
 */
export function computeDSO(invoices = [], asOf = new Date()) {
  const asOfD = toDate(asOf);
  const open = (invoices || []).filter(
    (v) => String(v.status).toUpperCase() !== "PAID" && String(v.status).toUpperCase() !== "CANCELED"
  );
  if (!open.length) return 0;

  let sumWA = 0;
  let sumAmt = 0;

  for (const v of open) {
    const issue = v.issue_date ? toDate(v.issue_date) : toDate(v.due_date);
    const age = Math.max(0, daysBetween(issue, asOfD));
    const amt = toNumberSafe(v.amount, 0);
    sumWA += age * amt;
    sumAmt += amt;
  }
  if (sumAmt <= 0) return 0;
  return Math.round(sumWA / sumAmt);
}

/**
 * Montant "récupérable" à 7 jours selon un mix heuristique.
 * @param {Record<string,number>} agingBuckets
 */
export function computeRecoverable7d(agingBuckets = {}) {
  const mix = {
    "À échéance/À venir": 0.2,
    "1–15 j": 0.7,
    "16–30 j": 0.5,
    "31–60 j": 0.3,
    "61+ j": 0.15,
  };
  let total = 0;
  for (const k of Object.keys(mix)) {
    total += toNumberSafe(agingBuckets[k], 0) * mix[k];
  }
  return Math.round(total);
}

export default {
  parseInvoicesCsv,
  daysBetween,
  bucketLabel,
  computeAging,
  computeDSO,
  computeRecoverable7d,
  riskScore,
};
