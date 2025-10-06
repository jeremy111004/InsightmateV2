// src/data/samples.js

// ===== Utils =====
export function seededRand(seed = 1337) {
  // LCG basique, déterministe
  let s = seed >>> 0;
  return function rnd() {
    // constants from Numerical Recipes
    s = (1664525 * s + 1013904223) >>> 0;
    return (s & 0xffffffff) / 0x100000000;
  };
}

function toISO(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function addDays(iso, n) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function toCSV(rows, headers) {
  if (!Array.isArray(rows) || !rows.length) return "";
  const cols =
    headers && headers.length
      ? headers
      : Array.from(
          rows.reduce((set, r) => {
            Object.keys(r || {}).forEach((k) => set.add(k));
            return set;
          }, new Set())
        );

  const esc = (v) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
  const lines = [cols.join(",")];
  for (const r of rows) {
    lines.push(cols.map((c) => esc(r?.[c])).join(","));
  }
  return lines.join("\n");
}

// ===== SALES (ventes) =====
export function buildSampleSales({
  start = "2025-07-01",
  days = 45,
  baseDaily = 42,
  growth = 0.004, // ~0.4%/jour
  customersCap = 420,
  seed = 1337,
} = {}) {
  const rnd = seededRand(seed);

  // Profil hebdo (dim..sam)
  const weekMul = [0.82, 0.98, 1.05, 1.1, 1.12, 1.25, 0.88];

  const products = [
    { name: "Espresso", price: 2.4, p: 0.22 },
    { name: "Café", price: 3.2, p: 0.18 },
    { name: "Latte", price: 4.6, p: 0.16 },
    { name: "Croissant", price: 2.3, p: 0.17 },
    { name: "Sandwich", price: 6.9, p: 0.15 },
    { name: "Cookie", price: 1.9, p: 0.07 },
    { name: "Thé", price: 2.1, p: 0.05 },
  ];

  // cumul pour tirage pondéré
  const cumP = (() => {
    let s = 0;
    return products.map((p) => (s += p.p));
  })();

  const pickProduct = () => {
    const r = rnd();
    const idx = cumP.findIndex((c) => r <= c);
    return products[idx < 0 ? products.length - 1 : idx];
  };

  const qtyFromR = () => {
    const r = rnd();
    return r < 0.6 ? 1 : r < 0.92 ? 2 : 3; // surtout 1–2
  };

  // Clients (réachat)
  let nextCust = 2001;
  const known = [];
  const pickCustomer = () => {
    // 35% nouveaux (tant qu’on n’a pas atteint le cap), sinon réachat biaisé "habitués"
    const makeNew = rnd() < 0.35 && nextCust - 2001 < customersCap;
    if (makeNew || known.length === 0) {
      const id = nextCust++;
      known.push(id);
      return id;
    }
    const idx = Math.floor(Math.pow(rnd(), 0.6) * known.length);
    return known[Math.min(idx, known.length - 1)];
  };

  let orderId = 10001;
  const rows = [];

  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const dow = new Date(date).getDay(); // 0..6
    const trend = 1 + growth * i;
    const noise = 0.85 + rnd() * 0.3; // ±15%
    const dayTarget = Math.round(baseDaily * weekMul[dow] * trend * noise);

    for (let k = 0; k < dayTarget; k++) {
      const pr = pickProduct();
      const qty = qtyFromR();
      const cid = pickCustomer();
      rows.push({
        date,
        order_id: orderId++,
        product: pr.name,
        qty,
        price: Number(pr.price.toFixed(2)),
        customer_id: cid,
      });
    }
  }

  return rows;
}

export function buildSampleSalesCSV(opts = {}) {
  const rows = buildSampleSales(opts);
  const headers = ["date", "order_id", "product", "qty", "price", "customer_id"];
  return toCSV(rows, headers);
}

// ===== CASHFLOW (trésorerie) =====
// Génère des mouvements journaliers (encaissements/décaissements)
export function buildSampleCash({
  start = "2025-07-01",
  days = 46,
  baseIn = 520,   // flux entrants moyens/jour (€
  baseOut = 540,  // flux sortants moyens/jour (€
  seed = 909,
} = {}) {
  const rnd = seededRand(seed);

  const catsIn = ["Ventes CB", "Virement client", "Stripe", "PayPal"];
  const catsOut = ["Loyer", "Salaires", "Fournisseurs", "Énergie", "Transport"];

  const rows = [];
  let txId = 50001;

  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const dow = new Date(date).getDay();

    // jours avec plus d'encaissements (vendredi/samedi)
    const inMul = [0.9, 0.95, 1, 1, 1.1, 1.25, 0.95][dow];
    const outMul = [1.05, 1, 1, 1.05, 1, 1, 1][dow];

    const inCount = 2 + Math.floor(rnd() * 3);   // 2–4 encaissements
    const outCount = 2 + Math.floor(rnd() * 2);  // 2–3 décaissements

    for (let k = 0; k < inCount; k++) {
      const amount =
        Math.round((baseIn * inMul * (0.7 + rnd() * 0.8)) / 10) * 10; // variance
      rows.push({
        id: txId++,
        date,
        label: catsIn[Math.floor(rnd() * catsIn.length)],
        amount: +Math.max(20, amount).toFixed(2), // positif
        kind: "in",
      });
    }

    for (let k = 0; k < outCount; k++) {
      const amount =
        Math.round((baseOut * outMul * (0.7 + rnd() * 0.7)) / 10) * 10;
      rows.push({
        id: txId++,
        date,
        label: catsOut[Math.floor(rnd() * catsOut.length)],
        amount: -+Math.max(15, amount).toFixed(2), // négatif
        kind: "out",
      });
    }
  }

  // tri par date puis id
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  return rows;
}

export function buildSampleCashCSV(opts = {}) {
  const rows = buildSampleCash(opts);
  const headers = ["id", "date", "label", "amount", "kind"];
  return toCSV(rows, headers);
}

// ===== Constantes prêtes à l'emploi (tableaux d'objets) =====
export const SAMPLE_SALES = buildSampleSales({
  start: "2025-07-01",
  days: 46,        // ~1,5 mois
  baseDaily: 44,   // volume de base
  growth: 0.0035,  // légère hausse
  customersCap: 380,
  // seed: 1337
});

export const SAMPLE_CASH = buildSampleCash({
  start: "2025-07-01",
  days: 46,
  baseIn: 520,
  baseOut: 540,
  // seed: 909
});
