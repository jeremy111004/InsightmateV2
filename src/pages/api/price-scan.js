// pages/api/price-scan.js
// ⚠️ Clé côté serveur uniquement (ne jamais exposer au client)
const SERPAPI_KEY = process.env.SERPAPI_KEY;

function parsePrice(anyPrice) {
  if (typeof anyPrice === "number" && Number.isFinite(anyPrice)) return anyPrice;
  if (typeof anyPrice === "string") {
    const s = anyPrice.replace(/\s/g, "").replace(/[€$£]/g, "").replace(",", ".");
    const m = s.match(/[\d.]+/);
    const n = m ? Number(m[0]) : NaN;
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeRows(items, loc, q) {
  const zone = /madrid/i.test(loc)
    ? "Madrid"
    : /barcelona/i.test(loc)
    ? "Barcelona"
    : "Spain";
  const quality = /premium|pro|deluxe|gourmet/i.test(q) ? "Premium" : "Standard";

  const rows = [];
  for (const it of items || []) {
    const price = parsePrice(it?.extracted_price ?? it?.price);
    if (!price || price <= 0) continue;

    const link =
      it?.link || it?.product_link || it?.serpapi_link || "https://example.com";
    let host = "unknown";
    try {
      host = new URL(link).host;
    } catch {}

    rows.push({
      zone,
      quality,
      price: Number(price.toFixed(2)),
      source: { host, url: link },
    });
  }

  // Dédupe (host + prix) et limite à 30
  const seen = new Set();
  const dedup = rows.filter((r) => {
    const key = `${r.source.host}|${Math.round(r.price * 100)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return dedup.slice(0, 30);
}

export default async function handler(req, res) {
  try {
    if (!SERPAPI_KEY) {
      return res.status(500).json({ error: "SERPAPI_KEY missing" });
    }

    // Accepte x-www-form-urlencoded (venant du frontend) ou query GET
    const q =
      (req.body && req.body.q) ||
      (req.method === "GET" && req.query?.q) ||
      "";
    const loc =
      (req.body && req.body.loc) ||
      (req.method === "GET" && req.query?.loc) ||
      "Spain";

    if (!q) return res.status(400).json({ error: "missing q" });

    const params = new URLSearchParams({
      engine: "google_shopping",
      q,
      api_key: SERPAPI_KEY,
      location: loc, // ex: "Madrid, Spain"
      hl: "es",
      gl: "es",
      num: "30",
    });

    const r = await fetch(`https://serpapi.com/search?${params.toString()}`);
    if (!r.ok) {
      const txt = await r.text();
      return res
        .status(r.status)
        .json({ error: "serpapi-failed", details: txt.slice(0, 500) });
    }

    const json = await r.json();
    const items = json?.shopping_results || [];
    const rows = normalizeRows(items, loc, q);

    return res.status(200).json({ provider: "serpapi", query: q, rows });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "scan-failed" });
  }
}
