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
import { useTranslation } from "react-i18next";

const CONNECTORS = [
  { key: "stripe", name: "Stripe", Icon: CreditCard },
  { key: "bridge", name: "Bridge / Powens", Icon: Banknote },
  { key: "shopify", name: "Shopify", Icon: Store },
  { key: "prestashop", name: "PrestaShop", Icon: ShoppingCart },
  { key: "woocommerce", name: "WooCommerce", Icon: Boxes },
  { key: "pennylane", name: "Pennylane", Icon: Building2 },
  { key: "sage", name: "Sage", Icon: Building2 },
  { key: "sumup", name: "SumUp", Icon: Calculator },
  { key: "sheets", name: "Google Sheets", Icon: FileSpreadsheet },
  { key: "csv", name: "CSV", Icon: UploadCloud },
  { key: "paypal", name: "PayPal", Icon: Wallet },
];

export default function Connecteurs() {
  const { t } = useTranslation("connectors");

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      {/* Banner: coming soon */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-indigo-600/20 via-fuchsia-600/20 to-cyan-600/20 px-4 py-3">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_200px_at_20%_-20%,rgba(99,102,241,0.25),transparent)]" />
            <div className="flex items-center gap-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                <Clock className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-wide text-white/90 uppercase">
                  {t("banner.soon")}
                </span>
                <span className="text-xs text-white/70">
                  {t("banner.desc")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="mx-auto max-w-6xl px-4 pt-10">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="text-3xl font-bold tracking-tight"
        >
          {t("header.title")}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
          className="mt-2 max-w-2xl text-sm text-slate-300"
        >
          {t("header.lead")}
        </motion.p>

        <div className="mt-6 flex items-center gap-2 text-xs text-white/60">
          <Plug className="h-4 w-4" />
          <span>{t("header.prototype")}</span>
        </div>
      </header>

      {/* Grid of connectors */}
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {CONNECTORS.map(({ key, name, Icon }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.02 * i, ease: "easeOut" }}
              className="relative"
            >
              {/* Disabled card */}
              <button
                type="button"
                disabled
                aria-disabled="true"
                title={t("card.soonTitle")}
                className="group block w-full cursor-not-allowed overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-left backdrop-blur-sm transition-transform"
              >
                {/* Animated halo */}
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
                        {t("card.pillSoon")}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-white/70">
                      {t(`list.${key}.desc`)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

                <div className="mt-3 flex items-center justify-between text-xs text-white/60">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {t("card.queue")}
                  </span>
                  <span className="opacity-70">{t("card.notClickable")}</span>
                </div>

                {/* Ribbon: coming soon */}
                <div className="pointer-events-none absolute -right-10 top-3 rotate-12">
                  <div className="rounded bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-3 py-1 text-[10px] font-semibold tracking-wider text-white shadow uppercase">
                    {t("card.ribbonSoon")}
                  </div>
                </div>
              </button>
            </motion.div>
          ))}
        </div>

        {/* Bottom info block */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
          className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5"
        >
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h4 className="text-sm font-semibold">{t("roadmap.title")}</h4>
              <p className="mt-1 text-xs text-white/70">
                {t("roadmap.priority")}
              </p>
            </div>
            <div className="text-xs text-white/60">{t("roadmap.note")}</div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
