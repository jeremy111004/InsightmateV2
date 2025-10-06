// src/pages/EncaissementsDemo.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  computeAging,
  computeDSO,
  computeRecoverable7d,
  parseInvoicesCsv,
  riskScore,
} from "../lib/dso";
import { loadDataset } from "../lib/datastore";
import { formatNumber } from "../lib/format";
import Card from "../components/ui/Card";
import Section from "../components/ui/Section";
import Stat from "../components/ui/Stat";
import Button from "../components/ui/Button";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
} from "recharts";
import {
  Wallet,
  HandCoins,
  TrendingUp,
  AlertTriangle,
  Mail,
  Link as LinkIcon,
} from "lucide-react";
import { SAMPLE_INVOICES_CSV } from "../data/samples";

function EmailRelanceButton({ invoice }) {
  const dueISO = (() => {
    const raw = invoice?.due_date;
    const d = raw instanceof Date ? raw : new Date(raw);
    return isNaN(d) ? String(raw ?? "") : d.toISOString().slice(0, 10);
  })();

  const subject = encodeURIComponent(
    `Relance facture ${invoice.invoice_id} – ${invoice.client}`
  );
  const body = encodeURIComponent(
    `Bonjour ${invoice.client},

Je me permets de vous contacter au sujet de la facture ${
      invoice.invoice_id
    } d’un montant de ${formatNumber(invoice.amount)} ${
      invoice.currency
    }, arrivée à échéance le ${dueISO}.

Pourriez-vous nous indiquer la date de règlement prévue ?
${
  invoice.stripe_url
    ? `Si besoin, vous pouvez payer ici : ${invoice.stripe_url}`
    : `Si besoin, je peux vous envoyer un lien de paiement sécurisé.`
}

Merci d’avance pour votre retour.
Bien cordialement,
— InsightMate`
  );
  const mailto = `mailto:${
    invoice.email || ""
  }?subject=${subject}&body=${body}`;
  return (
    <div className="flex gap-2">
      <a
        href={mailto}
        className="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm hover:bg-black inline-flex items-center gap-2"
      >
        <Mail className="w-4 h-4" /> Ouvrir email
      </a>
      {invoice.stripe_url ? (
        <a
          href={invoice.stripe_url}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm inline-flex items-center gap-2"
        >
          <LinkIcon className="w-4 h-4" /> Lien de paiement
        </a>
      ) : (
        <button
          disabled
          className="px-3 py-2 rounded-xl bg-gray-100 text-gray-400 text-sm inline-flex items-center gap-2"
        >
          <LinkIcon className="w-4 h-4" /> Lien de paiement
        </button>
      )}
    </div>
  );
}

