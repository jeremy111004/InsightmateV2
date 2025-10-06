// src/pages/AccessProPage.jsx
import React from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatCurrency } from "@/lib/format";
import { getUser, startCheckout } from "@/hooks/usePro";

// Petit catalogue local de plans (à adapter si besoin)
const PLAN_CATALOG = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Pour démarrer en douceur",
    monthly: 9,
    yearly: 90, // ≈ -2 mois
    features: [
      "Imports CSV & Google Sheets",
      "Tableaux & exports de base",
      "Support e-mail standard",
    ],
    ctaHint: "Parfait pour tester l’app avec un petit volume.",
    recommended: false,
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Connecteurs & synchro auto",
    monthly: 29,
    yearly: 290,
    features: [
      "Connecteurs Stripe / Banque / Shopify",
      "Synchro planifiée et logs",
      "Exports comptables",
    ],
    ctaHint: "Idéal pour un pilotage quotidien sans friction.",
    recommended: true,
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "Pour équipes & gros volumes",
    monthly: 79,
    yearly: 790,
    features: [
      "Priorité de traitement",
      "Historique étendu",
      "Support prioritaire",
    ],
    ctaHint: "Pensé pour la croissance et les besoins avancés.",
    recommended: false,
  },
];

const formatEUR = (n) => formatCurrency(n, { currency: "EUR", decimals: 0 });

export default function AccessProPage() {
  const [interval, setInterval] = React.useState("monthly"); // "monthly" | "yearly"
  const [user, setUserState] = React.useState(getUser());

  // se met à jour quand l’état user change (activation mock)
  React.useEffect(() => {
    const onUser = () => setUserState(getUser());
    window.addEventListener("im:user", onUser);
    return () => window.removeEventListener("im:user", onUser);
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold">Accès Pro</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Choisissez votre abonnement et débloquez les connecteurs, exports et
          la synchronisation automatique.
        </p>

        {/* Toggle mensuel/annuel */}
        <div className="mt-4 inline-flex items-center gap-2 border rounded-xl px-2 py-1">
          <Button
            variant={interval === "monthly" ? "solid" : "subtle"}
            size="sm"
            onClick={() => setInterval("monthly")}
          >
            Mensuel
          </Button>
          <Button
            variant={interval === "yearly" ? "solid" : "subtle"}
            size="sm"
            onClick={() => setInterval("yearly")}
          >
            Annuel <span className="ml-1 opacity-70">(−2 mois)</span>
          </Button>
        </div>

        {/* Badge état */}
        <div className="mt-3 text-xs">
          {user?.isPro ? (
            <span className="px-2 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
              ✅ Accès Pro actif{" "}
              {user.planId
                ? `• ${user.planId} (${user.interval || "mensuel"})`
                : ""}
            </span>
          ) : (
            <span className="px-2 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
              🔒 Mode démo — actions verrouillées
            </span>
          )}
        </div>
      </header>

      {/* Cartes de plans */}
      <div className="grid md:grid-cols-3 gap-5">
        {PLAN_CATALOG.map((p) => {
          const price = interval === "monthly" ? p.monthly : p.yearly;
          const per = interval === "monthly" ? "/mois" : "/an";
          const active = user?.isPro && user?.planId === p.id;

          return (
            <Card
              key={p.id}
              className={
                (p.recommended ? "ring-2 ring-indigo-400 " : "") + "h-full"
              }
            >
              {p.recommended && (
                <div className="mb-2 inline-block text-[10px] px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                  Recommandé
                </div>
              )}

              <div className="text-lg font-semibold">{p.name}</div>
              <div className="text-xs opacity-70 mb-3">{p.tagline}</div>

              <div className="text-3xl font-bold mt-1">
                {formatEUR(price)}{" "}
                <span className="text-base font-medium opacity-70">{per}</span>
              </div>

              <ul className="mt-4 space-y-2 text-sm">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      className="mt-0.5 opacity-80"
                      aria-hidden
                    >
                      <path
                        fill="currentColor"
                        d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                      />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                {active ? (
                  <Button
                    className="w-full"
                    variant="subtle"
                    title="Déjà abonné"
                  >
                    Déjà actif
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => startCheckout({ planId: p.id, interval })}
                  >
                    Activer {p.name}
                  </Button>
                )}
                <div className="text-xs opacity-70 mt-2">{p.ctaHint}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* FAQ courte */}
      <section className="mt-8">
        <h3 className="text-sm font-semibold">Questions rapides</h3>
        <ul className="mt-2 text-sm space-y-1">
          <li>• Facturation sécurisée Stripe (SCA/3-D Secure).</li>
          <li>• Annulable à tout moment depuis votre espace client.</li>
          <li>
            • Les connecteurs réels (Stripe, Banque, Shopify) s’activent dès
            validation.
          </li>
        </ul>
      </section>
    </div>
  );
}
