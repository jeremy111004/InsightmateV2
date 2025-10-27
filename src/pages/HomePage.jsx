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
} from "lucide-react";
import { useTranslation } from "react-i18next";

/* Helpers */
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
      className={"transition-all duration-500 ease-out " + (className || "")}
      style={{
        transitionDelay: (delay || 0) + "s",
        transform: seen ? "none" : "translateY(12px)",
        opacity: seen ? 1 : 0,
      }}
    >
      {children}
    </div>
  );
}

export default function HomePage({ goTo = () => {} }) {
  const { t, i18n } = useTranslation("home");
  const [refTime, seenTime] = useOnceInView();
  const [refMargin, seenMrg] = useOnceInView();
  const [refCash, seenCash] = useOnceInView();

  /* --- Sélecteur de langue vidéo --- */
  const initialLang = (i18n.language || "fr").slice(0, 2);
  const [videoLang, setVideoLang] = React.useState(
    ["fr", "en", "es"].includes(initialLang) ? initialLang : "en"
  );

  // Sync si i18n change (ex: ?lng=es)
  React.useEffect(() => {
    const code = (i18n.language || "fr").slice(0, 2);
    if (["fr", "en", "es"].includes(code)) setVideoLang(code);
  }, [i18n.language]);

  // Fichiers à la racine de /public (pas de /videos/)
  const videoSrc = React.useMemo(() => {
    const map = {
      fr: "/introfr.mp4",
      en: "/introen.mp4",
      es: "/introes.mp4",
    };
    const base = map[videoLang] || map.en;
    return base + "?v=1"; // cache-bust simple
  }, [videoLang]);

  const onVideoError = (e) => {
    const v = e.currentTarget;
    console.error("VIDEO ERROR", {
      mediaError: v?.error,
      networkState: v?.networkState,
      readyState: v?.readyState,
      currentSrc: v?.currentSrc,
    });
  };

  return (
    <div className="relative isolate bg-app text-white w-full">
      {/* HERO */}
      <header className="relative full-bleed hero-surface no-grid">
        <div className="hero-content relative max-w-7xl mx-auto w-full px-4 md:px-8 pt-20 pb-14 md:pt-28 md:pb-16 text-center">
          <div className="mb-5 flex flex-wrap gap-2 justify-center">
            <Pill
              icon={
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              }
            >
              {t("hero.badge.ai")}
            </Pill>
            <Pill
              icon={
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
              }
            >
              {t("hero.badge.forecast")}
            </Pill>
            <Pill
              icon={
                <span className="w-1.5 h-1.5 rounded-full bg-pink-400 inline-block" />
              }
            >
              {t("hero.badge.beta")}
            </Pill>
          </div>

          <h1 className="text-[56px] md:text-[88px] font-extrabold tracking-[-0.02em] leading-[1.05]">
            {t("hero.title1")}{" "}
            <span className="text-glow bg-gradient-to-r from-[#e8ecff] via-[#cfd7ff] to-[#90c9ff] bg-clip-text text-transparent">
              {t("hero.title2")}
            </span>
            , {t("hero.title3")}{" "}
            <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-green-300 bg-clip-text text-transparent">
              {t("hero.title4")}
            </span>
            .
          </h1>

          <p className="mt-6 max-w-4xl mx-auto text-xl md:text-2xl text-white/90">
            {t("hero.p1.before")}{" "}
            <span className="font-semibold">{t("hero.p1.bold")}</span>{" "}
            {t("hero.p1.after")}
            <br className="hidden md:block" />
            {t("hero.p2.before")}{" "}
            <span className="font-semibold">{t("hero.p2.bold")}</span>{" "}
            {t("hero.p2.after")}
          </p>

          <div className="mt-9 flex flex-wrap gap-4 justify-center items-center">
            <button
  onClick={() => goTo("sales")}
  className="relative group md:col-span-5 text-left rounded-3xl p-7 md:p-8 bg-gradient-to-br from-white/8 via-white/5 to-transparent backdrop-blur-md border border-white/10 hover:border-indigo-400/30 shadow-[0_0_40px_-10px_rgba(99,102,241,0.3)] transition-all duration-300 overflow-hidden"
>
  {/* subtle animated gradient overlay */}
  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-fuchsia-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

  {/* HEADER */}
  <div className="relative flex items-start justify-between gap-4">
    <div>
      <div className="text-white/70 text-sm font-medium tracking-wide uppercase">
        {t("cta.sales.overline")}
      </div>
      <div className="mt-1 text-2xl md:text-3xl font-bold text-white leading-snug">
        {t("cta.sales.title")}
      </div>
    </div>
    <div className="chip bg-indigo-500/20 text-indigo-200 border border-indigo-400/20 backdrop-blur-sm">
      {t("cta.sales.chip")}
    </div>
  </div>

  {/* CONTENT LIST */}
  <ul className="mt-5 space-y-2 text-sm text-white/80">
    <li className="flex items-center gap-2">
      <span className="text-indigo-400">•</span>
      {t("cta.sales.items.0")}
    </li>
    <li className="flex items-center gap-2">
      <span className="text-indigo-400">•</span>
      {t("cta.sales.items.1")}
    </li>
    <li className="flex items-center gap-2">
      <span className="text-indigo-400">•</span>
      {t("cta.sales.items.2")}
    </li>
  </ul>

  {/* CTA LINK */}
  <div className="relative mt-6 inline-flex items-center gap-2 text-indigo-300 font-medium group-hover:text-indigo-200 transition">
    {t("cta.sales.link")}
    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
  </div>

  {/* Decorative pulse ring */}
  <div className="absolute -right-10 -bottom-10 w-32 h-32 rounded-full bg-indigo-500/10 blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700" />
</button>

          </div>

          <div className="mt-4 text-sm text-white/65">
            {t("hero.disclaimer")}
          </div>

          {/* KPIs */}
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
                  <div className="font-medium text-base">
                    {t("kpi.time.title")}
                  </div>
                </div>
                <div className="mt-2 text-4xl md:text-5xl font-extrabold">
                  ~{seenTime ? <Counter to={8} duration={1.2} /> : 0}{" "}
                  {t("kpi.time.abbr")}{" "}
                  <span className="font-semibold text-2xl">
                    {t("kpi.time.unit")}
                  </span>
                </div>
                <div className="mt-1 text-sm text-white/70">
                  {t("kpi.time.desc")}
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
                  <div className="font-medium text-base">
                    {t("kpi.margin.title")}
                  </div>
                </div>
                <div className="mt-2 text-4xl md:text-5xl font-extrabold">
                  +
                  {seenMrg ? (
                    <Counter to={2.4} decimals={1} duration={1.2} />
                  ) : (
                    "0.0"
                  )}
                  %
                  <span className="font-semibold text-2xl">
                    {" "}
                    {t("kpi.margin.unitText")}
                  </span>
                </div>
                <div className="mt-1 text-sm text-white/70">
                  {t("kpi.margin.desc")}
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
                  <div className="font-medium text-base">
                    {t("kpi.cash.title")}
                  </div>
                </div>
                <div className="mt-2 text-4xl md:text-5xl font-extrabold">
                  {seenCash ? <Counter to={15} duration={1.2} /> : 0}{" "}
                  {t("kpi.cash.abbr")}{" "}
                  <span className="font-semibold text-2xl">
                    {t("kpi.cash.unit")}
                  </span>
                </div>
                <div className="mt-1 text-sm text-white/70">
                  {t("kpi.cash.desc")}
                </div>
              </div>
            </FadeInOnView>
          </div>
        </div>
      </header>

      {/* SECTION cartes */}
      <section className="relative py-12 md:py-14">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <h2 className="text-3xl md:text-4xl font-semibold text-white">
            {t("cards.title")}
          </h2>
          <p className="mt-2 text-base text-white/70">{t("cards.subtitle")}</p>

          <div className="mt-7 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                title: t("cards.items.0.title"),
                desc: t("cards.items.0.desc"),
                icon: <BarChart3 className="w-4 h-4" />,
              },
              {
                title: t("cards.items.1.title"),
                desc: t("cards.items.1.desc"),
                icon: <Wallet className="w-4 h-4" />,
              },
              {
                title: t("cards.items.2.title"),
                desc: t("cards.items.2.desc"),
                icon: <ArrowRight className="w-4 h-4" />,
              },
              {
                title: t("cards.items.3.title"),
                desc: t("cards.items.3.desc"),
                icon: <LogIn className="w-4 h-4" />,
              },
            ].map((c, i) => (
              <FadeInOnView key={`${c.title}-${i}`} delay={i * 0.08}>
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

      {/* CTA / parcours */}
      <section className="relative full-bleed panel-surface py-14 md:py-20">
        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h3 className="text-2xl md:text-3xl font-semibold text-white">
                {t("cta.title")}
              </h3>
              <p className="text-sm text-white/70">{t("cta.subtitle")}</p>
            </div>
            <div className="text-xs text-white/60">
              {t("cta.hint.before")}&nbsp;<kbd>⌘</kbd>+<kbd>K</kbd>&nbsp;
              {t("cta.hint.after")}
            </div>
          </div>

          <div className="mt-8 grid md:grid-cols-12 gap-5">
            {/* Ventes */}
            <button
              onClick={() => goTo("sales")}
              className="md:col-span-5 text-left rounded-3xl card-glass card-hover p-6 md:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-white/80 text-sm">
                    {t("cta.sales.overline")}
                  </div>
                  <div className="mt-1 text-xl md:text-2xl font-semibold text-white">
                    {t("cta.sales.title")}
                  </div>
                </div>
                <div className="chip">{t("cta.sales.chip")}</div>
              </div>

              <ul className="mt-4 space-y-2 text-sm text-white/80">
                <li>{t("cta.sales.items.0")}</li>
                <li>{t("cta.sales.items.1")}</li>
                <li>{t("cta.sales.items.2")}</li>
              </ul>

              <div className="mt-5 inline-flex items-center gap-2 text-indigo-200">
                {t("cta.sales.link")}
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

            {/* Raccourcis */}
            <div className="md:col-span-7 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <button
                onClick={() => goTo("cash")}
                className="text-left rounded-3xl card-glass card-hover p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-grid place-items-center w-8 h-8 rounded-lg bg-white/10 ring-1 ring-white/15">
                    👥
                  </span>
                  <div className="text-lg font-medium text-white">
                    {t("shortcuts.clients.title")}
                  </div>
                </div>
                <p className="mt-2 text-sm text-white/75">
                  {t("shortcuts.clients.desc")}
                </p>
              </button>

              <button
                onClick={() => goTo("pricing")}
                className="text-left rounded-3xl card-glass card-hover p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-grid place-items-center w-8 h-8 rounded-lg bg-indigo-500/20 ring-1 ring-white/15">
                    🏷️
                  </span>
                  <div className="text-lg font-medium text-white">
                    {t("shortcuts.pricing.title")}
                  </div>
                </div>
                <p className="mt-2 text-sm text-white/75">
                  {t("shortcuts.pricing.desc")}
                </p>
              </button>

              <button
                onClick={() => goTo("eco")}
                className="text-left rounded-3xl card-glass card-hover p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-grid place-items-center w-8 h-8 rounded-lg bg-teal-500/20 ring-1 ring-white/15">
                    ♻️
                  </span>
                  <div className="text-lg font-medium text-white">
                    {t("shortcuts.eco.title")}
                  </div>
                </div>
                <p className="mt-2 text-sm text-white/75">
                  {t("shortcuts.eco.desc")}
                </p>
              </button>

              <button
                onClick={() => goTo("risk")}
                className="text-left rounded-3xl card-glass card-hover p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-grid place-items-center w-8 h-8 rounded-lg bg-fuchsia-500/20 ring-1 ring-white/15">
                    🛡️
                  </span>
                  <div className="text-lg font-medium text-white">
                    {t("shortcuts.risk.title")}
                  </div>
                </div>
                <p className="mt-2 text-sm text-white/75">
                  {t("shortcuts.risk.desc")}
                </p>
              </button>

              <button
                onClick={() => goTo("pro")}
                className="text-left rounded-3xl card-glass card-hover p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-grid place-items-center w-8 h-8 rounded-lg bg-white/10 ring-1 ring-white/15">
                    <Headphones className="w-4 h-4" />
                  </span>
                  <div className="text-lg font-medium text-white">
                    {t("shortcuts.help.title")}
                  </div>
                </div>
                <p className="mt-2 text-sm text-white/75">
                  {t("shortcuts.help.desc.before")}{" "}
                  <strong>{t("shortcuts.help.desc.strong")}</strong>
                </p>
                <div className="mt-3 chip">{t("shortcuts.help.chip")}</div>
              </button>

              <button
                onClick={() => goTo("connectors")}
                className="text-left rounded-3xl card-glass card-hover p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-grid place-items-center w-8 h-8 rounded-lg bg-white/10 ring-1 ring-white/15">
                    <Plug className="w-4 h-4" />
                  </span>
                  <div className="text-lg font-medium text-white">
                    {t("shortcuts.connectors.title")}
                  </div>
                </div>
                <p className="mt-2 text-sm text-white/75">
                  {t("shortcuts.connectors.desc.before")}{" "}
                  <em>{t("shortcuts.connectors.desc.em")}</em>.
                </p>
                <div className="mt-3 chip">
                  {t("shortcuts.connectors.chip")}
                </div>
                <div className="pointer-events-none absolute -right-4 top-3 rotate-12">
                  <span className="rounded bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-2 py-0.5 text-[10px] font-semibold tracking-wider">
                    {t("shortcuts.connectors.ribbon")}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Bande d’aides */}
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-white/60">
            <span className="chip">{t("helpstrip.items.0")}</span>
            <span className="chip">{t("helpstrip.items.1")}</span>
            <span className="chip">{t("helpstrip.items.2")}</span>
          </div>
        </div>
      </section>

      {/* À PROPOS + VIDÉO */}
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
                  <span>{t("about.overline")}</span>
                </div>
                <h3 className="mt-3 text-2xl md:text-3xl font-semibold">
                  {t("about.titlePrefix")}{" "}
                  <span className="bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-indigo-300 bg-clip-text text-transparent">
                    Jérémy Duriez
                  </span>
                </h3>
                <p className="mt-3 text-white/80 text-sm leading-relaxed">
                  {t("about.text")}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href="#about-video"
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 border border-white/15 bg-white/5 hover:bg-white/10 transition text-sm"
                  >
                    <PlayCircle className="w-4 h-4" />
                    {t("about.watch")}
                  </a>
                </div>
              </div>
            </FadeInOnView>

            {/* Colonne vidéo */}
            <FadeInOnView delay={0.08}>
              <div
                id="about-video"
                className="relative rounded-3xl overflow-hidden border border-white/12 bg-white/6 backdrop-blur p-3"
              >
                <div className="relative aspect-video w-full rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900">
                  <video
                    key={videoSrc}
                    className="absolute inset-0 h-full w-full object-cover rounded-2xl"
                    src={videoSrc}
                    // poster="/intro-poster.jpg"
                    controls
                    autoPlay
                    muted
                    playsInline
                    loop
                    preload="metadata"
                    onError={onVideoError}
                    onLoadedData={() => console.log("VIDEO LOADED", videoSrc)}
                  >
                    <source src={videoSrc} type="video/mp4" />
                    Votre navigateur ne peut pas lire cette vidéo.
                  </video>
                </div>

                {/* Barre sous la vidéo : durée + sélecteur de langue */}
                <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs text-white/70">
                  <span className="text-white/60">&lt; 1 min</span>

                  <div className="flex items-center gap-2">
                    <label htmlFor="video-lang" className="text-white/70">
                      {t("about.video.lang.label")}
                    </label>
                    <select
                      id="video-lang"
                      value={videoLang}
                      onChange={(e) => setVideoLang(e.target.value)}
                      className="rounded-md bg-white/10 border border-white/15 px-2 py-1 text-white/90"
                      aria-label={t("about.video.lang.label")}
                      title={t("about.video.lang.label")}
                    >
                      <option value="fr">{t("about.video.lang.fr")}</option>
                      <option value="en">{t("about.video.lang.en")}</option>
                      <option value="es">{t("about.video.lang.es")}</option>
                    </select>
                    <span className="text-white/50">
                      {t("about.video.lang.help")}
                    </span>
                  </div>
                </div>
              </div>
            </FadeInOnView>
          </div>
        </div>
      </section>

      <footer className="py-10 text-center text-xs text-white/55 bg-app">
        © {new Date().getFullYear()} InsightMate — {t("footer.demo")} ·{" "}
        {t("footer.createdBy")}{" "}
        <span className="text-white/70 font-semibold">Jérémy Duriez</span>
      </footer>
    </div>
  );
}
