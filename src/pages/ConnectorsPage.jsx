// src/pages/Connecteurs.jsx
import React from "react";
import { motion } from "framer-motion";
import {
  Plug,
  Clock,
  CreditCard,
  Store,
  ShoppingCart,
  Boxes,
  FileSpreadsheet,
  UploadCloud,
  Banknote,
  Wallet,
  Building2,
  Calculator,
} from "lucide-react";

const CONNECTORS = [
  {
    key: "stripe",
    name: "Stripe",
    Icon: CreditCard,
    desc: "Paiements en ligne",
  },
  {
    key: "bridge",
    name: "Bridge / Powens",
    Icon: Banknote,
    desc: "Banque FR (flux bancaires)",
  },
  { key: "shopify", name: "Shopify", Icon: Store, desc: "Boutique en ligne" },
  {
    key: "prestashop",
    name: "PrestaShop",
    Icon: ShoppingCart,
    desc: "E-commerce",
  },
  {
    key: "woocommerce",
    name: "WooCommerce",
    Icon: Boxes,
    desc: "E-commerce (WordPress)",
  },
  {
    key: "pennylane",
    name: "Pennylane",
    Icon: Building2,
    desc: "Comptabilité",
  },
  { key: "sage", name: "Sage", Icon: Building2, desc: "Comptabilité" },
  { key: "sumup", name: "SumUp", Icon: Calculator, desc: "Point de vente" },
  {
    key: "sheets",
    name: "Google Sheets",
    Icon: FileSpreadsheet,
    desc: "Source de données",
  },
  { key: "csv", name: "CSV", Icon: UploadCloud, desc: "Import manuel" },
  { key: "paypal", name: "PayPal", Icon: Wallet, desc: "Paiements" },
];

export default function Connecteurs() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      {/* Bandeau "dispo bientôt" */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-indigo-600/20 via-fuchsia-600/20 to-cyan-600/20 px-4 py-3">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_200px_at_20%_-20%,rgba(99,102,241,0.25),transparent)]" />
            <div className="flex items-center gap-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                <Clock className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-wide text-white/90">
                  DISPO BIENTÔT
                </span>
                <span className="text-xs text-white/70">
                  Les connecteurs arrivent. Préparez vos accès — tout sera
                  plug-and-play.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* En-tête */}
      <header className="mx-auto max-w-6xl px-4 pt-10">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="text-3xl font-bold tracking-tight"
        >
          Connecteurs
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
          className="mt-2 max-w-2xl text-sm text-slate-300"
        >
          Centralisez vos ventes, paiements et banques. Pour l’instant, cette
          page est un aperçu visuel : les tuiles sont volontairement{" "}
          <em>désactivées</em>.
        </motion.p>

        <div className="mt-6 flex items-center gap-2 text-xs text-white/60">
          <Plug className="h-4 w-4" />
          <span>Prototype UI — non fonctionnel</span>
        </div>
      </header>

      {/* Grille de connecteurs */}
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {CONNECTORS.map(({ key, name, Icon, desc }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.02 * i, ease: "easeOut" }}
              className="relative"
            >
              {/* Carte disabled */}
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Bientôt disponible"
                className="group block w-full cursor-not-allowed overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-left backdrop-blur-sm transition-transform"
              >
                {/* Halo animé */}
                <div className="pointer-events-none absolute -inset-0.5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute inset-0 rounded-2xl blur-2xl bg-gradient-to-tr from-indigo-500/10 via-fuchsia-500/10 to-cyan-400/10" />
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                    <Icon className="h-5 w-5 text-white/90" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{name}</h3>
                      <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
                        Bientôt
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-white/70">
                      {desc}
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

                <div className="mt-3 flex items-center justify-between text-xs text-white/60">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    En file d’attente
                  </span>
                  <span className="opacity-70">Non cliquable</span>
                </div>

                {/* Ruban "Dispo bientôt" */}
                <div className="pointer-events-none absolute -right-10 top-3 rotate-12">
                  <div className="rounded bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-3 py-1 text-[10px] font-semibold tracking-wider text-white shadow">
                    DISPO BIENTÔT
                  </div>
                </div>
              </button>
            </motion.div>
          ))}
        </div>

        {/* Bloc d'info bas de page */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
          className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5"
        >
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h4 className="text-sm font-semibold">Feuille de route</h4>
              <p className="mt-1 text-xs text-white/70">
                Priorité : <strong>Stripe</strong> +{" "}
                <strong>Bridge/Powens</strong> →{" "}
                <strong>Shopify/Presta/Woo</strong> →{" "}
                <strong>Pennylane/Sage</strong>.
              </p>
            </div>
            <div className="text-xs text-white/60">
              Interface figée pour l’instant — activation prévue dans une
              prochaine release.
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
