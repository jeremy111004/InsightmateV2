
import React from "react";
import { useTranslation } from "react-i18next";

export default function FloatingLangSwitch() {
  const { i18n } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const langs = ["fr", "en", "es"];

  const switchTo = (lng) => {
    i18n.changeLanguage(lng);
    setOpen(false);
  };

  return (
    <div className="fixed bottom-5 right-5 z-[9999] md:hidden">
      <div
        onClick={() => setOpen(!open)}
        className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/15 shadow-lg cursor-pointer"
      >
        <span className="text-white/90 font-semibold text-sm uppercase">
          {i18n.language?.slice(0, 2) || "fr"}
        </span>
      </div>

      {open && (
        <div className="absolute bottom-14 right-0 flex flex-col gap-1 p-2 rounded-lg bg-black/80 backdrop-blur border border-white/10 shadow-lg">
          {langs.map((lng) => (
            <button
              key={lng}
              onClick={() => switchTo(lng)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                i18n.language.startsWith(lng)
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {lng.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
