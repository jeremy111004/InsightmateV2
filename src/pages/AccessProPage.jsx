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
import { useTranslation } from "react-i18next";

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
    [
      "2025-09-01",
      "CMD-1001",
      "Dupont SARL",
      "Café Blend 1kg",
      "CF-1KG",
      3,
      18.5,
      55.5,
      0.2,
      66.6,
      "Boutique",
      "CB",
    ],
    [
      "2025-09-01",
      "CMD-1002",
      "Martin & Fils",
      "Abonnement Filtre",
      "SUB-FLT",
      1,
      29,
      29,
      0.2,
      34.8,
      "En ligne",
      "Stripe",
    ],
    [
      "2025-09-02",
      "CMD-1003",
      "Boulangerie Lili",
      "Moulin Pro",
      "MLN-PRO",
      1,
      219,
      219,
      0.2,
      262.8,
      "B2B",
      "Virement",
    ],
    [
      "2025-09-03",
      "CMD-1004",
      "Cliente Walk-in",
      "Espresso 250g",
      "ESP-250",
      2,
      7.9,
      15.8,
      0.2,
      18.96,
      "Boutique",
      "Espèces",
    ],
    [
      "2025-09-04",
      "CMD-1005",
      "Atelier Rudy",
      "Kit Dégustation",
      "KIT-D",
      1,
      42,
      42,
      0.2,
      50.4,
      "En ligne",
      "PayPal",
    ],
    [
      "2025-09-05",
      "CMD-1006",
      "Société Colibri",
      "Service Installation",
      "SRV-INS",
      1,
      120,
      120,
      0.2,
      144,
      "B2B",
      "Virement",
    ],
  ];
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
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
  const { t } = useTranslation("support");

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      {/* Sticky top notice */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-2 text-xs text-white/70 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span>{t("top.notice")}</span>
        </div>
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_180px_at_15%_-10%,rgba(56,189,248,0.17),transparent)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_180px_at_85%_-10%,rgba(168,85,247,0.15),transparent)]" />
        <div className="mx-auto max-w-6xl px-4 pt-12 pb-10">
          <motion.div
            {...fade(0.05, 8, 0.55)}
            className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"
          >
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                <Sparkles className="h-4 w-4" />
                <span>{t("hero.badge")}</span>
              </div>
              <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
                {t("hero.title.pre")}{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
                  {t("hero.title.highlight")}
                </span>{" "}
                {t("hero.title.qmark")}
                <br className="hidden md:block" />
                {t("hero.title.line2")}
              </h1>
              <p className="mt-3 text-sm text-white/75">{t("hero.text")}</p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <a
                  href="mailto:contact@insightmate.app?subject=Audit%20gratuit%2015%20min&body=Bonjour%2C%20je%20souhaite%20planifier%20un%20audit%20gratuit%20de%2015%20minutes."
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-slate-900 px-4 py-2 text-sm font-semibold hover:bg-white/90 transition shadow"
                >
                  <CalendarClock className="h-4 w-4" />
                  {t("hero.cta.audit")}
                  <ArrowRight className="h-4 w-4" />
                </a>
                <button
                  onClick={downloadSampleCSV}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                  title={t("hero.cta.csvTitle")}
                >
                  <FileDown className="h-4 w-4" />
                  {t("hero.cta.csv")}
                </button>
                <a
                  href="#demo-video"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                >
                  <PlayCircle className="h-4 w-4" />
                  {t("hero.cta.video")}
                </a>
              </div>

              <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/60">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                  {t("hero.checks.fastDeploy")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                  {t("hero.checks.secureData")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                  {t("hero.checks.noCode")}
                </span>
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
                    <LineChart className="h-4 w-4" /> {t("hero.kpi.headerLeft")}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-4 w-4" /> {t("hero.kpi.headerRight")}
                  </span>
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
                  <div className="rounded border border-white/10 bg-white/5 p-2">
                    {t("hero.kpi.ca30")}
                    <br />
                    <span className="text-white">+12%</span>
                  </div>
                  <div className="rounded border border-white/10 bg-white/5 p-2">
                    {t("hero.kpi.basket")}
                    <br />
                    <span className="text-white">€18.9</span>
                  </div>
                  <div className="rounded border border-white/10 bg-white/5 p-2">
                    {t("hero.kpi.runway")}
                    <br />
                    <span className="text-white">42 j</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* QUICK START */}
      <section className="mx-auto max-w-6xl px-4 pt-6 pb-4">
        <motion.h2 {...fade(0.05)} className="text-xl font-semibold">
          {t("quick.title")}
        </motion.h2>
        <motion.p
          {...fade(0.08)}
          className="mt-1 text-sm text-white/70 max-w-2xl"
        >
          {t("quick.subtitle")}
        </motion.p>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            {
              title: t("quick.cards.1.title"),
              desc: t("quick.cards.1.desc"),
              Icon: FileDown,
              pill: t("quick.cards.1.pill"),
            },
            {
              title: t("quick.cards.2.title"),
              desc: t("quick.cards.2.desc"),
              Icon: Shield,
              pill: t("quick.cards.2.pill"),
            },
            {
              title: t("quick.cards.3.title"),
              desc: t("quick.cards.3.desc"),
              Icon: Rocket,
              pill: t("quick.cards.3.pill"),
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
                    <FileDown className="h-3.5 w-3.5" />{" "}
                    {t("quick.cards.csvButton")}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* USE CASES */}
      <section className="mx-auto max-w-6xl px-4 pt-6 pb-2">
        <motion.h3 {...fade(0.05)} className="text-lg font-semibold">
          {t("usecases.title")}
        </motion.h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            {
              Icon: Coffee,
              title: t("usecases.cards.cafe.title"),
              bullets: [
                t("usecases.cards.cafe.bullets.0"),
                t("usecases.cards.cafe.bullets.1"),
                t("usecases.cards.cafe.bullets.2"),
              ],
              stat: t("usecases.cards.cafe.stat"),
            },
            {
              Icon: ShoppingBag,
              title: t("usecases.cards.ecom.title"),
              bullets: [
                t("usecases.cards.ecom.bullets.0"),
                t("usecases.cards.ecom.bullets.1"),
                t("usecases.cards.ecom.bullets.2"),
              ],
              stat: t("usecases.cards.ecom.stat"),
            },
            {
              Icon: Briefcase,
              title: t("usecases.cards.b2b.title"),
              bullets: [
                t("usecases.cards.b2b.bullets.0"),
                t("usecases.cards.b2b.bullets.1"),
                t("usecases.cards.b2b.bullets.2"),
              ],
              stat: t("usecases.cards.b2b.stat"),
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
                  {c.bullets.map((b) => (
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
        <motion.h3 {...fade(0.05)} className="text-lg font-semibold">
          {t("services.title")}
        </motion.h3>
        <motion.p
          {...fade(0.07)}
          className="mt-1 text-sm text-white/70 max-w-2xl"
        >
          {t("services.subtitle.prefix")}{" "}
          <strong>{t("services.modes.dfy")}</strong>,{" "}
          <strong>{t("services.modes.dwy")}</strong> {t("services.subtitle.or")}{" "}
          <strong>{t("services.modes.self")}</strong>.
        </motion.p>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            {
              name: t("services.packages.dfy.name"),
              tagline: t("services.packages.dfy.tagline"),
              price: t("services.packages.dfy.price"),
              points: [
                t("services.packages.dfy.points.0"),
                t("services.packages.dfy.points.1"),
                t("services.packages.dfy.points.2"),
              ],
              highlight: true,
            },
            {
              name: t("services.packages.dwy.name"),
              tagline: t("services.packages.dwy.tagline"),
              price: t("services.packages.dwy.price"),
              points: [
                t("services.packages.dwy.points.0"),
                t("services.packages.dwy.points.1"),
                t("services.packages.dwy.points.2"),
              ],
              highlight: false,
            },
            {
              name: t("services.packages.self.name"),
              tagline: t("services.packages.self.tagline"),
              price: t("services.packages.self.price"),
              points: [
                t("services.packages.self.points.0"),
                t("services.packages.self.points.1"),
                t("services.packages.self.points.2"),
              ],
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
                  {t("services.recommended")}
                </div>
              )}
              <div className="relative">
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="mt-1 text-xs text-white/70">{p.tagline}</div>
                <div className="mt-3 text-sm">
                  <span className="text-white/80">
                    {t("services.priceLabel")}{" "}
                  </span>
                  <span className="font-semibold">{p.price}</span>
                </div>
                <ul className="mt-3 space-y-1 text-xs text-white/75">
                  {p.points.map((pt) => (
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
                    <Mail className="h-3.5 w-3.5" />{" "}
                    {t("services.buttons.contact")}
                  </a>
                  <a
                    href="tel:+33000000000"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 transition"
                  >
                    <Phone className="h-3.5 w-3.5" />{" "}
                    {t("services.buttons.call")}
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* SOCIAL PROOF / METRICS */}
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-2">
        <motion.div {...fade(0.05)} className="grid gap-4 md:grid-cols-3">
          {[
            {
              label: t("metrics.setup.label"),
              value: t("metrics.setup.value"),
            },
            { label: t("metrics.gain.label"), value: t("metrics.gain.value") },
            {
              label: t("metrics.errors.label"),
              value: t("metrics.errors.value"),
            },
          ].map((m, i) => (
            <div
              key={m.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="text-xs text-white/70">{m.label}</div>
              <div className="mt-1 text-lg font-semibold">{m.value}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* DEMO VIDEO PLACEHOLDER */}
      <section id="demo-video" className="mx-auto max-w-6xl px-4 pt-8 pb-2">
        <motion.h3 {...fade(0.05)} className="text-lg font-semibold">
          {t("demo.title")}
        </motion.h3>
        <motion.div
          {...fade(0.08)}
          className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3"
        >
          <div className="relative aspect-video w-full rounded-xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900">
            <a
              href="#"
              title={t("demo.soonTitle")}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm">
                <PlayCircle className="h-5 w-5" />
                {t("demo.soon")}
              </div>
            </a>
          </div>
        </motion.div>
      </section>

      {/* FAQ COURTE */}
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-8">
        <motion.h3 {...fade(0.05)} className="text-lg font-semibold">
          {t("faq.title")}
        </motion.h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {[
            { q: t("faq.items.0.q"), a: t("faq.items.0.a") },
            { q: t("faq.items.1.q"), a: t("faq.items.1.a") },
            { q: t("faq.items.2.q"), a: t("faq.items.2.a") },
            { q: t("faq.items.3.q"), a: t("faq.items.3.a") },
            { q: t("faq.items.4.q"), a: t("faq.items.4.a") },
          ].map(({ q, a }, i) => (
            <motion.div
              key={q}
              {...fade(0.06 + i * 0.04)}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
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
                <div className="text-sm font-semibold">
                  {t("creator.byPrefix")}{" "}
                  <span className="bg-gradient-to-r from-cyan-300 to-fuchsia-300 bg-clip-text text-transparent">
                    Jérémy Duriez
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-white/75">
                  {t("creator.subtitle")}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href="mailto:contact@insightmate.app?subject=Onboarding"
                className="inline-flex items-center gap-2 rounded-lg bg-white text-slate-900 px-3 py-1.5 text-xs font-semibold hover:bg-white/90 transition shadow"
              >
                <Mail className="h-3.5 w-3.5" /> {t("creator.buttons.contact")}
              </a>
              <a
                href="tel:+33000000000"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 transition"
              >
                <Phone className="h-3.5 w-3.5" /> {t("creator.buttons.call")}
              </a>
            </div>
          </div>
        </motion.div>

        {/* Footer micro-credit (optionnel si tu as déjà un SiteCredit global) */}
        <div className="mt-4 text-center text-[11px] text-white/50">
          © {new Date().getFullYear()} InsightMate — {t("footer.createdBy")}{" "}
          <span className="text-white/70 font-semibold">Jérémy Duriez</span>.
        </div>
      </section>
    </div>
  );
}
