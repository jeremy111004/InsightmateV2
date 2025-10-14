// src/pages/SupportOnboarding.jsx
import React from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Shield,
  CheckCircle2,
  Clock,
  LineChart,
  Rocket,
  CalendarClock,
  FileDown,
  PlayCircle,
  Mail,
  Phone,
  Coffee,
  ShoppingBag,
  Briefcase,
  User,
  ArrowRight,
} from "lucide-react";

/**
 * Helper: download a ready-to-use CSV template (sales)
 * Columns chosen to be broadly compatible with BI/PME contexts.
 */
function downloadSampleCSV() {
  const headers = [
    "date",
    "order_id",
    "customer",
    "product",
    "sku",
    "qty",
    "unit_price",
    "total_ht",
    "vat_rate",
    "total_ttc",
    "channel",
    "payment_method",
  ];
  const rows = [
    ["2025-09-01", "CMD-1001", "Dupont SARL", "Café Blend 1kg", "CF-1KG", 3, 18.5, 55.5, 0.2, 66.6, "Boutique", "CB"],
    ["2025-09-01", "CMD-1002", "Martin & Fils", "Abonnement Filtre", "SUB-FLT", 1, 29, 29, 0.2, 34.8, "En ligne", "Stripe"],
    ["2025-09-02", "CMD-1003", "Boulangerie Lili", "Moulin Pro", "MLN-PRO", 1, 219, 219, 0.2, 262.8, "B2B", "Virement"],
    ["2025-09-03", "CMD-1004", "Cliente Walk-in", "Espresso 250g", "ESP-250", 2, 7.9, 15.8, 0.2, 18.96, "Boutique", "Espèces"],
    ["2025-09-04", "CMD-1005", "Atelier Rudy", "Kit Dégustation", "KIT-D", 1, 42, 42, 0.2, 50.4, "En ligne", "PayPal"],
    ["2025-09-05", "CMD-1006", "Société Colibri", "Service Installation", "SRV-INS", 1, 120, 120, 0.2, 144, "B2B", "Virement"],
  ];
  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "insightmate_modele_ventes.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const fade = (delay = 0, y = 10, d = 0.45) => ({
  initial: { opacity: 0, y },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: d, ease: "easeOut", delay },
});

