// src/i18n/index.js
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Import bundled JSON (works with Vite + HMR)
import frCommon from "../locales/fr/common.json";
import enCommon from "../locales/en/common.json";
import esCommon from "../locales/es/common.json";

// Namespaces
import frHome from "../locales/fr/home.json";
import enHome from "../locales/en/home.json";
import esHome from "../locales/es/home.json";

import frRisk from "../locales/fr/risk.json";
import enRisk from "../locales/en/risk.json";
import esRisk from "../locales/es/risk.json";

import frSupport from "../locales/fr/support.json";
import enSupport from "../locales/en/support.json";
import esSupport from "../locales/es/support.json";

import frConnectors from "../locales/fr/connectors.json";
import enConnectors from "../locales/en/connectors.json";
import esConnectors from "../locales/es/connectors.json";

import frClientRisk from "../locales/fr/clientRisk.json";
import enClientRisk from "../locales/en/clientRisk.json";
import esClientRisk from "../locales/es/clientRisk.json";

import frEcoLabel from "../locales/fr/ecoLabel.json";
import enEcoLabel from "../locales/en/ecoLabel.json";
import esEcoLabel from "../locales/es/ecoLabel.json";

// ✅ keep the imports; just register under the *pricing* namespace
import frPriceOptimizer from "../locales/fr/pricing.json";
import enPriceOptimizer from "../locales/en/pricing.json";
import esPriceOptimizer from "../locales/es/pricing.json";

import frSales from "../locales/fr/sales.json";
import enSales from "../locales/en/sales.json";
import esSales from "../locales/es/sales.json";

export const SUPPORTED_LNGS = ["fr", "en", "es"];
const DEFAULT_LNG = "fr";

function detectLanguage() {
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("lng");
    if (q) return q;
  } catch {}
  const stored = localStorage.getItem("im.lang");
  if (stored) return stored;
  const nav = navigator.language || (navigator.languages && navigator.languages[0]);
  return (nav || DEFAULT_LNG).slice(0, 2);
}
const initialLng = SUPPORTED_LNGS.includes(detectLanguage()) ? detectLanguage() : DEFAULT_LNG;

i18n
  .use(initReactI18next)
  .init({
    lng: initialLng,
    fallbackLng: DEFAULT_LNG,
    supportedLngs: SUPPORTED_LNGS,

    // ✅ use "pricing" (not "priceOptimizer")
    ns: [
      "common",
      "home",
      "risk",
      "support",
      "connectors",
      "clientRisk",
      "ecoLabel",
      "pricing",
      "sales"
    ],
    defaultNS: "common",

    resources: {
      fr: {
        common: frCommon,
        home: frHome,
        risk: frRisk,
        support: frSupport,
        connectors: frConnectors,
        clientRisk: frClientRisk,
        ecoLabel: frEcoLabel,
        pricing: frPriceOptimizer,   // ✅ here
        sales: frSales
      },
      en: {
        common: enCommon,
        home: enHome,
        risk: enRisk,
        support: enSupport,
        connectors: enConnectors,
        clientRisk: enClientRisk,
        ecoLabel: enEcoLabel,
        pricing: enPriceOptimizer,   // ✅ here
        sales: enSales
      },
      es: {
        common: esCommon,
        home: esHome,
        risk: esRisk,
        support: esSupport,
        connectors: esConnectors,
        clientRisk: esClientRisk,
        ecoLabel: esEcoLabel,
        pricing: esPriceOptimizer,   // ✅ here
        sales: esSales
      }
    },

    interpolation: { escapeValue: false },
    returnNull: false
  });

export function setLanguage(lng) {
  if (!SUPPORTED_LNGS.includes(lng)) return;
  i18n.changeLanguage(lng);
  try {
    localStorage.setItem("im.lang", lng);
    const url = new URL(window.location.href);
    url.searchParams.set("lng", lng);
    window.history.replaceState({}, "", url.toString());
  } catch {}
}

export default i18n;

// (optional for console)
if (typeof window !== "undefined") window.i18next = i18n;
