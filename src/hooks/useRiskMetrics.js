// ANCHOR: FILE_TOP useRiskMetrics.js
import { useMemo, useState } from "react";
import useDataset from "../hooks/useDataset";

// -------- utils
function toDate(d) { return new Date(typeof d === "string" ? d : (d?.toISOString?.() ?? d)); }
function fmtDate(d) { return toDate(d).toISOString().slice(0,10); }
function addDays(d, k) { const x = new Date(toDate(d)); x.setDate(x.getDate()+k); return x; }
function rangeDays(d0, d1) { const out=[]; let d=new Date(toDate(d0)); const end=new Date(toDate(d1)); while (d <= end) { out.push(fmtDate(d)); d.setDate(d.getDate()+1); } return out; }
function quantile(xs, q) { if (!xs?.length) return 0; const a=[...xs].sort((a,b)=>a-b); const p=Math.min(Math.max(q,0),1)*(a.length-1); const i=Math.floor(p), f=p-i; return i+1<a.length ? a[i]*(1-f)+a[i+1]*f : a[i]; }
function mean(xs){ if(!xs?.length) return 0; return xs.reduce((s,v)=>s+v,0)/xs.length; }
function stdev(xs){ if(!xs?.length) return 0; const m=mean(xs); const v=mean(xs.map(x=>(x-m)*(x-m))); return Math.sqrt(v); }
function lag1_corr(xs){ if((xs?.length??0)<2) return 0; const x=xs, xm=mean(x); const x1=x.slice(0,-1), x2=x.slice(1); const num=mean(x1.map((v,i)=>(v-xm)*(x2[i]-xm))); const den=stdev(x1)*stdev(x2); return den?(num/den):0; }
function gaussian(){ let u=0,v=0; while(u===0) u=Math.random(); while(v===0) v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }

// -------- agrégations
function dailyTotals(rows, {dateKeyCandidates=["date","day","Date"], valueKeyCandidates=["amount","value","net","total"]}={}) {
  const findKey = (obj, cands)=> cands.find(k => k in (obj||{}));
  const out = new Map();
  for (const r of (rows||[])) {
    const dk = findKey(r, dateKeyCandidates);
    const vk = findKey(r, valueKeyCandidates);
    if (!dk || !vk) continue;
    const d = fmtDate(r[dk]); const v = Number(r[vk]) || 0;
    out.set(d, (out.get(d)||0) + v);
  }
  return out;
}

function hhiFromSales(rows){
  const key = (o)=> ("customer" in o ? o.customer : ("client" in o ? o.client : null));
  const by = new Map();
  for (const r of (rows||[])) {
    const c=key(r); if(!c) continue;
    const v = Number(r.amount ?? r.value ?? 0) || 0;
    by.set(c, (by.get(c)||0) + v);
  }
  const total=[...by.values()].reduce((s,v)=>s+v,0);
  if(!total) return { hhi:0, shares:[] };
  const shares=[...by.entries()].map(([name,v])=>({name,share:v/total})).sort((a,b)=>b.share-a.share).slice(0,10);
  const hhi = shares.reduce((s,r)=>s+r.share*r.share,0);
  return { hhi, shares };
}

// -------- AR(1) sur increments
function fitAR1(increments){
  const mu=mean(increments);
  const phi=Math.max(Math.min(lag1_corr(increments),0.98),-0.98);
  const s=stdev(increments);
  const sigma = s * Math.sqrt(1 - phi*phi) || (s||1e-6);
  return { mu, phi, sigma };
}
function simulatePathsAR1({baseIncrements, horizon=90, nSim=3000, startCash=10000}){
  const {mu,phi,sigma}=fitAR1(baseIncrements);
  const paths=new Array(nSim);
  for(let k=0;k<nSim;k++){
    let cash=startCash;
    let xPrev = baseIncrements.length ? baseIncrements[baseIncrements.length-1] : 0;
    const p=new Array(horizon);
    for(let t=0;t<horizon;t++){
      const eps=gaussian()*sigma;
      const x = mu + phi*(xPrev-mu) + eps;
      xPrev = x; cash += x; p[t]=cash;
    }
    paths[k]=p;
  }
  return paths;
}
function shiftDailyMap(map, days=0){
  if(!map || !map.size || !days) return map;
  const out=new Map();
  for(const [d,v] of map.entries()){
    const nd=fmtDate(addDays(d,days));
    out.set(nd,(out.get(nd)||0)+v);
  }
  return out;
}

// -------- DEMO plus “vivante” (saisonnalité + régimes + chocs)
function buildDemoBase(){
  const today=new Date();
  const d0=addDays(today,-240), d1=today;
  const dates=rangeDays(d0,d1);

  const increments = dates.map((ds, i) => {
    const d = toDate(ds);
    const dow = d.getDay();                  // hebdo
    const weekly = [0.6, 0.8, 1.0, 1.05, 1.15, 1.3, 0.7][dow];
    const month = d.getMonth();              // annuel
    const seasonal = 1 + 0.12*Math.sin((2*Math.PI*(month+1))/12);
    const trend = 1 + 0.0009*i;              // trend léger
    // régimes de volatilité (calme → choppy → calme)
    const regime = (i<80) ? 1.0 : (i<160 ? 1.8 : 0.9);
    const base = 180 * weekly * seasonal * trend;
    const spikePromo = (Math.random()<0.04) ? (250 + 250*Math.random()) : 0;
    const shockNeg   = (Math.random()<0.015)? (-500 - 500*Math.random()) : 0;
    const noise = regime * 110 * gaussian();
    // on simule directement l’increment net (≈ marge + encaissements + flux bancaires)
    return Math.max(-800, base*0.55 + spikePromo + shockNeg + noise);
  });

  const demoShares = [
    {name:"Alpha SARL", share:0.18}, {name:"Bravo SAS",  share:0.14},
    {name:"Cobalt SA",  share:0.11}, {name:"Delta EURL", share:0.08},
    {name:"Echo SPRL",  share:0.07}, {name:"Fiducia",    share:0.06},
    {name:"Gamma",      share:0.05}, {name:"Helios",     share:0.04},
    {name:"Iris",       share:0.04}, {name:"Juno",       share:0.03},
  ];
  const hhi = demoShares.reduce((s,r)=>s+r.share*r.share,0);
  return { dates, increments, hhi, shares: demoShares, isDemo:true };
}

