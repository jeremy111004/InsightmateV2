// src/lib/eco.js

// -----------------------------
// Constantes & facteurs
// -----------------------------

/**
 * Facteurs "pédago" (ordres de grandeur) pour l'UI
 * - sectorKgPerEUR : intensité (kgCO2e / € de CA) par secteur
 * - shippingKgPerOrder : expédition/emballage moyen par commande (kgCO2e)
 * - electricityKgPerKWh : intensité électricité FR
 * - dieselKgPerL : facteur diesel (kgCO2e / L)
 */
export const ECO_FACTORS = {
  sectorKgPerEUR: {
    ecommerce: 0.6,
    cafe: 0.35,
    saas: 0.05,
  },
  shippingKgPerOrder: 0.9,
  electricityKgPerKWh: 0.056,
  dieselKgPerL: 2.68,
};

/**
 * Hypothèses €→physique (prix moyens)
 * - elecEURperkWh : €/kWh TTC (ordre de grandeur)
 * - dieselEURperL : €/L
 */
export const ECO_DEFAULTS = {
  elecEURperkWh: 0.20,
  dieselEURperL: 1.85,
};

/**
 * Facteurs EEIO fallback (kgCO2e / €) quand on n'a pas de mesure physique
 */
export const EEIO_FALLBACK_KG_PER_EUR = {
  packaging: 1.2,
  logistics: 0.6,
  electricity: 0.06,
  fuel: 3.0,
  hosting: 0.04,
  misc: 0.3,
};

/**
 * Règles heuristiques pour classer une transaction bancaire (libellé)
 */
export const TX_RULES = [
  { when: /edf|engie|enedis|électri|electric/i, tag: "electricity", basis: "exact" },
  { when: /gazole|gasoil|diesel|station|esso|total|shell|avia|bp/i, tag: "fuel", basis: "exact" },
  { when: /la\s*poste|colissimo|chronopost|dpd|ups|dhl|gls|mondial\s*relay|shipping|colis/i, tag: "logistics", basis: "inferred" },
  { when: /carton|packaging|emballage|mailers|boîtes|palettes/i, tag: "packaging", basis: "inferred" },
  { when: /ovh|scaleway|aws|gcp|azure|ionos|ovhcloud|hetzner/i, tag: "hosting", basis: "inferred" },
];

// -----------------------------
// Utils
// -----------------------------
function asNumber(v, def = 0) {
  if (v == null || v === "") return def;
  if (typeof v === "number") return Number.isFinite(v) ? v : def;
  const n = Number(String(v).replace?.(",", "."));
  return Number.isFinite(n) ? n : def;
}