export default function SupportOnboarding() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      {/* Sticky top notice */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-2 text-xs text-white/70 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span>Support & Onboarding — setup clé en main, données branchées, équipe formée.</span>
        </div>
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_180px_at_15%_-10%,rgba(56,189,248,0.17),transparent)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_180px_at_85%_-10%,rgba(168,85,247,0.15),transparent)]" />
        <div className="mx-auto max-w-6xl px-4 pt-12 pb-10">
          <motion.div {...fade(0.05, 8, 0.55)} className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                <Sparkles className="h-4 w-4" />
                <span>Onboardé en &lt; 7 jours • KPI prêts • Sans Excel cassé</span>
              </div>
              <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
                Besoin d’un setup <span className="bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">clé en main</span> ?
                <br className="hidden md:block" />
                On s’en charge. Vous exécutez, on industrialise.
              </h1>
              <p className="mt-3 text-sm text-white/75">
                On connecte vos données (banque, ventes, compta), on configure vos KPIs, on forme l’équipe.
                Vous gardez la simplicité d’InsightMate, mais avec un déploiement pro et rapide.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <a
                  href="mailto:contact@insightmate.app?subject=Audit%20gratuit%2015%20min&body=Bonjour%2C%20je%20souhaite%20planifier%20un%20audit%20gratuit%20de%2015%20minutes."
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-slate-900 px-4 py-2 text-sm font-semibold hover:bg-white/90 transition shadow"
                >
                  <CalendarClock className="h-4 w-4" />
                  Audit gratuit 15 min
                  <ArrowRight className="h-4 w-4" />
                </a>
                <button
                  onClick={downloadSampleCSV}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                  title="Télécharger le CSV modèle"
                >
                  <FileDown className="h-4 w-4" />
                  CSV modèle
                </button>
                <a
                  href="#demo-video"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                >
                  <PlayCircle className="h-4 w-4" />
                  Vidéo 90s
                </a>
              </div>

              <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/60">
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Déploiement rapide</span>
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Données sécurisées</span>
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Zéro code requis</span>
              </div>
            </div>

            <motion.div
              {...fade(0.15, 12, 0.6)}
              className="relative mt-6 md:mt-0 w-full md:w-[40%] rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-tr from-cyan-500/10 via-fuchsia-500/10 to-indigo-500/10 blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between text-xs text-white/70">
                  <span className="inline-flex items-center gap-2">
                    <LineChart className="h-4 w-4" /> Aperçu KPI
                  </span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> Temps réel</span>
                </div>
                <div className="mt-3 h-40 rounded-xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 p-3">
                  {/* Faux graph blocks for tech vibe */}
                  <div className="h-2 w-20 rounded bg-white/10" />
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <div className="h-24 rounded bg-white/10" />
                    <div className="h-24 rounded bg-white/10" />
                    <div className="h-24 rounded bg-white/10" />
                    <div className="h-24 rounded bg-white/10" />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-white/75">
                  <div className="rounded border border-white/10 bg-white/5 p-2">CA 30j<br /><span className="text-white">+12%</span></div>
                  <div className="rounded border border-white/10 bg-white/5 p-2">Panier moyen<br /><span className="text-white">€18.9</span></div>
                  <div className="rounded border border-white/10 bg-white/5 p-2">Runway<br /><span className="text-white">42 j</span></div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* QUICK START */}
      <section className="mx-auto max-w-6xl px-4 pt-6 pb-4">
        <motion.h2 {...fade(0.05)} className="text-xl font-semibold">Quick Start (3 étapes)</motion.h2>
        <motion.p {...fade(0.08)} className="mt-1 text-sm text-white/70 max-w-2xl">
          Vous pouvez l’utiliser en self-service. Mais nos clients vont 3× plus vite avec l’onboarding.
        </motion.p>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "1) Import",
              desc: "Téléchargez le CSV modèle et importez vos ventes ou encaissements.",
              Icon: FileDown,
              pill: "2 min",
            },
            {
              title: "2) Connect",
              desc: "Optionnel : branchez Banque/Stripe/Shopify pour l’auto-sync.",
              Icon: Shield,
              pill: "Plug & play",
            },
            {
              title: "3) Go Live",
              desc: "Vos KPI se mettent à jour. On vous forme (30–60 min).",
              Icon: Rocket,
              pill: "< 7 j",
            },
          ].map((s, i) => (
            <motion.div
              key={s.title}
              {...fade(0.05 + i * 0.05)}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-tr from-cyan-500/10 via-fuchsia-500/10 to-indigo-500/10 blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold">
                    <s.Icon className="h-5 w-5" />
                    {s.title}
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] text-white/80">
                    {s.pill}
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/70">{s.desc}</p>
                {s.title.startsWith("1") && (
                  <button
                    onClick={downloadSampleCSV}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 transition"
                  >
                    <FileDown className="h-3.5 w-3.5" /> CSV modèle
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* USE CASES */}
      <section className="mx-auto max-w-6xl px-4 pt-6 pb-2">
        <motion.h3 {...fade(0.05)} className="text-lg font-semibold">Use cases</motion.h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            {
              Icon: Coffee,
              title: "Café / Point de vente",
              bullets: ["Prévision CA 30j", "Ruptures évitées", "Encaissements clarifiés"],
              stat: "+12 h gagnées/mois",
            },
            {
              Icon: ShoppingBag,
              title: "E-commerce",
              bullets: ["Top produits", "Cohorte clients", "Forecast + scénarios"],
              stat: "-18% erreurs Excel",
            },
            {
              Icon: Briefcase,
              title: "B2B / Services",
              bullets: ["DSO & relances", "Cash runway", "Risques clients"],
              stat: "Délai de paiement -9j",
            },
          ].map((c, i) => (
            <motion.div
              key={c.title}
              {...fade(0.06 + i * 0.05)}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-tr from-indigo-500/10 via-fuchsia-500/10 to-cyan-500/10 blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <c.Icon className="h-5 w-5" />
                  {c.title}
                </div>
                <ul className="mt-2 space-y-1 text-xs text-white/75">
                  {c.bullets.map(b => (
                    <li key={b} className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {b}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 text-xs text-white/80">{c.stat}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* SERVICE PACKAGES */}
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-2">
        <motion.h3 {...fade(0.05)} className="text-lg font-semibold">Services & Support</motion.h3>
        <motion.p {...fade(0.07)} className="mt-1 text-sm text-white/70 max-w-2xl">
          Choisissez votre mode : <strong>Done-For-You</strong>, <strong>Done-With-You</strong> ou <strong>Self-serve + SAV</strong>.
        </motion.p>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            {
              name: "Done-For-You",
              tagline: "On fait tout pour vous",
              price: "à partir de 990€",
              points: ["Audit & setup complet", "Connecteurs & mapping", "Dashboard custom + formation"],
              highlight: true,
            },
            {
              name: "Done-With-You",
              tagline: "On configure ensemble",
              price: "à partir de 590€",
              points: ["Atelier 2×60 min", "Import CSV & QA", "Playbook d’exploitation"],
              highlight: false,
            },
            {
              name: "Self-serve + SAV",
              tagline: "Autonomie guidée",
              price: "à partir de 0€",
              points: ["CSV modèle & mini-vidéo", "FAQ courte", "Support email (48h)"],
              highlight: false,
            },
          ].map((p, i) => (
            <motion.div
              key={p.name}
              {...fade(0.08 + i * 0.06)}
              className={[
                "relative overflow-hidden rounded-2xl border p-4",
                p.highlight
                  ? "border-white/20 bg-gradient-to-br from-fuchsia-500/10 via-cyan-500/10 to-indigo-500/10"
                  : "border-white/10 bg-white/5",
              ].join(" ")}
            >
              {p.highlight && (
                <div className="absolute right-4 top-4 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px]">
                  Recommandé
                </div>
              )}
              <div className="relative">
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="mt-1 text-xs text-white/70">{p.tagline}</div>
                <div className="mt-3 text-sm">
                  <span className="text-white/80">Tarif </span>
                  <span className="font-semibold">{p.price}</span>
                </div>
                <ul className="mt-3 space-y-1 text-xs text-white/75">
                  {p.points.map(pt => (
                    <li key={pt} className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {pt}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex gap-2">
                  <a
                    href="mailto:contact@insightmate.app?subject=Onboarding&body=Bonjour%2C%20je%20souhaite%20d%C3%A9marrer%20l%E2%80%99onboarding%20InsightMate."
                    className="inline-flex items-center gap-2 rounded-lg bg-white text-slate-900 px-3 py-1.5 text-xs font-semibold hover:bg-white/90 transition shadow"
                  >
                    <Mail className="h-3.5 w-3.5" /> Nous contacter
                  </a>
                  <a
                    href="tel:+33000000000"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 transition"
                  >
                    <Phone className="h-3.5 w-3.5" /> Appeler
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* SOCIAL PROOF / METRICS */}
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-2">
        <motion.div
          {...fade(0.05)}
          className="grid gap-4 md:grid-cols-3"
        >
          {[
            { label: "Mise en place", value: "< 7 jours" },
            { label: "Gain moyen", value: "+12 h/mois" },
            { label: "Réduction erreurs", value: "-18%" },
          ].map((m, i) => (
            <div key={m.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/70">{m.label}</div>
              <div className="mt-1 text-lg font-semibold">{m.value}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* DEMO VIDEO PLACEHOLDER */}
      <section id="demo-video" className="mx-auto max-w-6xl px-4 pt-8 pb-2">
        <motion.h3 {...fade(0.05)} className="text-lg font-semibold">Vidéo 90s — Import & KPI</motion.h3>
        <motion.div
          {...fade(0.08)}
          className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3"
        >
          <div className="relative aspect-video w-full rounded-xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900">
            <a
              href="#"
              title="Bientôt disponible"
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm">
                <PlayCircle className="h-5 w-5" />
                Bientôt disponible
              </div>
            </a>
          </div>
        </motion.div>
      </section>

      {/* FAQ COURTE */}
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-8">
        <motion.h3 {...fade(0.05)} className="text-lg font-semibold">FAQ (5 réponses, pas plus)</motion.h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {[
            {
              q: "Combien de temps pour être opérationnel ?",
              a: "Moins d’une semaine pour 80% des cas. Dépend du volume et de la qualité des données.",
            },
            {
              q: "Peut-on l’utiliser en self-service ?",
              a: "Oui. Le CSV modèle + la vidéo suffisent pour commencer. Le service accélère le go-live.",
            },
            {
              q: "Quels connecteurs sont prioritaires ?",
              a: "Stripe + Banque (Bridge/Powens) en premier, puis Shopify/Presta/Woo, puis Pennylane/Sage.",
            },
            {
              q: "Les données sont-elles sécurisées ?",
              a: "Oui. Lecture seule par défaut, chiffrement en transit, bonnes pratiques d’accès.",
            },
            {
              q: "Que couvre la formation ?",
              a: "Lecture des KPI, scénarios, bonnes pratiques (imports, nettoyage léger, relances).",
            },
          ].map(({ q, a }, i) => (
            <motion.div key={q} {...fade(0.06 + i * 0.04)} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold">{q}</div>
              <p className="mt-1 text-xs text-white/75">{a}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CRÉATEUR */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <motion.div
          {...fade(0.05)}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5"
        >
          <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-tr from-indigo-500/10 via-fuchsia-500/10 to-cyan-500/10 blur-2xl" />
          <div className="relative flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10">
                <User className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm font-semibold">Accompagnement par <span className="bg-gradient-to-r from-cyan-300 to-fuchsia-300 bg-clip-text text-transparent">Jérémy Duriez</span></div>
                <div className="mt-0.5 text-xs text-white/75">
                  Data & Risk — HMM/SV-HMM — InsightMate. On transforme vos données en décisions.
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href="mailto:contact@insightmate.app?subject=Onboarding"
                className="inline-flex items-center gap-2 rounded-lg bg-white text-slate-900 px-3 py-1.5 text-xs font-semibold hover:bg-white/90 transition shadow"
              >
                <Mail className="h-3.5 w-3.5" /> Contacter
              </a>
              <a
                href="tel:+33000000000"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 transition"
              >
                <Phone className="h-3.5 w-3.5" /> Appeler
              </a>
            </div>
          </div>
        </motion.div>

        {/* Footer micro-credit (optionnel si tu as déjà un SiteCredit global) */}
        <div className="mt-4 text-center text-[11px] text-white/50">
          © {new Date().getFullYear()} InsightMate — Créé par <span className="text-white/70 font-semibold">Jérémy Duriez</span>.
        </div>
      </section>
    </div>
  );
}
