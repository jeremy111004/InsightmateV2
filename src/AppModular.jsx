// src/AppModular.jsx
import React from "react";
import "./index.css";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./components/LanguageSwitcher.jsx";
import FloatingLangSwitch from "./components/FloatingLangSwitch.jsx";

// Pages (code-splitting)
const HomePage = React.lazy(() => import("./pages/HomePage.jsx"));
const SalesDemo = React.lazy(() => import("./pages/SalesDemo.jsx"));
const ClientRisk = React.lazy(() => import("./pages/ClientRisk.jsx"));
const EcoLabelPage = React.lazy(() => import("./pages/EcoLabelPage.jsx"));
const PricingOptimizer = React.lazy(() =>
  import("./pages/PricingOptimizer.jsx")
);
const AccessProPage = React.lazy(() => import("./pages/AccessProPage.jsx"));
const RiskHub = React.lazy(() => import("./pages/RiskHub.jsx"));
const Connecteurs = React.lazy(() => import("./pages/Connecteurs.jsx"));

// Static list of keys (labels come from i18n)
const TAB_KEYS = new Set([
  "home",
  "sales",
  "cash",
  "eco",
  "pricing",
  "risk",
  "pro",
  "connectors", // ✅ manquait, nécessaire pour goTo/hash
]);

export default function AppModular() {
  const { t, i18n } = useTranslation();

  // Force a re-render when language changes (so labels update)
  const [, forceRender] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const onLang = () => forceRender();
    i18n.on("languageChanged", onLang);
    return () => i18n.off("languageChanged", onLang);
  }, [i18n]);

  // Build tabs using t() every render (simple & reliable)
  const TABS = [
    { key: "home", label: t("nav.home"), Comp: HomePage },
    { key: "sales", label: t("nav.sales"), Comp: SalesDemo },
    { key: "cash", label: t("nav.clientRisk"), Comp: ClientRisk },
    { key: "eco", label: t("nav.eco"), Comp: EcoLabelPage },
    { key: "pricing", label: t("nav.pricing"), Comp: PricingOptimizer },
    { key: "risk", label: t("nav.risk"), Comp: RiskHub },
    { key: "pro", label: t("nav.help"), Comp: AccessProPage },
    { key: "connectors", label: t("nav.connectors"), Comp: Connecteurs },
  ];

  // init: hash > localStorage > default
  const initial = React.useMemo(() => {
    const fromHash = (window.location.hash || "").replace(/^#/, "");
    if (TAB_KEYS.has(fromHash)) return fromHash;
    const saved = localStorage.getItem("app.activeTab");
    return TAB_KEYS.has(saved) ? saved : "home";
  }, []);

  const [tab, setTab] = React.useState(initial);

  // sync hash/back/forward
  React.useEffect(() => {
    const onHash = () => {
      const h = (window.location.hash || "").replace(/^#/, "");
      if (TAB_KEYS.has(h)) setTab(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [tab]);

  React.useEffect(() => {
    if (location.hash !== `#${tab}`) {
      history.replaceState(null, "", `#${tab}`);
    }
    localStorage.setItem("app.activeTab", tab);
  }, [tab]);

  const Active = (TABS.find((t) => t.key === tab) || TABS[0]).Comp;

  const isHome = tab === "home";
  const goTo = (key) => TAB_KEYS.has(key) && setTab(key);

  return (
    <div className="w-full min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {/* Navigation with desktop switcher on the right */}
      <nav className="sticky top-0 z-[60] nav-glass">
        <div
          className="max-w-7xl mx-auto w-full px-4 md:px-6 py-3 flex items-center justify-between gap-3"
          role="tablist"
          aria-label="Sections InsightMate"
        >
          {/* Left (optional placeholder for logo/title) */}
          <div className="hidden md:block text-sm opacity-70" />

          {/* Center: tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={active}
                  aria-controls={`panel-${t.key}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setTab(t.key)}
                  className={`px-4 md:px-5 py-2 md:py-2.5 rounded-2xl text-sm md:text-base border transition outline-offset-2 ${
                    active
                      ? "bg-gray-900/90 text-white dark:bg-white dark:text-gray-900 border-transparent"
                      : "bg-white/5 hover:bg-white/10 border-white/10 text-white"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Right: language switcher (desktop only) */}
          <div className="shrink-0 hidden md:block">
            <LanguageSwitcher />
          </div>
        </div>
      </nav>

      {/* Contenu */}
      <main className="w-full py-0">
        <ErrorBoundary>
          <section
            id={`panel-${tab}`}
            role="tabpanel"
            aria-labelledby={tab}
            className="outline-none"
          >
            <React.Suspense
              fallback={
                <div className="p-6 rounded-2xl border bg-gray-50 dark:bg-gray-900 border-gray-200/60 dark:border-gray-800 animate-pulse">
                  <div className="h-5 w-40 mb-4 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-3/4 mb-2 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-2/3 mb-2 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              }
            >
              <Active key={tab} {...(isHome ? { goTo } : {})} />
            </React.Suspense>
          </section>
        </ErrorBoundary>
      </main>

      {/* Mobile floating language switcher */}
      <FloatingLangSwitch />
    </div>
  );
}
