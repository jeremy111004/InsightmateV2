// src/hooks/usePro.jsx
import React from "react";
import { getDatastore, setDatastore } from "../lib/datastore";

// Clés de stockage
const USER_KEY = "insightmate.user";
const PRO_KEY = "insightmate.pro";

// --- Utils stockage sûrs ---
function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSetItem(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch {}
}
function emit(name, detail) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {}
}

// --- User helpers ---
export function getUser() {
  try {
    const raw = safeGetItem(USER_KEY);
    return raw ? JSON.parse(raw) : { isPro: false, email: null };
  } catch {
    return { isPro: false, email: null };
  }
}

export function setUser(u) {
  safeSetItem(USER_KEY, JSON.stringify(u ?? { isPro: false, email: null }));
  emit("im:user", { at: Date.now() });
}

// --- Pro helpers / mock checkout ---
export function isProEnabled() {
  return !!getUser()?.isPro || safeGetItem(PRO_KEY) === "1";
}

export function setProEnabled(v) {
  safeSetItem(PRO_KEY, v ? "1" : "0");
  emit("im:pro", { at: Date.now(), enabled: !!v });
}

/**
 * startCheckout (mock)
 * Active Pro immédiatement (démo). Remplace par ton vrai flow Stripe/Paddle plus tard.
 */
export async function startCheckout(
  { planId, interval } = { planId: "pro", interval: "monthly" }
) {
  const prev = getUser();
  setUser({
    ...prev,
    isPro: true,
    planId: planId ?? "pro",
    interval: interval ?? "monthly",
    activatedAt: Date.now(),
  });
  setProEnabled(true);
  try {
    alert(`Accès Pro activé (mock) — plan: ${planId} / ${interval}`);
  } catch {}
}

// --- Démo: seed de données si pas Pro ---
export function seedDemoIfNeeded() {
  const user = getUser();
  if (user?.isPro) return;

  const ds = getDatastore() || {};
  if (ds.__demo) return;

  const demoId = "__demo";
  ds[demoId] = {
    sales: [
      {
        date: "2025-08-01",
        product: "Café Latte",
        qty: 18,
        price: 3.2,
        customer_id: "C001",
      },
      {
        date: "2025-08-01",
        product: "Croissant",
        qty: 42,
        price: 1.4,
        customer_id: "C002",
      },
      {
        date: "2025-08-02",
        product: "Café Latte",
        qty: 20,
        price: 3.2,
        customer_id: "C003",
      },
      {
        date: "2025-08-02",
        product: "Thé Vert",
        qty: 12,
        price: 2.5,
        customer_id: "C004",
      },
    ],
    payments: [
      {
        date: "2025-08-01",
        gross: 240,
        fee: 4.57,
        net: 235.43,
        payout: "daily",
        balance_transaction: "txn_10001",
      },
      {
        date: "2025-08-02",
        gross: 280,
        fee: 5.1,
        net: 274.9,
        payout: "daily",
        balance_transaction: "txn_10002",
      },
    ],
    banking: [
      {
        date: "2025-08-01",
        description: "Vente carte",
        category: "Vente",
        inflow: 235.43,
        outflow: 0,
      },
      {
        date: "2025-08-02",
        description: "Paiement fournisseur",
        category: "Fournisseur",
        inflow: 0,
        outflow: 120.0,
      },
    ],
    invoices: [
      {
        invoice_id: "INV-001",
        client: "Client A",
        issue_date: "2025-07-25",
        due_date: "2025-08-10",
        amount: 180.0,
        currency: "EUR",
        status: "PAID",
        paid_date: "2025-08-02",
      },
      {
        invoice_id: "INV-002",
        client: "Client B",
        issue_date: "2025-07-28",
        due_date: "2025-08-12",
        amount: 420.0,
        currency: "EUR",
        status: "ISSUED",
        paid_date: "",
      },
    ],
  };
  ds.__demo = true;
  setDatastore(ds);
  emit("im:datastore", { at: Date.now() });
}

// --- Hook principal ---
export default function usePro() {
  // SSR guard
  const initial = typeof window === "undefined" ? false : isProEnabled();
  const [pro, setPro] = React.useState(initial);

  React.useEffect(() => {
    const onChange = () => setPro(isProEnabled());
    window.addEventListener("im:pro", onChange);
    window.addEventListener("im:user", onChange);
    // sync multi-tab
    const onStorage = (e) => {
      if (!e) return;
      if (e.key === USER_KEY || e.key === PRO_KEY) onChange();
    };
    window.addEventListener("storage", onStorage);

    // init
    onChange();

    return () => {
      window.removeEventListener("im:pro", onChange);
      window.removeEventListener("im:user", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return pro;
}

// --- Composant de garde Pro ---
export function PaywallGate({
  feature = "cette fonctionnalité",
  children,
  className = "",
  buttonClassName = "",
  onActivate, // callback après activation mock
  fallback, // ReactNode personnalisé (si fourni, remplace l'overlay par défaut)
}) {
  const [user, setU] = React.useState(getUser());

  React.useEffect(() => {
    const fn = () => setU(getUser());
    window.addEventListener("im:user", fn);
    return () => window.removeEventListener("im:user", fn);
  }, []);

  if (user?.isPro) return children;

  // Fallback personnalisé fourni par le parent ?
  if (fallback)
    return (
      <div className="relative">
        <div className="opacity-50 pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          {fallback}
        </div>
      </div>
    );

  // Fallback par défaut (overlay)
  const activate = async () => {
    await startCheckout();
    try {
      onActivate?.();
    } catch {}
  };

  return (
    <div className={"relative " + className}>
      <div className="opacity-50 pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-3">
        <div className="bg-white/85 dark:bg-zinc-900/85 backdrop-blur-sm p-5 rounded-2xl shadow-xl text-center border border-gray-200/70 dark:border-gray-800/70">
          <div className="text-lg font-semibold mb-1">Fonction réservée</div>
          <div className="text-sm opacity-80 mb-3">
            Débloquez <span className="font-medium">{feature}</span> avec
            l’accès Pro.
          </div>
          <button
            type="button"
            onClick={activate}
            className={[
              "px-4 py-2 rounded-xl shadow font-medium",
              "bg-gray-900 text-white hover:bg-black",
              "dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200",
              buttonClassName,
            ].join(" ")}
          >
            Activer l’accès Pro
          </button>
          <div className="text-xs mt-2 opacity-70">
            Vous voyez une version démo (lecture seule).
          </div>
        </div>
      </div>
    </div>
  );
}