export default function useRiskMetrics(){
  const sales = useDataset("sales");
  const payments = useDataset("payments");
  const banking = useDataset("banking");

  const [params, setParams] = useState({ horizon: 60, alpha: 0.95, nSim: 3000, startCash: 12000 });
  const [stress, setStress] = useState({ salesPct: 0, costPct: 0, dsoDeltaDays: 0 });

  const base = useMemo(()=>{
    const salesMap = dailyTotals(sales?.rows||[]);
    const payMap   = dailyTotals(payments?.rows||[]);
    const bankMap  = dailyTotals(banking?.rows||[]);

    const hasRealData = (salesMap.size + payMap.size + bankMap.size) > 0;
    if (!hasRealData) return buildDemoBase();

    // stress simple : scale ventes, retarde encaissements, applique coûts
    const sSalesMap = new Map();
    for (const [d,v] of salesMap.entries()){
      const scaled = v * (1 + (stress.salesPct||0)/100);
      sSalesMap.set(d, (sSalesMap.get(d)||0) + scaled);
    }
    const sPayMap = shiftDailyMap(payMap, (stress.dsoDeltaDays||0));

    const dates = [...new Set([...salesMap.keys(), ...sSalesMap.keys(), ...payMap.keys(), ...sPayMap.keys(), ...bankMap.keys()])].sort();
    if (!dates.length) return buildDemoBase();

    const d0 = dates[0], d1 = dates[dates.length-1];
    const all = rangeDays(d0, d1);

    const costRate = Math.max(0, Math.min(1, (stress.costPct||0)/100 ));
    const increments = all.map(dateStr=>{
      const salesVal = (sSalesMap.get(dateStr)||0);
      const margin   = salesVal * (1 - costRate);
      const payVal   = (sPayMap.get(dateStr)||0);
      const bankVal  = (bankMap.get(dateStr)||0);
      return margin + payVal + bankVal;
    });

    const { hhi, shares } = hhiFromSales(sales?.rows||[]);
    return { dates: all, increments, hhi, shares, isDemo:false };
  }, [sales, payments, banking, stress]);

  const sim = useMemo(()=>{
    const horizon = Math.max(30, Math.min(180, params.horizon||60));
    const nSim    = Math.max(1000, Math.min(8000, params.nSim||3000));
    const start   = params.startCash||12000;

    const last = base.increments.slice(-200);
    const paths = simulatePathsAR1({ baseIncrements: last, horizon, nSim, startCash: start });

    const p5=[], p50=[], p95=[];
    for (let t=0;t<horizon;t++){
      const xs = paths.map(p=>p[t]);
      p5[t]  = quantile(xs, 0.05);
      p50[t] = quantile(xs, 0.50);
      p95[t] = quantile(xs, 0.95);
    }

    const finals = paths.map(p=> p[p.length-1] - start);
    const q = 1 - (params.alpha||0.95);
    const varLoss = -quantile(finals, q);
    const tail = finals.filter(v => v <= quantile(finals, q));
    const esLoss = -(tail.length ? mean(tail) : quantile(finals, q));

    let overdrafts = 0;
    const runwayDays = [];
    for (const p of paths){
      let dayHit = null;
      for (let t=0;t<p.length;t++){
        if (p[t] < 0){ dayHit = t+1; break; }
      }
      if (dayHit !== null){ overdrafts++; runwayDays.push(dayHit); }
    }
    const probOD = overdrafts / paths.length;
    const runwayP5 = runwayDays.length ? quantile(runwayDays, 0.05) : Infinity;

    return { fan: { p5, p50, p95, horizon }, cfar: varLoss, es: esLoss, probOverdraft: probOD, runwayP5 };
  }, [base, params]);

  const metrics = useMemo(()=>({
    horizon: params.horizon, alpha: params.alpha,
    cfar: sim.cfar, es: sim.es,
    probOverdraft: sim.probOverdraft, runwayP5: sim.runwayP5,
    hhi: base.hhi, shares: base.shares, isDemo: base.isDemo,
  }), [sim, params, base]);

  const fanSeries = useMemo(()=>{
    const start = new Date();
    return new Array(sim.fan.horizon).fill(0).map((_,i)=>({
      t: fmtDate(addDays(start, i+1)),
      p5: sim.fan.p5[i], p50: sim.fan.p50[i], p95: sim.fan.p95[i],
    }));
  }, [sim]);

  function recompute(newParams){ if(newParams) setParams(p=>({ ...p, ...newParams })); else setParams(p=>({...p})); }
  return { params, setParams, stress, setStress, metrics, fanSeries, recompute };
}
