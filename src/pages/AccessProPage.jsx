// src/pages/Connectors.jsx
import React from "react";
import { motion } from "framer-motion";
import {
  Video,
  FileSpreadsheet,
  Database,
  CreditCard,
  Building2,
  HelpCircle,
  Download,
  Wand2,
  Sparkles,
} from "lucide-react";

/** =========================================================================
 *  Helpers (CSV builders + downloader)
 *  ========================================================================= */
function buildCSV(headers, rows) {
  const head = headers.join(",");
  const lines = rows.map((r) => headers.map((h) => r[h] ?? "").join(","));
  return [head, ...lines].join("\n");
}
function downloadText(text, filename, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** =========================================================================
 *  Example CSVs (adjust columns if you’ve standardized differently)
 *  ========================================================================= */
function downloadSalesTemplate() {
  const headers = [
    "date",
    "order_id",
    "sku",
    "name",
    "qty",
    "unit_price",
    "unit_cost",
    "discount",
    "shipping_fee",
    "shipping_cost",
  ];
  const rows = [
    {
      date: "2025-10-01",
      order_id: "A-1001",
      sku: "SKU-A",
      name: "Produit A",
      qty: 2,
      unit_price: 39.9,
      unit_cost: 22.5,
      discount: 0,
      shipping_fee: 3.9,
      shipping_cost: 3.1,
    },
    {
      date: "2025-10-02",
      order_id: "B-2001",
      sku: "SKU-B",
      name: "Produit B",
      qty: 1,
      unit_price: 59.0,
      unit_cost: 31.0,
      discount: 5.0,
      shipping_fee: 0,
      shipping_cost: 0,
    },
  ];
  downloadText(buildCSV(headers, rows), "insightmate_sales_template.csv");
}
function downloadPayoutsTemplate() {
  const headers = ["date", "provider", "gross", "fees", "net", "currency"];
  const rows = [
    {
      date: "2025-10-01",
      provider: "Stripe",
      gross: 420.5,
      fees: 7.1,
      net: 413.4,
      currency: "EUR",
    },
    {
      date: "2025-10-03",
      provider: "Shopify",
      gross: 278.0,
      fees: 4.6,
      net: 273.4,
      currency: "EUR",
    },
  ];
  downloadText(buildCSV(headers, rows), "insightmate_payouts_template.csv");
}

/** =========================================================================
 *  Video placeholder (replace with your <video> or <iframe> later)
 *  ========================================================================= */
function VideoPlaceholder({ label = "Votre vidéo ici (à venir)" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4 }}
      className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-slate-50/60 to-white/20 dark:from-slate-900/40 dark:to-slate-900/20 backdrop-blur"
    >
      <div className="absolute inset-0 grid place-items-center">
        <div className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Video size={16} />
          {label}
        </div>
      </div>
      {/* Decorative glows */}
      <div className="pointer-events-none absolute -top-16 -left-16 h-40 w-40 rounded-full bg-cyan-400/30 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-blue-500/20 blur-2xl" />
    </motion.div>
  );
}

/** =========================================================================
 *  Simple animated FAQ accordion
 *  ========================================================================= */
function FAQ({ items }) {
  const [open, setOpen] = React.useState(null);
  return (
    <div className="space-y-2">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.35, delay: i * 0.02 }}
            className="rounded-2xl border border-white/20 bg-white/60 dark:bg-slate-900/60 backdrop-blur"
          >
            <button
              className="w-full px-4 py-3 flex items-center justify-between text-left"
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <span className="font-medium">{it.q}</span>
              <HelpCircle
                className={`transition-transform ${isOpen ? "rotate-45" : ""}`}
                size={18}
              />
            </button>
            <motion.div
              initial={false}
              animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="px-4 overflow-hidden"
            >
              <div className="pb-4 pt-1 text-sm text-gray-700 dark:text-gray-300">
                {typeof it.a === "function" ? it.a() : it.a}
              </div>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

/** =========================================================================
 *  Main page
 *  ========================================================================= */