function toDateKeySafe(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sumByTag(items) {
  return (items || []).reduce((acc, x) => {
    const tag = x?.tag || "misc";
    acc[tag] = (acc[tag] || 0) + asNumber(x?.kg, 0);
    return acc;
  }, {});
}

// -----------------------------
// Classification transactions
// -----------------------------

/**
 * Classe une transaction bancaire en catégorie carbone + estimation kgCO2e
 * @param {string} label  - libellé/description (lowercase conseillé)
 * @param {number} amountEUR - montant (positif = dépense)
 * @returns {{ tag: string, basis: "exact"|"inferred"|"proxy", kg: number, conf: number }}
 */
export function classifyTx(label, amountEUR) {
  const amt = asNumber(amountEUR, 0);
  const lbl = String(label || "");

  const rule = TX_RULES.find((r) => r.when.test(lbl));
  if (!rule) {
    return {
      tag: "misc",
      basis: "proxy",
      kg: amt * (EEIO_FALLBACK_KG_PER_EUR.misc || 0.3),
      conf: 0.4,
    };
  }

  // "exact" energy/fuel: convertir € -> unité physique -> kg
  if (rule.tag === "electricity") {
    const kWh = amt / (ECO_DEFAULTS.elecEURperkWh || 0.2);
    return {
      tag: "electricity",
      basis: "exact",
      kg: kWh * ECO_FACTORS.electricityKgPerKWh,
      conf: 0.9,
    };
  }

  if (rule.tag === "fuel") {
    const liters = amt / (ECO_DEFAULTS.dieselEURperL || 1.85);
    return {
      tag: "fuel",
      basis: "exact",
      kg: liters * ECO_FACTORS.dieselKgPerL,
      conf: 0.9,
    };
  }

  // inferred (logistics/packaging/hosting) via EEIO €/kg
  const kgPerEUR = EEIO_FALLBACK_KG_PER_EUR[rule.tag] ?? EEIO_FALLBACK_KG_PER_EUR.misc;
  const conf = rule.basis === "inferred" ? 0.7 : 0.5;
  return { tag: rule.tag, basis: rule.basis, kg: amt * kgPerEUR, conf };
}

// -----------------------------
// Estimateur à partir du relevé bancaire
// -----------------------------

/**
 * Estime le CO2e depuis des transactions bancaires.
 * @param {Array<{date:string, outflow?:number, debit?:number, description?:string, category?:string}>} bankingRows
 * @param {string} [sinceISO] - ignore les lignes antérieures (YYYY-MM-DD)
 * @returns {{ items:Array, totalKg:number, byTag:Record<string,number>, confidence:number }}
 */
export function estimateCO2eFromBankTx(bankingRows = [], sinceISO) {
  const items = [];
  const sinceKey = sinceISO ? toDateKeySafe(sinceISO) : null;

  for (const r of bankingRows || []) {
    const date = toDateKeySafe(r.date);
    if (!date || (sinceKey && date < sinceKey)) continue;

    // On ne mesure que les sorties (dépenses)
    const out = asNumber(r.outflow ?? r.debit, 0);
    if (!(out > 0)) continue;

    const label = `${r.description || ""} ${r.category || ""}`.trim().toLowerCase();
    const est = classifyTx(label, out);
    items.push({ date, amount: out, label, ...est });
  }

  // Agrégats
  const byTag = sumByTag(items);
  const totalKg = items.reduce((s, x) => s + asNumber(x.kg, 0), 0);
  const avgConf = items.length
    ? Math.round((items.reduce((s, x) => s + asNumber(x.conf, 0), 0) / items.length) * 100)
    : 0;

  return { items, totalKg, byTag, confidence: avgConf };
}

// -----------------------------
// KPI / Notation
// -----------------------------

/**
 * Retourne l’intensité carbone (kgCO2e / € de CA) et sa source
 * - measured: on a totalKg & last30Revenue
 * - sector: on utilise la médiane sectorielle
 * - none: pas de donnée
 */
export function computeIntensity({ totalKg, last30Revenue, sectorMedian }) {
  const kg = asNumber(totalKg, NaN);
  const rev = asNumber(last30Revenue, NaN);

  if (Number.isFinite(kg) && kg > 0 && Number.isFinite(rev) && rev > 0) {
    return { value: kg / rev, source: "measured" };
  }
  if (Number.isFinite(sectorMedian) && sectorMedian > 0) {
    return { value: sectorMedian, source: "sector" };
  }
  return { value: NaN, source: "none" };
}

/**
 * Donne une note (A..E) en fonction de l’intensité
 */
export function ecoGradeFromIntensity(kgPerEUR) {
  const v = asNumber(kgPerEUR, NaN);
  if (!Number.isFinite(v)) return { grade: "—", color: "bg-gray-200 text-gray-800" };
  if (v < 0.2)  return { grade: "A", color: "bg-emerald-600 text-white" };
  if (v < 0.5)  return { grade: "B", color: "bg-green-600 text-white" };
  if (v < 1.0)  return { grade: "C", color: "bg-amber-600 text-white" };
  if (v < 1.5)  return { grade: "D", color: "bg-orange-600 text-white" };
  return { grade: "E", color: "bg-rose-600 text-white" };
}
// --- eco.js — ajout MINIMAL pour débloquer la build ---
/**
 * Agrège des transactions bancaires en métriques éco basiques.
 * @param {Array<{amount:number, description?:string, category?:string}>} transactions
 * @returns {{ energy_kwh:number, fuel_l:number, km:number, co2_kg:number, notes:string[] }}
 */
export function ecoExtractFromBank(transactions = []) {
  // Implémentation ultra-sûre par défaut (demo) — à raffiner plus tard
  let energy_kwh = 0;
  let fuel_l = 0;
  let km = 0;
  const notes = [];

  for (const t of transactions) {
    const d = (t?.description || t?.category || "").toLowerCase();

    // Heuristiques simples de démo (tu ajusteras selon ton mapping réel)
    if (d.includes("edf") || d.includes("electricité") || d.includes("electricidad")) {
      // approx: 1€ ~ 4 kWh (placeholder DEMO)
      energy_kwh += Math.max(0, Number(t.amount)) * 4;
    }
    if (d.includes("total") || d.includes("repsol") || d.includes("cepsa") || d.includes("station")) {
      // approx: 1€ ~ 0.6 L (placeholder DEMO)
      fuel_l += Math.max(0, Number(t.amount)) * 0.6;
    }
    if (d.includes("uber") || d.includes("taxi") || d.includes("blablacar") || d.includes("peaje")) {
      // approx: 1€ ~ 2 km (placeholder DEMO)
      km += Math.max(0, Number(t.amount)) * 2;
    }
  }

  // Facteurs d’émission très conservateurs (placeholders) — change avec tes vrais facteurs
  const CO2_PER_KWH = 0.25;   // kg CO2e / kWh (mix moyen UE ~ démo)
  const CO2_PER_L   = 2.31;   // kg CO2e / L essence
  const CO2_PER_KM  = 0.12;   // kg CO2e / km voiture moyenne

  const co2_kg = energy_kwh * CO2_PER_KWH + fuel_l * CO2_PER_L + km * CO2_PER_KM;

  return { energy_kwh, fuel_l, km, co2_kg, notes };
}

// -----------------------------
// Export par défaut
// -----------------------------
export default {
  ECO_FACTORS,
  ECO_DEFAULTS,
  EEIO_FALLBACK_KG_PER_EUR,
  TX_RULES,
  classifyTx,
  estimateCO2eFromBankTx,
  computeIntensity,
  ecoGradeFromIntensity,
};
