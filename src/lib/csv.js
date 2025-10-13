// src/lib/csv.js
import Papa from "papaparse";

/**
 * Options communes pour Papa.parse :
 * - header: true => retourne des objets {col: val}
 * - skipEmptyLines: true => ignore les lignes vides
 * - transformHeader: trim + normalisation simple des entêtes
 */
const BASE_PARSE_OPTS = {
  header: true,
  skipEmptyLines: true,
  transformHeader: (h) =>
    String(h || "")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^\w.-]/g, "")
      .toLowerCase(),
};

/** Convertit quelques valeurs fréquentes (date, nombres) */
function normalizeRow(row) {
  if (!row || typeof row !== "object") return row;
  const o = { ...row };

  // Dates courantes
  for (const k of ["date", "created_at", "order_date", "paid_date"]) {
    if (o[k]) o[k] = String(o[k]).slice(0, 10);
  }

  // Numériques fréquents si string (conserve 0)
  for (const k of ["qty", "quantity", "price", "amount", "gross", "fee", "net", "inflow", "outflow"]) {
    if (o[k] != null && typeof o[k] === "string") {
      const n = Number(o[k].replace?.(",", "."));
      if (!Number.isNaN(n)) o[k] = n;
    }
  }

  return o;
}

/**
 * Parse un File (input[type="file"]) → Promise<rows[]>
 * Utilise le worker Papa (non bloquant).
 */
export function importCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      ...BASE_PARSE_OPTS,
      worker: true,
      complete: (res) => {
        if (res?.errors?.length) {
          // remonte la première erreur pour feedback clair
          return reject(new Error(`CSV parse error: ${res.errors[0]?.message || "unknown"}`));
        }
        const rows = Array.isArray(res?.data) ? res.data.map(normalizeRow) : [];
        resolve(rows);
      },
      error: (err) => reject(err || new Error("CSV parse failed")),
    });
  });
}

/**
 * Parse une chaîne CSV (UTF-8) → rows[]
 * Utile si tu as déjà `text` (depuis fetch/clipboard).
 */
export function parseCSVText(text) {
  // Supprime BOM éventuel
  const clean = typeof text === "string" && text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const res = Papa.parse(clean, { ...BASE_PARSE_OPTS });
  if (res?.errors?.length) {
    throw new Error(`CSV parse error: ${res.errors[0]?.message || "unknown"}`);
  }
  return Array.isArray(res?.data) ? res.data.map(normalizeRow) : [];
}

/**
 * Récupère & parse un CSV public → Promise<rows[]>
 * Accepte : lien direct CSV (GitHub raw, GSheets publié en CSV, etc.)
 */
export async function importFromURL(url) {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  return parseCSVText(text);
}

/**
 * Prévisualisation légère pour l’UI (max 10 lignes, dates tronquées)
 */
export function normalizePreview(rows = []) {
  const first = Array.isArray(rows) ? rows.slice(0, 10) : [];
  return first.map(normalizeRow);
}