export default function Connectors() {
  const sections = [
    {
      key: "sheets",
      icon: <FileSpreadsheet size={18} />,
      title: "Google Sheets / CSV",
      desc: "Connecter un Google Sheet ou un CSV au format attendu par InsightMate.",
      steps: [
        "Ouvrez votre table (Sheets ou Excel) et vérifiez les en-têtes.",
        "Exportez en CSV (UTF-8).",
        "Dans InsightMate, allez sur Import et chargez le fichier.",
      ],
      schemaHint:
        "Ventes recommandées : date, order_id, sku, name, qty, unit_price, unit_cost, discount, shipping_fee, shipping_cost.",
      cta: {
        label: "Télécharger un CSV d’exemple (ventes)",
        onClick: downloadSalesTemplate,
      },
      extraCTA: {
        label: "Télécharger un CSV d’exemple (payouts)",
        onClick: downloadPayoutsTemplate,
      },
    },
    {
      key: "shopify",
      icon: <Database size={18} />,
      title: "Shopify",
      desc: "Exporter vos commandes Shopify et importer le CSV dans InsightMate.",
      steps: [
        "Admin Shopify → Orders → Export.",
        "Sélectionnez la période et ‘CSV for spreadsheet programs’.",
        "Chargez le CSV dans InsightMate (page Import).",
      ],
      schemaHint:
        "Vérifiez les colonnes date, total, discounts, shipping, line items.",
    },
    {
      key: "stripe",
      icon: <CreditCard size={18} />,
      title: "Stripe",
      desc: "Exporter paiements/versements pour conciliation de trésorerie.",
      steps: [
        "Stripe Dashboard → Payments (ou Payouts) → Export.",
        "Incluez les colonnes fees et net.",
        "Importez dans InsightMate pour rapprocher ventes/paiements.",
      ],
      schemaHint: "Recommandé : date, provider, gross, fees, net, currency.",
    },
    {
      key: "accounting",
      icon: <Building2 size={18} />,
      title: "Comptabilité (Pennylane, Sage, etc.)",
      desc: "Export CSV des écritures de ventes et achats depuis votre outil.",
      steps: [
        "Exportez ventes et coûts en CSV.",
        "Harmonisez les en-têtes pour coller au modèle InsightMate.",
        "Importez et contrôlez (TVA, devises, dates).",
      ],
      schemaHint:
        "Minimum : date, compte/nom, montant, catégorie (vente/coût).",
    },
  ];

  const faq = [
    {
      q: "Mon CSV ne charge pas, que faire ?",
      a: () => (
        <ul className="list-disc ml-5 space-y-1">
          <li>
            Vérifiez l’encodage <b>UTF-8</b> et le séparateur (virgule).
          </li>
          <li>
            Respectez les <b>en-têtes</b> exacts attendus.
          </li>
          <li>
            Dates en <code>YYYY-MM-DD</code>.
          </li>
          <li>
            Décimales avec le <b>point</b> (<code>.</code>).
          </li>
        </ul>
      ),
    },
    {
      q: "Comment mes données alimentent les modules Risk / Pricing ?",
      a: "Les ventes sont agrégées par jour pour calculer les flux de trésorerie (Risk) et les marges/élasticités (Pricing). Les imports réels remplacent l’exemple automatiquement.",
    },
    {
      q: "Puis-je mélanger Shopify + Stripe + Sheets ?",
      a: "Oui, si les schémas sont alignés. En cas de conflit, l’ID de commande et la date priment.",
    },
  ];

  return (
    <div className="relative">
      {/* Techy background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_20%_-10%,rgba(56,189,248,0.20),transparent_60%),radial-gradient(70%_50%_at_110%_10%,rgba(14,165,233,0.18),transparent_60%)]" />
        <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-white to-transparent dark:from-slate-950" />
      </div>

      <div className="p-6 md:p-10 space-y-10">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-start justify-between gap-4"
        >
          <div>
            <div className="inline-flex items-center gap-2 text-sm text-cyan-600 dark:text-cyan-300">
              <Sparkles size={16} />
              Onboarding intelligent
            </div>
            <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">
              Aide & Tutoriels — Connecteurs de données
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              Connectez Sheets, Shopify, Stripe ou votre comptabilité. Des
              pas-à-pas courts, des modèles CSV et des vidéos concises pour un
              import <i>first-time-right</i>.
            </p>
          </div>
        </motion.header>

        {/* Intro video */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Introduction (2–3 min)</h2>
          <VideoPlaceholder label="Intro : positionnement, connecteurs, résultats (collez votre <video> ou <iframe>)" />
        </section>

        {/* CleanMyExcel helper */}
        <motion.section
          id="cleanmyexcel"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl border border-white/20 bg-white/60 dark:bg-slate-900/60 backdrop-blur p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Wand2 size={18} />
            <h2 className="text-base md:text-lg font-semibold">
              Pré-nettoyage rapide du CSV (optionnel)
            </h2>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Si votre fichier refuse de s’importer ou contient des caractères
            bizarres, utilisez un outil de “nettoyage” pour le remettre au
            propre avant de l’importer dans InsightMate.
            <b> CleanMyExcel</b> peut vous aider à :
          </p>
          <ul className="list-disc ml-5 mt-2 text-sm text-gray-700 dark:text-gray-200 space-y-1">
            <li>
              Corriger l’encodage <b>UTF-8</b> et les séparateurs (point-virgule
              vs virgule).
            </li>
            <li>
              Uniformiser les formats de <b>dates</b> et de <b>décimales</b>{" "}
              (virgule → point).
            </li>
            <li>
              Supprimer les <b>caractères invisibles</b>, guillemets mal fermés
              et lignes vides.
            </li>
            <li>
              Réparer les en-têtes (espaces, doublons) pour coller au schéma
              d’import.
            </li>
          </ul>

          <div className="flex flex-wrap items-center gap-3 mt-3">
            <a
              href="https://cleanmyexcel.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-white/20 bg-white/70 dark:bg-slate-950/70 hover:bg-white/90 dark:hover:bg-slate-900 backdrop-blur transition"
              title="Ouvrir CleanMyExcel dans un nouvel onglet"
            >
              <Wand2 size={16} />
              Ouvrir CleanMyExcel
            </a>
            <span className="text-xs text-gray-500">
              Astuce : réexportez ensuite en <b>CSV UTF-8</b> puis importez-le
              ici.
            </span>
          </div>
        </motion.section>

        {/* Connector cards */}
        <section className="grid md:grid-cols-2 gap-6">
          {sections.map((s, idx) => (
            <motion.article
              key={s.key}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
              className="group relative overflow-hidden rounded-3xl border border-white/20 bg-white/60 dark:bg-slate-900/60 backdrop-blur p-4 md:p-5"
            >
              {/* Accent gradient edge */}
              <div className="pointer-events-none absolute inset-x-0 -top-24 h-44 bg-gradient-to-b from-cyan-400/15 to-transparent blur-2xl" />
              <div className="relative space-y-4">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400/25 to-blue-500/25 text-cyan-700 dark:text-cyan-200 border border-white/20">
                    {s.icon}
                  </div>
                  <h3 className="text-base md:text-lg font-semibold">
                    {s.title}
                  </h3>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {s.desc}
                </p>

                <div>
                  <div className="text-[11px] tracking-wide uppercase text-gray-500 mb-2">
                    Étapes
                  </div>
                  <ol className="list-decimal list-inside text-sm space-y-1 text-gray-800 dark:text-gray-200">
                    {s.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>

                <div className="text-xs text-gray-500">{s.schemaHint}</div>

                {/* Per-connector video slot */}
                <VideoPlaceholder
                  label={`Tutoriel ${s.title} (collez votre <video> ou <iframe>)`}
                />

                {/* CTAs */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {s.cta && (
                    <button
                      onClick={s.cta.onClick}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-white/20 bg-white/70 dark:bg-slate-950/70 hover:bg-white/90 dark:hover:bg-slate-900 backdrop-blur transition"
                    >
                      <Download size={16} />
                      {s.cta.label}
                    </button>
                  )}
                  {s.extraCTA && (
                    <button
                      onClick={s.extraCTA.onClick}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-white/20 bg-white/70 dark:bg-slate-950/70 hover:bg-white/90 dark:hover:bg-slate-900 backdrop-blur transition"
                    >
                      <Download size={16} />
                      {s.extraCTA.label}
                    </button>
                  )}
                </div>
              </div>

              {/* Hover glow */}
              <div className="pointer-events-none absolute -inset-1 opacity-0 group-hover:opacity-100 transition duration-300 bg-gradient-to-r from-cyan-400/10 via-blue-400/10 to-cyan-400/10 blur-2xl rounded-[inherit]" />
            </motion.article>
          ))}
        </section>

        {/* Best practices */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.35 }}
          className="rounded-3xl border border-white/20 bg-white/60 dark:bg-slate-900/60 backdrop-blur p-5"
        >
          <h2 className="text-base md:text-lg font-semibold mb-2">
            Bonnes pratiques d’import
          </h2>
          <ul className="list-disc ml-5 text-sm text-gray-800 dark:text-gray-200 space-y-1">
            <li>
              Dates en <code>YYYY-MM-DD</code> et montants en décimales « . »
            </li>
            <li>
              Vérifiez marges :{" "}
              <code>
                qty*unit_price - discount + shipping_fee - (qty*unit_cost +
                shipping_cost)
              </code>
            </li>
            <li>
              Commencez avec un petit échantillon, validez, puis importez
              l’historique complet.
            </li>
          </ul>
        </motion.section>

        {/* FAQ */}
        <section className="space-y-3">
          <h2 className="text-base md:text-lg font-semibold">FAQ</h2>
          <FAQ items={faq} />
        </section>
      </div>
    </div>
  );
}
