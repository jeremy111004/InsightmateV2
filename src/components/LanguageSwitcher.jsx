import i18n from "../i18n";

const CODES = ["fr", "en", "es"];

export default function LanguageSwitcher() {
  const current = (i18n.language || "fr").slice(0, 2);
  return (
    <div className="flex items-center gap-2 text-sm text-white">
      <span className="opacity-80">{i18n.t("label.language")}:</span>
      <div className="flex gap-1">
        {CODES.map((code) => (
          <button
            key={code}
            onClick={() => {
              i18n.changeLanguage(code);
              try {
                const url = new URL(window.location.href);
                url.searchParams.set("lng", code);
                window.history.replaceState({}, "", url.toString());
                localStorage.setItem("im.lang", code);
              } catch {}
            }}
            className={`px-2 py-1 rounded-lg border transition ${
              current === code
                ? "border-white/70 text-white"
                : "border-white/30 hover:border-white/60 text-white/80"
            }`}
            aria-pressed={current === code}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
