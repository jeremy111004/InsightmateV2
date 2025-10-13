// src/lib/connectorsStore.jsx
// Lib "pure" (pas de JSX ici). On expose des composants d'icônes (pas d'éléments).

import {
  CreditCard,
  Banknote,
  ShoppingBag,
  Store,
  Building2,
  FileSpreadsheet,
} from "lucide-react";

// —————————————————————————————————————————————
// Constantes de clés / événements
// —————————————————————————————————————————————
export const CONNECTORS_KEY = "insightmate.connectors.v1";
export const CONNECTOR_LOG_KEY = "insightmate.connectorLog.v1";

export const EVT_CONNECTORS = "im:connectors";
export const EVT_CONNECTOR_LOG = "im:connectorLog";

// —————————————————————————————————————————————
function _safeParse(json, fallback) {
  try {
    return json ? JSON.parse(json) : fallback;
  } catch {
    return fallback;
  }
}
function _loadJSON(key, fallback) {
  try {
    return _safeParse(localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}
function _saveJSON(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}
function _emit(name, detail) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {}
}

// —————————————————————————————————————————————
// State Connectors
// —————————————————————————————————————————————
export function getConnectorsState() {
  return (
    _loadJSON(CONNECTORS_KEY, null) ?? {
      stripe: {},
      bank_fr: {},
      shopify: {},
      prestashop: {},
      woocommerce: {},
      pennylane: {},
      sage: {},
      sheets: {},
      csv: {},
    }
  );
}

export function setConnectorsState(next) {
  const state = next || {};
  _saveJSON(CONNECTORS_KEY, state);
  _emit(EVT_CONNECTORS, { at: Date.now(), state });
}

/**
 * updateConnector(id, patch)
 * Merge simple pour mettre à jour un connecteur sans écraser les autres.
 */
export function updateConnector(id, patch) {
  const state = getConnectorsState();
  state[id] = { ...(state[id] || {}), ...(patch || {}) };
  setConnectorsState(state);
  return state[id];
}

// —————————————————————————————————————————————
// Journal (log) des opérations connecteurs
// —————————————————————————————————————————————
export function getConnectorLog() {
  return _loadJSON(CONNECTOR_LOG_KEY, []) || [];
}

export function pushConnectorLog(entry) {
  const arr = getConnectorLog();
  arr.push({ at: Date.now(), ...(entry || {}) });
  // On peut limiter la taille du log pour éviter l'emballement
  const max = 500;
  const trimmed = arr.length > max ? arr.slice(arr.length - max) : arr;
  _saveJSON(CONNECTOR_LOG_KEY, trimmed);
  _emit(EVT_CONNECTOR_LOG, { at: Date.now(), last: entry });
  return trimmed;
}

// —————————————————————————————————————————————
// Catalogue : icônes = composants (à instancier côté UI)
// —————————————————————————————————————————————
export const CONNECTOR_CATALOG = [
  {
    id: "stripe",
    name: "Stripe",
    kind: "payments",
    icon: CreditCard, // UI: const Icon = item.icon; <Icon className="w-5 h-5" />
    desc: "Encaissements, frais, virements",
  },
  {
    id: "bank_fr",
    name: "Banque FR",
    kind: "banking",
    icon: Banknote,
    desc: "Comptes & transactions",
  },
  {
    id: "shopify",
    name: "Shopify",
    kind: "sales",
    icon: ShoppingBag,
    desc: "Commandes, remboursements, clients",
  },
  {
    id: "prestashop",
    name: "PrestaShop",
    kind: "sales",
    icon: Store,
    desc: "Commandes & produits",
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    kind: "sales",
    icon: Store,
    desc: "Commandes & produits",
  },
  {
    id: "pennylane",
    name: "Pennylane",
    kind: "accounting",
    icon: Building2,
    desc: "Exports comptables",
  },
  {
    id: "sage",
    name: "Sage",
    kind: "accounting",
    icon: Building2,
    desc: "Exports comptables",
  },
  {
    id: "sheets",
    name: "Google Sheets",
    kind: "import",
    icon: FileSpreadsheet,
    desc: "Import URL (CSV/Sheets)",
  },
  {
    id: "csv",
    name: "Fichier CSV",
    kind: "import",
    icon: FileSpreadsheet,
    desc: "Déposer un fichier",
  },
];

// export par défaut neutre (évite les erreurs d'import legacy)
export default {};