export default function EncaissementsDemo() {
  const [asOf, setAsOf] = useState(() => new Date());
  const [csv, setCsv] = useState(SAMPLE_INVOICES_CSV);
  const [invoices, setInvoices] = useState(() =>
    parseInvoicesCsv(SAMPLE_INVOICES_CSV)
  );

  const [startingBal, setStartingBal] = useState(5000);
  const [dailyNetOut, setDailyNetOut] = useState(200);
  const [whatIfRate, setWhatIfRate] = useState(40); // %

  useEffect(() => {
    // 1) Si on a de vraies factures importées
    const invRows = loadDataset("invoices");
    if (invRows && invRows.length) {
      const coerce = (r) => ({
        invoice_id: String(r.invoice_id || r.id || ""),
        client: (r.client || r.customer || "Client").trim?.() || "Client",
        email: (r.email || "").trim?.() || "",
        phone: (r.phone || "").trim?.() || "",
        issue_date: r.issue_date
          ? new Date(r.issue_date)
          : r.date
          ? new Date(r.date)
          : null,
        due_date: r.due_date ? new Date(r.due_date) : null,
        amount: Number(r.amount ?? r.total ?? r.net ?? 0),
        currency: (r.currency || "EUR").trim?.() || "EUR",
        status:
          (r.status || (r.paid_date ? "PAID" : "ISSUED")).trim?.() || "ISSUED",
        paid_date: r.paid_date ? new Date(r.paid_date) : null,
        stripe_url: r.stripe_url || r.url || "",
      });
      setInvoices(invRows.map(coerce));
      return;
    }

    // 2) Sinon, “payments” → on synthétise en factures payées
    const pay = loadDataset("payments");
    if (pay && pay.length) {
      const toInvoice = (r, i) => {
        const d = r.date ? new Date(r.date) : null;
        const net = Number(r.net ?? r.amount ?? r.gross ?? 0);
        return {
          invoice_id: `PAY-${i + 1}`,
          client: r.customer || r.description || "Encaissement",
          email: "",
          phone: "",
          issue_date: d,
          due_date: d,
          amount: net,
          currency: r.currency || "EUR",
          status: "PAID",
          paid_date: d,
          stripe_url: r.balance_transaction
            ? `https://dashboard.stripe.com/tx/${r.balance_transaction}`
            : "",
        };
      };
      setInvoices(pay.map(toInvoice));
    }
  }, []);

  const { buckets, overdueTotal, open } = useMemo(
    () => computeAging(invoices, asOf),
    [invoices, asOf]
  );
  const dso = useMemo(() => computeDSO(invoices, asOf), [invoices, asOf]);
  const recover7 = useMemo(() => computeRecoverable7d(buckets), [buckets]);

  const agingData = useMemo(
    () => [
      {
        name: "À échéance/À venir",
        amount: Math.round(buckets["À échéance/À venir"] || 0),
      },
      { name: "1–15 j", amount: Math.round(buckets["1–15 j"] || 0) },
      { name: "16–30 j", amount: Math.round(buckets["16–30 j"] || 0) },
      { name: "31–60 j", amount: Math.round(buckets["31–60 j"] || 0) },
      { name: "61+ j", amount: Math.round(buckets["61+ j"] || 0) },
    ],
    [buckets]
  );

  const gt30 = open.filter((v) => v.days_past_due > 30);
  const impactCash = Math.round(
    (whatIfRate / 100) * gt30.reduce((s, v) => s + v.amount, 0)
  );
  const runwayDays = dailyNetOut > 0 ? Math.floor(impactCash / dailyNetOut) : 0;

  const topRelance = useMemo(
    () =>
      open
        .filter((v) => v.past_due)
        .map((v) => ({ ...v, risk: riskScore(v) }))
        .sort((a, b) => b.risk - a.risk || b.amount - a.amount)
        .slice(0, 10),
    [open]
  );

  function handleLoad() {
    setInvoices(parseInvoicesCsv(csv));
  }

  // Helpers d'affichage de date
  const asOfISO = new Date(asOf.getTime() - asOf.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  return (
    <div className="space-y-4">
      <Section
        title="Encaissements — Importer (CSV)"
        icon={<Wallet className="w-5 h-5" />}
        actions={
          <div className="flex gap-2">
            <input
              type="date"
              value={asOfISO}
              onChange={(e) => setAsOf(new Date(e.target.value + "T00:00:00"))}
              className="px-3 py-2 rounded-xl border text-sm"
              title="Date d’évaluation"
            />
            <Button onClick={handleLoad} size="sm">
              Charger le CSV
            </Button>
          </div>
        }
      >
        <textarea
          className="mt-2 w-full h-36 rounded-xl border border-gray-200 p-3 font-mono text-xs"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <p className="text-xs text-gray-500 mt-2">
          Colonnes requises :{" "}
          <code>
            invoice_id, client, email, phone, issue_date, due_date, amount,
            currency, status, paid_date, stripe_url
          </code>
        </p>
      </Section>

      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <Stat
            label="Montant en retard"
            value={`${formatNumber(overdueTotal)} €`}
          />
        </Card>
        <Card>
          <Stat label="DSO estimé" value={`${dso} j`} />
        </Card>
        <Card>
          <Stat
            label="Cash récupérable (7 j)"
            value={`${formatNumber(recover7)} €`}
          />
        </Card>
        <Card>
          <Stat label="Factures ouvertes" value={open.length} />
        </Card>
      </div>

      <Section
        title="What-if & Runway"
        icon={<HandCoins className="w-5 h-5" />}
      >
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">
            Trésorerie actuelle (€)
            <input
              type="number"
              className="mt-1 w-full rounded-xl border p-2"
              value={startingBal}
              onChange={(e) => setStartingBal(Number(e.target.value || 0))}
            />
          </label>
          <label className="text-sm">
            Dépense nette / jour (€)
            <input
              type="number"
              className="mt-1 w-full rounded-xl border p-2"
              value={dailyNetOut}
              onChange={(e) => setDailyNetOut(Number(e.target.value || 0))}
            />
          </label>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-sm">
            <span>% encaisser (&gt;30 j)</span>
            <span>{whatIfRate}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            className="w-full mt-1"
            value={whatIfRate}
            onChange={(e) => setWhatIfRate(Number(e.target.value))}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Card>
            <Stat
              label="Impact cash"
              value={`+${formatNumber(impactCash)} €`}
            />
          </Card>
          <Card>
            <Stat label="Jours de runway gagnés" value={`+${runwayDays} j`} />
          </Card>
        </div>
      </Section>

      <div className="grid md:grid-cols-2 gap-4">
        <Section
          title="Vieillissement des créances"
          icon={<TrendingUp className="w-5 h-5" />}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={agingData}
                margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) => formatNumber(v)}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip formatter={(v) => `${formatNumber(v)} €`} />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                  <LabelList
                    dataKey="amount"
                    position="top"
                    formatter={(v) => (v ? `${formatNumber(v)}€` : "")}
                    style={{ fontSize: 11 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Prioriser 61+ j puis 31–60 j.
          </div>
        </Section>

        <Section
          title="Top 10 à relancer"
          icon={<AlertTriangle className="w-5 h-5" />}
        >
          <div className="space-y-3">
            {topRelance.length === 0 && (
              <div className="text-sm text-gray-500">
                Aucune facture en retard 🎉
              </div>
            )}
            {topRelance.map((inv) => (
              <div key={inv.invoice_id} className="border rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">
                      {inv.client} · {inv.invoice_id}
                    </div>
                    <div className="text-xs text-gray-500">
                      Échéance:{" "}
                      {inv.due_date instanceof Date && !isNaN(inv.due_date)
                        ? inv.due_date.toISOString().slice(0, 10)
                        : String(inv.due_date || "")}{" "}
                      · Retard: {inv.days_past_due} j
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {formatNumber(inv.amount)} €
                    </div>
                    <div className="text-xs text-gray-500">
                      Risque {inv.risk}/100
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <EmailRelanceButton invoice={inv} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
