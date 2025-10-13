// utils/leakage.js
function toNum(v, fb=null){ const n=Number(String(v||"").replace(",",".").replace(/[^\d.-]/g,"")); return Number.isFinite(n)?n:fb; }

// Stats robustes
function median(a){ const s=[...a].sort((x,y)=>x-y); const n=s.length; if(!n) return NaN; const m=Math.floor(n/2); return n%2?s[m]:(s[m-1]+s[m])/2; }
function mad(a){ const m=median(a); const dev=a.map(x=>Math.abs(x-m)); return median(dev)*1.4826; } // ~écart-type

// Normalisation d’une ligne CSV
export function normRow(r){
  const qty = Math.max(0, toNum(r.qty, 0));
  const price = toNum(r.unit_price, 0);
  const cost = toNum(r.unit_cost, 0);
  const discount = Math.max(0, toNum(r.discount, 0));
  const fee = toNum(r.shipping_fee, 0);
  const scost = toNum(r.shipping_cost, 0);

  // éviter /0
  const base = Math.max(1e-9, qty * Math.max(0, price));
  const netUnit = qty>0 ? Math.max(0, price - discount/qty) : price;

  const discPct = Math.max(0, Math.min(1.5, base>0 ? discount / base : 0));
  const lineRev = Math.max(0, qty * price - discount);
  const unitMargin = netUnit - cost;
  const lineMargin = qty * unitMargin;

  return {
    date: r.date, order_id: r.order_id, sku: String(r.sku||"").trim(),
    name: r.name, qty, unit_price: price, unit_cost: cost, discount,
    net_unit_price: netUnit, line_revenue: lineRev, unit_margin: unitMargin, line_margin: lineMargin,
    discount_pct: discPct, shipping_fee: fee, shipping_cost: scost
  };
}

export function analyze(rows, { targetMarginPct=0.30, driftPct=0.15 } = {}){
  const clean = rows.filter(r => r.qty>0 && r.unit_price>0 && r.unit_cost>=0);
  // Groupes par SKU
  const bySku = new Map();
  for(const r of clean){
    if(!bySku.has(r.sku)) bySku.set(r.sku, []);
    bySku.get(r.sku).push(r);
  }

  let leakUnderCost=0, leakErosion=0, leakShipping=0, leakOverDiscount=0;

  const skuStats = [];

  for(const [sku, arr] of bySku.entries()){
    // stats de base
    const prices = arr.map(x=>x.unit_price);
    const discs = arr.map(x=>x.discount_pct);
    const medPrice = median(prices);
    const medDisc = median(discs);
    const discMad = mad(discs);

    let skuLeakUC=0, skuLeakERO=0, skuLeakOD=0, skuLeakDRIFT=0, skuLeakSHIP=0;
    for(const r of arr){
      // 1) sous-coût
      if(r.net_unit_price < r.unit_cost){
        skuLeakUC += r.qty * (r.unit_cost - r.net_unit_price);
      }
      // 2) érosion vs cible
      const targetPrice = r.unit_cost * (1 + targetMarginPct);
      if(r.net_unit_price < targetPrice){
        skuLeakERO += r.qty * (targetPrice - r.net_unit_price);
      }
      // 3) sur-remise (anomalie)
      const threshold = medDisc + 3*discMad; // si MAD=0, threshold = medDisc
      if(discMad>0 && r.discount_pct > threshold){
        // prix net “attendu” si remise au niveau médian
        const base = r.qty * r.unit_price;
        const expectedNetUnit = (base * (1 - medDisc)) / Math.max(1, r.qty);
        if(expectedNetUnit > r.net_unit_price){
          skuLeakOD += r.qty * (expectedNetUnit - r.net_unit_price);
        }
      }
      // 4) drift de prix vs médiane
      if(medPrice>0 && Math.abs(r.unit_price - medPrice)/medPrice > driftPct){
        // estimation conservative: on aligne à la médiane
        const aligned = medPrice - (r.discount / Math.max(1, r.qty));
        if(aligned > r.net_unit_price){
          skuLeakDRIFT += r.qty * (aligned - r.net_unit_price);
        }
      }
      // 5) transport
      if(Number.isFinite(r.shipping_cost) && Number.isFinite(r.shipping_fee)){
        if(r.shipping_cost > r.shipping_fee){
          skuLeakSHIP += (r.shipping_cost - r.shipping_fee);
        }
      }
    }

    leakUnderCost += skuLeakUC;
    leakErosion += skuLeakERO;
    leakOverDiscount += skuLeakOD + skuLeakDRIFT;
    leakShipping += skuLeakSHIP;

    const name = arr[0]?.name || sku;
    const qty = arr.reduce((s,x)=>s+x.qty,0);
    const rev = arr.reduce((s,x)=>s+x.line_revenue,0);
    const mrg = arr.reduce((s,x)=>s+x.line_margin,0);

    skuStats.push({
      sku, name, qty, revenue: rev, margin: mrg,
      leak_under_cost: +skuLeakUC.toFixed(2),
      leak_erosion: +skuLeakERO.toFixed(2),
      leak_discount: +skuLeakOD.toFixed(2),
      leak_price_drift: +skuLeakDRIFT.toFixed(2),
      leak_shipping: +skuLeakSHIP.toFixed(2),
      leak_total: +(skuLeakUC+skuLeakERO+skuLeakOD+skuLeakDRIFT+skuLeakSHIP).toFixed(2),
      med_price: medPrice, med_discount: medDisc, disc_mad: discMad
    });
  }

  // Pareto
  const topUnderCost = [...skuStats].sort((a,b)=>b.leak_under_cost-a.leak_under_cost).slice(0,20);
  const topErosion   = [...skuStats].sort((a,b)=>b.leak_erosion-a.leak_erosion).slice(0,20);
  const topDiscount  = [...skuStats].sort((a,b)=> (b.leak_discount+b.leak_price_drift) - (a.leak_discount+a.leak_price_drift)).slice(0,20);

  return {
    kpi: {
      leakUnderCost: +leakUnderCost.toFixed(2),
      leakErosion: +leakErosion.toFixed(2),
      leakShipping: +leakShipping.toFixed(2),
      leakDiscount: +leakOverDiscount.toFixed(2),
      leakTotal: +(leakUnderCost+leakErosion+leakShipping+leakOverDiscount).toFixed(2),
    },
    topUnderCost, topErosion, topDiscount,
  };
}
