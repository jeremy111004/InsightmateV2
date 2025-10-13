// src/components/RegimePricingPanel.jsx
import React from "react";
import { regimeAwarePrice } from "../lib/regimePricing";
import RegimeBadge from "./RegimeBadge";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function RegimePricingPanel({ product }) {
  if (!product) return null;
  const {
    unit_cost: cost,
    price: priceCurr,
    last_qty,
    e: baseE,
    stock_on_hand,
    lead_time_days,
    competitor_price,
    samples,
    category = "autre",
    kvi: isKVI,
  } = product;

  const res = regimeAwarePrice({
    cost,
    priceCurr,
    samples,
    baseElasticity: baseE,
    category,
    isKVI,
    signalsInput: {
      last_90d_qty: last_qty,
      price: priceCurr,
      competitor_price,
      stock_on_hand,
      lead_time_days,
    },
  });

  // build curve with adjusted elasticity (coherent with table)
  const e = res.eAdj;
  const k =
    last_qty > 0 && priceCurr > 0
      ? ((last_qty / 90) * 90) / Math.pow(priceCurr, e)
      : 1; // simple k from (P0,Q0)
  const prices = Array.from(
    { length: 31 },
    (_, i) => priceCurr * (0.7 + 0.02 * i)
  );
  const data = prices.map((p) => {
    const q = Math.max(0, k * Math.pow(p, e) * (1 / 1)); // same units
    const profit = (p - cost) * q;
    return { price: Number(p.toFixed(2)), profit: Math.max(0, profit) };
  });

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">Regime-aware — {product.name}</h3>
          <RegimeBadge regime={res.regime} />
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopOpacity={0.35} />
                <stop offset="95%" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="price" tickFormatter={(v) => nf2.format(v)} />
            <YAxis tickFormatter={(v) => nf0.format(v)} />
            <Tooltip
              formatter={(v, n) => [
                nf0.format(v),
                n === "profit" ? "Profit (€)" : "Prix",
              ]}
            />
            <Area type="monotone" dataKey="profit" fill="url(#gP)" />
            <Line type="monotone" dataKey="profit" dot={false} />
            <ReferenceLine
              x={priceCurr}
              strokeDasharray="4 4"
              label={{ value: "Prix", position: "top" }}
            />
            <ReferenceLine
              x={res.pRec}
              strokeDasharray="4 4"
              label={{ value: "Prix*", position: "top" }}
            />
          </AreaChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-2 gap-3 text-sm mt-3">
          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500 mb-1">Élasticité</div>
            <div>
              Base : <b>{baseE}</b> • Ajustée (régime) :{" "}
              <b>{res.eAdj.toFixed(2)}</b>
            </div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500 mb-1">Recommandation</div>
            <div>
              Prix → Prix* :{" "}
              <b>
                {nf2.format(priceCurr)} → {nf2.format(res.pRec)} €
              </b>
            </div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500 mb-1">Signaux</div>
            <div>
              z(demande) : <b>{res.signals.demandZ.toFixed(2)}</b> • Couverture
              : <b>{Math.round(res.signals.coverDays)} j</b>
            </div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500 mb-1">Concurrence</div>
            <div>
              Index marché :{" "}
              <b>
                {res.signals.priceIndex
                  ? res.signals.priceIndex.toFixed(2)
                  : "n/a"}
              </b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
