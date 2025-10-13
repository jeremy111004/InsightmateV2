// src/lib/pricingGuardrails.js

// ————————————————— Config par défaut (alignée avec PricingOptimizer.jsx) ————————————————
export const PRICING_CFG = {
  // Garde-fous génériques
  minMarginPct: 0.10,      // floor marge: 10%
  maxChangePct: 0.10,      // cap variation ±10% par défaut (non-KVI)
  kviMaxUpPct: 0.04,       // cap de hausse spécifique KVI
  step: 0.01,              // pas d’arrondi avant charm (.01 = centime)
  charm: true,             // activer l’arrondi psychologique .99

  // Logiques complémentaires (optionnel)
  stockBias: {             // non utilisé par applyGuardrails ici, mais dispo
    over: -0.03,
    under: 0.03,
  },
  defaultElasticityByCategory: {
    cafe: -0.9,
    the: -1.2,
    accessoires: -0.6,
    autre: -0.8,
  },
};

// ————————————————— Utils —————————————————
const toNum = (v, d = 0) => {
  if (v == null || v === "") return d;
  const n = typeof v === "number" ? v : Number(String(v).replace?.(",", "."));
  return Number.isFinite(n) ? n : d;
};

// 0.2 -> 20  |  20 -> 20
function pctTo100(x) {
  const n = toNum(x, NaN);
  if (!Number.isFinite(n)) return NaN;
  return n <= 1 ? n * 100 : n;
}

const clamp = (x, a, b) => Math.min(Math.max(x, a), b);

// ————————————————— Charm pricing —————————————————
/**
 * Arrondi psychologique à .99
 * - si PRICING_CFG.charm = false, renvoie un arrondi 2 décimales standard
 * - évite de casser un prix déjà “propre” (si très proche du .99)
 */
export function charm99(p) {
  const price = Math.max(0, toNum(p, 0));
  if (!PRICING_CFG.charm) return Number(price.toFixed(2));
  const base = Math.floor(price);
  const near99 = base + 0.99;
  if (price < near99 && near99 - price < 0.02) {
    return Number(price.toFixed(2));
  }
  return Number((base + 0.99).toFixed(2));
}

// ————————————————— Heuristique de “markdown” —————————————————
/**
 * Si surstock + délai long -> autorise une baisse plus large
 * Retourne un biais (0..0.15) qui sera ajouté à la latitude de baisse.
 */
export function markdownBias({
  stock_on_hand = null,
  last_90d_qty = null,
  lead_time_days = null,
}) {
  const stock = toNum(stock_on_hand, 0);
  const q90 = toNum(last_90d_qty, 0);
  const lead = Math.max(0, toNum(lead_time_days, 0));
  if (!(stock > 0 && q90 > 0)) return 0;
  const daily = q90 / 90;
  if (daily <= 0) return 0;
  const coverDays = stock / daily;

  if (coverDays > 60 && lead > 14) return 0.15;
  if (coverDays > 45) return 0.08;
  if (coverDays > 30) return 0.04;
  return 0;
}

// ————————————————— Garde-fous —————————————————
/**
 * Applique les garde-fous sur un prix théorique.
 * @param {number} Pstar  Prix “théorique” (ex: Lerner)
 * @param {object} opts
 *  - P0, cost, isKVI
 *  - step, maxChangePct, kviMaxUpPct, minMarginPct, charm
 *  - markdownContext: { stock_on_hand, last_90d_qty, lead_time_days }
 * @returns {number} prix final arrondi
 */
export function applyGuardrails(Pstar, opts = {}) {
  const {
    P0,
    cost = 0,
    isKVI = false,
    // overrides ou défaut PRICING_CFG
    step = PRICING_CFG.step,
    maxChangePct = PRICING_CFG.maxChangePct,
    kviMaxUpPct = PRICING_CFG.kviMaxUpPct,
    minMarginPct = PRICING_CFG.minMarginPct,
    charm = PRICING_CFG.charm,
    markdownContext = null,
  } = opts;

  const base = Math.max(0.01, toNum(P0, 0.01));
  const c = Math.max(0, toNum(cost, 0));
  let p = Math.max(toNum(Pstar, base), c); // jamais sous le coût

  // 1) Borne variation vs P0
  const upPct = isKVI ? pctTo100(kviMaxUpPct) : pctTo100(maxChangePct);
  const downPct = pctTo100(maxChangePct);
  const bias = markdownContext ? markdownBias(markdownContext) : 0; // ex: +0.15
  const downPctWithBias = pctTo100(downPct / 100 + bias); // on ajoute le biais à la latitude de baisse

  const upLimit = base * (1 + (Number.isFinite(upPct) ? upPct : 0) / 100);
  const downLimit =
    base * (1 - (Number.isFinite(downPctWithBias) ? downPctWithBias : 0) / 100);
  p = clamp(p, downLimit, upLimit);

  // 2) Marge minimale (ex: 10 %)
  const minMargin100 = pctTo100(minMarginPct);
  if (Number.isFinite(minMargin100) && minMargin100 > 0 && minMargin100 < 100) {
    const minPforMargin = c / (1 - minMargin100 / 100);
    p = Math.max(p, minPforMargin);
  }

  // 3) Arrondi au pas
  const st = Math.max(0.01, toNum(step, 0.01));
  p = Math.round(p / st) * st;

  // 4) Charm pricing optionnel
  if (charm) p = charm99(p);

  return Number(p.toFixed(2));
}

export default {
  PRICING_CFG,
  charm99,
  markdownBias,
  applyGuardrails,
};
