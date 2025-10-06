// src/AppModular.jsx
import React from "react";
import "./index.css";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Pages (code-splitting)
const HomePage = React.lazy(() => import("./pages/HomePage.jsx"));
const SalesDemo = React.lazy(() => import("./pages/SalesDemo.jsx"));
const CashflowDemo = React.lazy(() => import("./pages/CashflowDemo.jsx"));
const EcoLabelPage = React.lazy(() => import("./pages/EcoLabelPage.jsx"));
const PricingOptimizer = React.lazy(() =>
  import("./pages/PricingOptimizer.jsx")
);
const AccessProPage = React.lazy(() => import("./pages/AccessProPage.jsx"));

const TABS = [
  { key: "home", label: "Accueil", Comp: HomePage },
  { key: "sales", label: "Ventes", Comp: SalesDemo },
  { key: "cash", label: "Trésorerie", Comp: CashflowDemo },
  { key: "eco", label: "Éco-Label", Comp: EcoLabelPage },
  { key: "pricing", label: "Pricing", Comp: PricingOptimizer },
  { key: "pro", label: "Accès Pro", Comp: AccessProPage },
];

const TAB_KEYS = new Set(TABS.map((t) => t.key));

export default function AppModular() {
  // init: hash > localStorage > défaut
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
    // Safari/Chrome: remonte en haut pour déclencher les inView correctement
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [tab]);

  React.useEffect(() => {
    if (location.hash !== `#${tab}`) {
      history.replaceState(null, "", `#${tab}`);
    }
    localStorage.setItem("app.activeTab", tab);
  }, [tab]);

  const Active = (TABS.find((t) => t.key === tab) || TABS[0]).Comp;

  // ✅ 1) NOUVEAU: juste ça
  const isHome = tab === "home";
  const goTo = (key) => TAB_KEYS.has(key) && setTab(key);

  return (
    <div className="w-full min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 nav-glass">
        <div
          className="max-w-7xl mx-auto w-full px-4 md:px-6 py-3
               flex flex-wrap items-center justify-center
               gap-2 md:gap-3"
          role="tablist"
          aria-label="Sections InsightMate"
        >
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
              {/* ✅ 2) NOUVEAU: on passe goTo UNIQUEMENT à la Home */}
              <Active key={tab} {...(isHome ? { goTo } : {})} />
            </React.Suspense>
          </section>
        </ErrorBoundary>
      </main>
    </div>
  );
}
