// src/pages/HomePage.jsx
import React from "react";
import {
  ArrowRight,
  BarChart3,
  Wallet,
  LogIn,
  User,
  PlayCircle,
  Plug,
  Headphones,
  CalendarClock,
} from "lucide-react";

/* --- Helpers déjà utilisés précédemment --- */
function Pill({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-white/10 text-white/85 ring-1 ring-white/15">
      {icon}
      {children}
    </span>
  );
}
function useOnceInView(options) {
  const ref = React.useRef(null);
  const [seen, setSeen] = React.useState(false);
  React.useEffect(() => {
    if (!ref.current || seen) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          obs.disconnect();
        }
      },
      {
        root: null,
        threshold: 0.2,
        rootMargin: "0px 0px -10% 0px",
        ...(options || {}),
      }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [seen, options]);
  return [ref, seen];
}
function Counter({ to, duration = 1.2, decimals = 0 }) {
  const [val, setVal] = React.useState(decimals ? (0).toFixed(decimals) : 0);
  React.useEffect(() => {
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / (duration * 1000));
      const v = to * p;
      setVal(decimals ? v.toFixed(decimals) : Math.round(v));
      if (p < 1) requestAnimationFrame(step);
    };
    const id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [to, duration, decimals]);
  return <>{val}</>;
}
function FadeInOnView({ delay = 0, children, className = "" }) {
  const [ref, seen] = useOnceInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out ${className}`}
      style={{
        transitionDelay: `${delay}s`,
        transform: seen ? "none" : "translateY(12px)",
        opacity: seen ? 1 : 0,
      }}
    >
      {children}
    </div>
  );
}

export default function HomePage({ goTo = () => {} }) {
  const [refTime, seenTime] = useOnceInView();
  const [refMargin, seenMrg] = useOnceInView();
  const [refCash, seenCash] = useOnceInView();

  return (
    <div className="relative isolate bg-app text-white w-full">
      {/* HERO plus ample */}
      <header className="relative full-bleed hero-surface no-grid">
        <div className="hero-content relative max-w-7xl mx-auto w-full px-4 md:px-8 pt-20 pb-14 md:pt-28 md:pb-16 text-center">
          <div className="mb-5 flex flex-wrap gap-2 justify-center">
            <Pill
              icon={<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
            >
              IA intégrée
            </Pill>
            <Pill
              icon={<span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />}
            >
              Smart Forecast
            </Pill>
            <Pill
              icon={<span className="w-1.5 h-1.5 rounded-full bg-pink-400 inline-block" />}
            >
              Accès beta gratuit
            </Pill>
          </div>

          {/* Titre XL */}
          <h1 className="text-[56px] md:text-[88px] font-extrabold tracking-[-0.02em] leading-[1.05]">
            Vos{" "}
            <span className="text-glow bg-gradient-to-r from-[#e8ecff] via-[#cfd7ff] to-[#90c9ff] bg-clip-text text-transparent">
              données
            </span>
            , vos{" "}
            <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-green-300 bg-clip-text text-transparent">
              décisions
            </span>
            .
          </h1>

          <p className="mt-6 max-w-4xl mx-auto text-xl md:text-2xl text-white/90">
            Outil <span className="font-semibold">libre d’accès</span> pour visualiser vos KPI.
            <br className="hidden md:block" />
            Besoin d’aller vite ? Nos <span className="font-semibold">services d’onboarding</span> branchent vos données, configurent vos dashboards et forment l’équipe.
          </p>

          <div className="mt-9 flex flex-wrap gap-4 justify-center items-center">
            <button
              onClick={() => goTo("sales")}
              className="inline-flex items-center gap-2 rounded-full px-8 md:px-9 py-4 md:py-5 btn-blue-grad text-base md:text-lg font-semibold shadow-lg hover:shadow-xl ring-1 ring-white/10 transition"
            >
              🚀 Tester gratuitement en 30 s
              <ArrowRight className="w-5 h-5" />
            </button>

            <a
              href="/support"
              className="inline-flex items-center gap-2 rounded-full px-8 md:px-9 py-4 md:py-5 border border-white/15 bg-white/5 text-white hover:bg-white/10 text-base md:text-lg transition"
            >
              <CalendarClock className="w-5 h-5" />
              Onboarding & audit 15 min
            </a>
          </div>

          <div className="mt-4 text-sm text-white/65">
            Accès libre (bêta ouverte) • Services optionnels selon besoin
          </div>

          {/* KPI plus grands */}
          <div className="mt-12 grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <FadeInOnView>
              <div
                ref={refTime}
                className="rounded-3xl bg-white/6 backdrop-blur border border-white/12 px-6 py-6 text-white/90"
              >
                <div className="flex items-center gap-2 text-white/90">
                  <span className="inline-grid place-items-center w-8 h-8 rounded-md bg-emerald-500/20 ring-1 ring-white/15">
                    ✅
                  </span>
                  <div className="font-medium text-base">Temps gagné (reporting auto)</div>
                </div>
                <div className="mt-2 text-4xl md:text-5xl font-extrabold">
                  ~{seenTime ? <Counter to={8} duration={1.2} /> : 0} h{" "}
                  <span className="font-semibold text-2xl">/ semaine</span>
                </div>
                <div className="mt-1 text-sm text-white/70">
                  Moins de tableaux Excel, plus d’actions concrètes.
                </div>
              </div>
            </FadeInOnView>

            <FadeInOnView delay={0.08}>
              <div
                ref={refMargin}
                className="rounded-3xl bg-white/6 backdrop-blur border border-white/12 px-6 py-6 text-white/90"
              >
                <div className="flex items-center gap-2 text-white/90">
                  <span className="inline-grid place-items-center w-8 h-8 rounded-md bg-indigo-500/20 ring-1 ring-white/15">
                    📈
                  </span>
                  <div className="font-medium text-base">Marge (prix & mix)</div>
                </div>
                <div className="mt-2 text-4xl md:text-5xl font-extrabold">
                  +{seenMrg ? <Counter to={2.4} decimals={1} duration={1.2} /> : "0.0"}%
                  <span className="font-semibold text-2xl"> de marge</span>
                </div>
                <div className="mt-1 text-sm text-white/70">
                  Focus best-sellers, prix ajustés intelligemment.
                </div>
              </div>
            </FadeInOnView>

            <FadeInOnView delay={0.16}>
              <div
                ref={refCash}
                className="rounded-3xl bg-white/6 backdrop-blur border border-white/12 px-6 py-6 text-white/90"
              >
                <div className="flex items-center gap-2 text-white/90">
                  <span className="inline-grid place-items-center w-8 h-8 rounded-md bg-fuchsia-500/20 ring-1 ring-white/15">
                    🗓️
                  </span>
                  <div className="font-medium text-base">Anticipation trésorerie</div>
                </div>
                <div className="mt-2 text-4xl md:text-5xl font-extrabold">
                  {seenCash ? <Counter to={15} duration={1.2} /> : 0} j{" "}
                  <span className="font-semibold text-2xl">d’avance</span>
                </div>
                <div className="mt-1 text-sm text-white/70">
                  Alertes découvert avant qu’il n’arrive.
                </div>
              </div>
            </FadeInOnView>
          </div>
        </div>
      </header>

      {/* SECTION cartes — apparition au scroll */}
      <section className="relative py-12 md:py-14">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <h2 className="text-3xl md:text-4xl font-semibold text-white">Ce qui change la donne</h2>
          <p className="mt-2 text-base text-white/70">
            Outil gratuit pour explorer — services pour accélérer et industrialiser.
          </p>

          <div className="mt-7 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                title: "Prévisions auto",
                desc: "Choix du meilleur modèle sans réglages. Pas de tuning obscur.",
                icon: <BarChart3 className="w-4 h-4" />,
              },
              {
                title: "Trésorerie claire",
                desc: "Projetez votre solde en 30 s. Alerte tôt = décision sereine.",
                icon: <Wallet className="w-4 h-4" />,
              },
              {
                title: "Conseils IA",
                desc: "Recommandations compréhensibles, prêtes à agir.",
                icon: <ArrowRight className="w-4 h-4" />,
              },
              {
                title: "Respect des données",
                desc: "Imports locaux + connecteurs en lecture seule. Vos ventes restent privées.",
                icon: <LogIn className="w-4 h-4" />,
              },
            ].map((c, i) => (
              <FadeInOnView key={c.title} delay={i * 0.08}>
                <div className="rounded-2xl bg-white/8 backdrop-blur border border-white/12 p-5 text-white/90">
                  <div className="flex items-center gap-2 text-white">
                    <span className="inline-grid place-items-center w-7 h-7 rounded-md bg-indigo-500/25 ring-1 ring-white/15">
                      {c.icon}
                    </span>
                    <div className="font-medium">{c.title}</div>
                  </div>
                  <div className="mt-2 text-sm text-white/75">{c.desc}</div>
                </div>
              </FadeInOnView>
            ))}
          </div>
        </div>
      </section>

      {/* DEMOS RAPIDES — adapté services + nouveaux onglets */}
      <section className="relative full-bleed panel-surface py-14 md:py-20">
        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h3 className="text-2xl md:text-3xl font-semibold text-white">Passez à l’action</h3>
              <p className="text-sm text-white/70">
                Testez gratuitement, puis laissez-nous connecter et mettre en production.
              </p>
            </div>
            <div className="text-xs text-white/60">
              Astuce&nbsp;: <kbd>⌘</kbd>+<kbd>K</kbd> pour ouvrir la palette (bientôt)
            </div>
          </div>

          <div className="mt-8 grid md:grid-cols-12 gap-5">
            {/* Parcours principal — Ventes */}
            <button
              onClick={() => goTo("sales")}
              className="md:col-span-5 text-left rounded-3xl card-glass card-hover p-6 md:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-white/80 text-sm">Parcours principal</div>
                  <div className="mt-1 text-xl md:text-2xl font-semibold text-white">
                    Démo Ventes en 30&nbsp;s
                  </div>
                </div>
                <div className="chip">📈 KPI 30j</div>
              </div>

              <ul className="mt-4 space-y-2 text-sm text-white/80">
                <li>• Import CSV (ou connecteur), KPI instantanés</li>
                <li>• Prévisions automatiques & segmentation smart</li>
                <li>• Recos actionnables (prix, mix, best-sellers)</li>
              </ul>

              <div className="mt-5 inline-flex items-center gap-2 text-indigo-200">
                Lancer la démo
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 12h14m0 0-6-6m6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </button>

            {/* Raccourcis mis à jour */}
            <div className="md:col-span-7 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <button
                onClick={() => goTo("cash")}
                className="text-left rounded-3xl card-glass card-hover p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-grid place-items-center w-8 h-8 rounded-lg bg-emerald-500/20 ring-1 ring-white/15">💶</span>
                  <div className="text-lg font-medium text-white">Trésorerie & Alertes</div>
                </div>
                <p className="mt-2 text-sm text-white/75">
                  Projetez le solde, détectez les risques tôt, alertes automatiques.
                </p>
              </button>

              <button
                onClick={() => goTo("pricing")}
                className="text-left rounded-3xl card-glass card-hover p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-grid place-items-center w-8 h-8 rounded-lg bg-indigo-500/20 ring-1 ring-white/15">🏷️</span>
                  <div className="text-lg font-medium text-white">Pricing</div>
                </div>
                <p className="mt-2 text-sm text-white/75">
                  Optimisez marge & mix, simulez l’impact, appliquez les recos.
                </p>
              </button>

              <button
                onClick={() => goTo("eco")}
                className="text-left rounded-3xl card-glass card-hover p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-grid place-items-center w-8 h-8 rounded-lg bg-teal-500/20 ring-1 ring-white/15">♻️</span>
                  <div className="text-lg font-medium text-white">Éco-Label</div>
                </div>
                <p className="mt-2 text-sm text-white/75">
                  Intensité kg/€, décomposition, plan d’actions conforme.
                </p>
              </button>

              {/* Support & Onboarding (service) */}
              <a
                href="/support"
                className="text-left rounded-3xl card-glass card-hover p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-grid place-items-center w-8 h-8 rounded-lg bg-white/10 ring-1 ring-white/15">
                    <Headphones className="w-4 h-4" />
                  </span>
                  <div className="text-lg font-medium text-white">Support & Onboarding</div>
                </div>
                <p className="mt-2 text-sm text-white/75">
                  Setup clé en main, mapping données, formation. <strong>Audit 15 min offert.</strong>
                </p>
                <div className="mt-3 chip">Service</div>
              </a>

              {/* Connecteurs (non-fonctionnels) */}
              <a
                href="/connecteurs"
                className="relative text-left rounded-3xl card-glass card-hover p-5"
                title="Bientôt disponible"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-grid place-items-center w-8 h-8 rounded-lg bg-white/10 ring-1 ring-white/15">
                    <Plug className="w-4 h-4" />
                  </span>
                  <div className="text-lg font-medium text-white">Connecteurs</div>
                </div>
                <p className="mt-2 text-sm text-white/75">
                  Stripe, Banque (Bridge/Powens), Shopify/Presta… <em>aperçu visuel pour l’instant</em>.
                </p>
                <div className="mt-3 chip">Bientôt</div>
                <div className="pointer-events-none absolute -right-4 top-3 rotate-12">
                  <span className="rounded bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-2 py-0.5 text-[10px] font-semibold tracking-wider">DISPO BIENTÔT</span>
                </div>
              </a>
            </div>
          </div>

          {/* Bande d’aides cohérente avec services */}
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-white/60">
            <span className="chip">Glissez-déposez votre CSV pour démarrer</span>
            <span className="chip">Onboarding en &lt; 7 jours</span>
            <span className="chip">Audit gratuit 15 min</span>
          </div>
        </div>
      </section>

      {/* --- À PROPOS + VIDÉO --- */}
      <section className="relative py-14 md:py-20">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Colonne texte */}
            <FadeInOnView>
              <div className="rounded-3xl bg-white/6 backdrop-blur border border-white/12 p-6">
                <div className="inline-flex items-center gap-2 text-white/80 text-xs">
                  <span className="inline-grid place-items-center w-7 h-7 rounded-md bg-white/10 ring-1 ring-white/15">
                    <User className="w-4 h-4" />
                  </span>
                  <span>À propos</span>
                </div>
                <h3 className="mt-3 text-2xl md:text-3xl font-semibold">
                  InsightMate par{" "}
                  <span className="bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-indigo-300 bg-clip-text text-transparent">
                    Jérémy Duriez
                  </span>
                </h3>
                <p className="mt-3 text-white/80 text-sm leading-relaxed">
                  Outil gratuit pour tester, service pour accélérer. On connecte vos données,
                  on met vos KPI en production, on forme votre équipe — simplement.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href="#about-video"
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 border border-white/15 bg-white/5 hover:bg-white/10 transition text-sm"
                  >
                    <PlayCircle className="w-4 h-4" />
                    Regarder la vidéo (90s)
                  </a>
                  <a
                    href="/support"
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-white text-slate-900 hover:bg-white/90 transition text-sm font-semibold"
                  >
                    Découvrir l’onboarding
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </FadeInOnView>

            {/* Colonne vidéo */}
            <FadeInOnView delay={0.08}>
              <div id="about-video" className="relative rounded-3xl overflow-hidden border border-white/12 bg-white/6 backdrop-blur p-3">
                <div className="relative aspect-video w-full rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900">
                  {/* Placez ici votre iframe YouTube/Vimeo ou un <video> */}
                  <a href="#" title="Bientôt disponible" className="absolute inset-0 flex items-center justify-center">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm">
                      <PlayCircle className="h-5 w-5" />
                      Votre vidéo arrive
                    </span>
                  </a>
                </div>
                <div className="mt-3 text-xs text-white/60">
                  60–90s : qui vous êtes + ce qu’on fait en 3 clics → très bon taux de conversion.
                </div>
              </div>
            </FadeInOnView>
          </div>
        </div>
      </section>

      <footer className="py-10 text-center text-xs text-white/55 bg-app">
        © {new Date().getFullYear()} InsightMate — Démo · Créé par{" "}
        <span className="text-white/70 font-semibold">Jérémy Duriez</span>
      </footer>
    </div>
  );
}
