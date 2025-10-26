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
  CreditCard,
  Lock,
  ChevronDown,
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
    ["2025-09-01","CMD-1001","Dupont SARL","Café Blend 1kg","CF-1KG",3,18.5,55.5,0.2,66.6,"Boutique","CB"],
    ["2025-09-01","CMD-1002","Martin & Fils","Abonnement Filtre","SUB-FLT",1,29,29,0.2,34.8,"En ligne","Stripe"],
    ["2025-09-02","CMD-1003","Boulangerie Lili","Moulin Pro","MLN-PRO",1,219,219,0.2,262.8,"B2B","Virement"],
    ["2025-09-03","CMD-1004","Cliente Walk-in","Espresso 250g","ESP-250",2,7.9,15.8,0.2,18.96,"Boutique","Espèces"],
    ["2025-09-04","CMD-1005","Atelier Rudy","Kit Dégustation","KIT-D",1,42,42,0.2,50.4,"En ligne","PayPal"],
    ["2025-09-05","CMD-1006","Société Colibri","Service Installation","SRV-INS",1,120,120,0.2,144,"B2B","Virement"],
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
  const [showPricing, setShowPricing] = React.useState(false);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      {/* Sticky top notice */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-2 text-xs text-white/70 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span>{t("top.notice", "Vous êtes sur une version beta publique — merci pour vos retours !")}</span>
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
                <span>{t("hero.badge", "Onboarding & Aide")}</span>
              </div>
              <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
                {t("hero.title.pre", "Besoin d’un coup de main pour")}{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
                  {t("hero.title.highlight", "démarrer vite")}
                </span>{" "}
                {t("hero.title.qmark", "?")}
                <br className="hidden md:block" />
                {t("hero.title.line2", "Voici le guide express.")}
              </h1>
              <p className="mt-3 text-sm text-white/75">
                {t("hero.text", "Nous sommes en beta publique. Attendez-vous à des évolutions rapides et dites-nous ce qui compte pour vous.")}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <a
                  href="mailto:contact@insightmate.app?subject=Audit%20gratuit%2015%20min&body=Bonjour%2C%20je%20souhaite%20planifier%20un%20audit%20gratuit%20de%2015%20minutes."
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-slate-900 px-4 py-2 text-sm font-semibold hover:bg-white/90 transition shadow"
                >
                  <CalendarClock className="h-4 w-4" />
                  {t("hero.cta.audit", "Audit gratuit 15 min")}
                  <ArrowRight className="h-4 w-4" />
                </a>
                <button
                  onClick={downloadSampleCSV}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                  title={t("hero.cta.csvTitle", "Télécharger un modèle de données (CSV)")}
                >
                  <FileDown className="h-4 w-4" />
                  {t("hero.cta.csv", "Modèle CSV")}
                </button>
                <a
                  href="#beta-pricing"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                >
                  <Lock className="h-4 w-4" />
                  {t("hero.cta.beta", "Comment marche la beta ?")}
                </a>
              </div>

              <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/60">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                  {t("hero.checks.fastDeploy", "Mise en route en quelques minutes")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                  {t("hero.checks.secureData", "Données sécurisées")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                  {t("hero.checks.noCode", "Zero code requis")}
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
                    <LineChart className="h-4 w-4" /> {t("hero.kpi.headerLeft", "Tableau de bord")}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-4 w-4" /> {t("hero.kpi.headerRight", "Temps réel")}
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
                    {t("hero.kpi.ca30", "CA 30j")}
                    <br />
                    <span className="text-white">+12%</span>
                  </div>
                  <div className="rounded border border-white/10 bg-white/5 p-2">
                    {t("hero.kpi.basket", "Panier moyen")}
                    <br />
                    <span className="text-white">€18.9</span>
                  </div>
                  <div className="rounded border border-white/10 bg-white/5 p-2">
                    {t("hero.kpi.runway", "Trésorerie")}
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
          {t("quick.title", "Démarrage rapide")}
        </motion.h2>
        <motion.p {...fade(0.08)} className="mt-1 text-sm text-white/70 max-w-2xl">
          {t("quick.subtitle", "Trois actions pour obtenir vos premiers insights.")}
        </motion.p>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            { title: t("quick.cards.1.title", "1/ Importer un exemple"),
              desc: t("quick.cards.1.desc", "Téléchargez un CSV modèle et testez avec vos données."),
              Icon: FileDown, pill: t("quick.cards.1.pill", "1 minute") },
            { title: t("quick.cards.2.title", "2/ Brancher vos sources"),
              desc: t("quick.cards.2.desc", "Connectez vos canaux de vente et paiements en 1 clic."),
              Icon: Shield, pill: t("quick.cards.2.pill", "Sécurisé") },
            { title: t("quick.cards.3.title", "3/ Lancer une analyse"),
              desc: t("quick.cards.3.desc", "Obtenez des recommandations actionnables immédiatement."),
              Icon: Rocket, pill: t("quick.cards.3.pill", "IA intégrée") },
          ].map((s, i) => (
            <motion.div key={s.title} {...fade(0.05 + i * 0.05)}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
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
                {s.Icon === FileDown && (
                  <button
                    onClick={downloadSampleCSV}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 transition"
                  >
                    <FileDown className="h-3.5 w-3.5" /> {t("quick.cards.csvButton", "Télécharger le CSV")}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* BETA & PRICING POLICY */}
      <section id="beta-pricing" className="mx-auto max-w-6xl px-4 pt-6 pb-2">
        <motion.div {...fade(0.05)} className="rounded-2xl border border-white/12 bg-white/6 backdrop-blur p-5">
          <div className="flex items-start gap-3">
            <span className="inline-grid place-items-center w-9 h-9 rounded-lg bg-indigo-500/20 ring-1 ring-white/15">
              <Lock className="w-4 h-4 text-indigo-200" />
            </span>
            <div>
              <div className="text-xs uppercase tracking-wide text-white/70">
                {t("beta.badge", "Beta publique")}
              </div>
              <h2 className="text-lg md:text-xl font-semibold mt-0.5">
                {t("beta.title", "Gratuit pendant la beta — option prix fondateur")}
              </h2>
              <p className="mt-2 text-xs text-white/75">
                {t("beta.text",
                  "Vous pouvez tester InsightMate gratuitement pendant la beta. Si vous le souhaitez, vous pouvez ‘verrouiller’ un prix fondateur réduit dès maintenant : vous ne paierez qu’au lancement officiel (pas de carte requise pour tester).")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href="mailto:contact@insightmate.app?subject=Rejoindre%20la%20beta&body=Bonjour%2C%20je%20souhaite%20rejoindre%20la%20beta%20publique."
                  className="inline-flex items-center gap-2 rounded-lg bg-white text-slate-900 px-3 py-1.5 text-xs font-semibold hover:bg-white/90 transition shadow"
                >
                  <Sparkles className="h-3.5 w-3.5" /> {t("beta.cta.join", "Rejoindre la beta (gratuit)")}
                </a>
                <a
                  href="mailto:contact@insightmate.app?subject=Prix%20fondateur&body=Bonjour%2C%20je%20souhaite%20verrouiller%20le%20prix%20fondateur."
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 transition"
                >
                  <CreditCard className="h-3.5 w-3.5" /> {t("beta.cta.lock", "Verrouiller mon prix fondateur")}
                </a>
              </div>
              <div className="mt-3 text-[11px] text-white/55">
                {t("beta.disclaimer", "Aucun paiement requis pour accéder à la beta. Offre fondateur limitée dans le temps.")}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* USE CASES */}
      <section className="mx-auto max-w-6xl px-4 pt-6 pb-2">
        <motion.h3 {...fade(0.05)} className="text-lg font-semibold">
          {t("usecases.title", "Cas d’usage")}
        </motion.h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { Icon: Coffee, title: t("usecases.cards.cafe.title", "Café / CHR"),
              bullets: [t("usecases.cards.cafe.bullets.0","Optimisez vos marges"), t("usecases.cards.cafe.bullets.1","Anticipez la demande"), t("usecases.cards.cafe.bullets.2","Gérez les stocks finement")],
              stat: t("usecases.cards.cafe.stat","+2–4 pts de marge") },
            { Icon: ShoppingBag, title: t("usecases.cards.ecom.title", "E-commerce"),
              bullets: [t("usecases.cards.ecom.bullets.0","Identifiez vos best-sellers"), t("usecases.cards.ecom.bullets.1","Pilotage multi-canal"), t("usecases.cards.ecom.bullets.2","Cohorte clients & LTV")],
              stat: t("usecases.cards.ecom.stat","Panier moyen +8%") },
            { Icon: Briefcase, title: t("usecases.cards.b2b.title", "B2B / Services"),
              bullets: [t("usecases.cards.b2b.bullets.0","Cycle de vente plus court"), t("usecases.cards.b2b.bullets.1","Pricing & offres"), t("usecases.cards.b2b.bullets.2","Prévisions fiables")],
              stat: t("usecases.cards.b2b.stat","Deal size +12%") },
          ].map((c, i) => (
            <motion.div key={c.title} {...fade(0.06 + i * 0.05)}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
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

      {/* SERVICE PACKAGES (collapsible) */}
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-2">
        <div className="flex items-center justify-between">
          <motion.h3 {...fade(0.05)} className="text-lg font-semibold">
            {t("services.title", "Formules d’accompagnement")}
          </motion.h3>
          <button
            onClick={() => setShowPricing((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 hover:bg-white/10 transition"
            aria-expanded={showPricing}
            aria-controls="pricing-grid"
          >
            <CreditCard className="h-3.5 w-3.5" />
            {showPricing
              ? t("services.toggle.hide", "Masquer les prix d’accès anticipé")
              : t("services.toggle.show", "Voir les prix d’accès anticipé")}
            <ChevronDown
              className={`h-3.5 w-3.5 transition ${showPricing ? "rotate-180" : ""}`}
            />
          </button>
        </div>
        <motion.p {...fade(0.07)} className="mt-1 text-sm text-white/70 max-w-2xl">
          {t("services.subtitle.prefix", "Choisissez votre mode :")}{" "}
          <strong>{t("services.modes.dfy", "On fait pour vous")}</strong>,{" "}
          <strong>{t("services.modes.dwy", "On fait avec vous")}</strong>{" "}
          {t("services.subtitle.or", "ou")}{" "}
          <strong>{t("services.modes.self", "Autonome")}</strong>.{" "}
          <span className="text-white/60">
            {t("services.betaNote", "Pendant la beta : utilisation du produit gratuite. Les formules ci-dessous sont optionnelles.")}
          </span>
        </motion.p>

        {showPricing && (
          <div id="pricing-grid" className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              {
                name: t("services.packages.dfy.name", "On fait pour vous"),
                tagline: t("services.packages.dfy.tagline", "Mise en place clé en main"),
                price: t("services.packages.dfy.price", "Sur devis"),
                points: [
                  t("services.packages.dfy.points.0", "Intégration données"),
                  t("services.packages.dfy.points.1", "Tableaux & KPIs"),
                  t("services.packages.dfy.points.2", "Coaching 1:1"),
                ],
                highlight: true,
              },
              {
                name: t("services.packages.dwy.name", "On fait avec vous"),
                tagline: t("services.packages.dwy.tagline", "Sessions guidées"),
                price: t("services.packages.dwy.price", "à partir de 690€"),
                points: [
                  t("services.packages.dwy.points.0", "Ateliers d’implémentation"),
                  t("services.packages.dwy.points.1", "Bonnes pratiques"),
                  t("services.packages.dwy.points.2", "Support prioritaire"),
                ],
                highlight: false,
              },
              {
                name: t("services.packages.self.name", "Autonome"),
                tagline: t("services.packages.self.tagline", "Vous pilotez"),
                price: t("services.packages.self.price", "0€ pendant la beta"),
                points: [
                  t("services.packages.self.points.0", "Accès produit complet (beta)"),
                  t("services.packages.self.points.1", "Docs & modèles"),
                  t("services.packages.self.points.2", "Communauté"),
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
                    {t("services.recommended", "Recommandé")}
                  </div>
                )}
                <div className="relative">
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="mt-1 text-xs text-white/70">{p.tagline}</div>
                  <div className="mt-3 text-sm">
                    <span className="text-white/80">
                      {t("services.priceLabel", "Tarif")}{" "}
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
                      {t("services.buttons.contact", "Contacter")}
                    </a>
                    <a
                      href="tel:+33000000000"
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 transition"
                    >
                      <Phone className="h-3.5 w-3.5" />{" "}
                      {t("services.buttons.call", "Appeler")}
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* SOCIAL PROOF / METRICS */}
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-2">
        <motion.div {...fade(0.05)} className="grid gap-4 md:grid-cols-3">
          {[
            { label: t("metrics.setup.label", "Mise en place"), value: t("metrics.setup.value", "< 30 min") },
            { label: t("metrics.gain.label", "Gain moyen"), value: t("metrics.gain.value", "+8–15%") },
            { label: t("metrics.errors.label", "Erreurs évitées"), value: t("metrics.errors.value", "-35%") },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/70">{m.label}</div>
              <div className="mt-1 text-lg font-semibold">{m.value}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* DEMO VIDEO PLACEHOLDER */}
      <section id="demo-video" className="mx-auto max-w-6xl px-4 pt-8 pb-2">
        <motion.h3 {...fade(0.05)} className="text-lg font-semibold">
          {t("demo.title", "Démo vidéo")}
        </motion.h3>
        <motion.div {...fade(0.08)} className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="relative aspect-video w-full rounded-xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900">
            <a href="#" title={t("demo.soonTitle", "Bientôt dispo")} className="absolute inset-0 flex items-center justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm">
                <PlayCircle className="h-5 w-5" />
                {t("demo.soon", "Bientôt en ligne")}
              </div>
            </a>
          </div>
        </motion.div>
      </section>

      {/* FAQ COURTE */}
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-8">
        <motion.h3 {...fade(0.05)} className="text-lg font-semibold">
          {t("faq.title", "FAQ")}
        </motion.h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {[
            { q: t("faq.items.0.q", "La beta est-elle gratuite ?"), a: t("faq.items.0.a", "Oui. Aucune carte requise. Certaines fonctions peuvent évoluer.") },
            { q: t("faq.items.1.q", "Puis-je verrouiller un tarif ?"), a: t("faq.items.1.a", "Oui, option ‘prix fondateur’ pendant la beta. Paiement uniquement au lancement officiel.") },
            { q: t("faq.items.2.q", "Comment donner mon avis ?"), a: t("faq.items.2.a", "Écrivez-nous ou répondez aux mini-sondages intégrés. Vos retours guident notre roadmap.") },
            { q: t("faq.items.3.q", "Mes données sont-elles protégées ?"), a: t("faq.items.3.a", "Oui. Chiffrement en transit, bonnes pratiques de sécurité et isolation des comptes.") },
            { q: t("faq.items.4.q", "Combien de temps dure la beta ?"), a: t("faq.items.4.a", "Nous visons un lancement public dès que la stabilité et la valeur sont validées.") },
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
        <motion.div {...fade(0.05)} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-tr from-indigo-500/10 via-fuchsia-500/10 to-cyan-500/10 blur-2xl" />
          <div className="relative flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10">
                <User className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm font-semibold">
                  {t("creator.byPrefix", "Créé par")}{" "}
                  <span className="bg-gradient-to-r from-cyan-300 to-fuchsia-300 bg-clip-text text-transparent">
                    Jérémy Duriez
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-white/75">
                  {t("creator.subtitle", "Entrepreneur & data")}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href="mailto:contact@insightmate.app?subject=Onboarding"
                className="inline-flex items-center gap-2 rounded-lg bg-white text-slate-900 px-3 py-1.5 text-xs font-semibold hover:bg-white/90 transition shadow"
              >
                <Mail className="h-3.5 w-3.5" /> {t("creator.buttons.contact", "Contacter")}
              </a>
              <a
                href="tel:+33000000000"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 transition"
              >
                <Phone className="h-3.5 w-3.5" /> {t("creator.buttons.call", "Appeler")}
              </a>
            </div>
          </div>
        </motion.div>

        {/* Footer micro-credit (optionnel si tu as déjà un SiteCredit global) */}
        <div className="mt-4 text-center text-[11px] text-white/50">
          © {new Date().getFullYear()} InsightMate — {t("footer.createdBy", "créé par")}{" "}
          <span className="text-white/70 font-semibold">Jérémy Duriez</span>.
        </div>
      </section>
    </div>
  );
}
