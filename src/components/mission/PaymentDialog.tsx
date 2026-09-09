import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AUD, PACKAGES, TIERS, type Lead } from "@/lib/mission";
import { createSolanaInvoice, verifySolanaPayment } from "@/lib/solana.functions";
import { createPaypalOrder, capturePaypalOrder } from "@/lib/paypal.functions";
import { supabase } from "@/integrations/supabase/client";

type Method = "director" | "solana" | "paypal";

export function PaymentDialog({
  lead,
  onClose,
  onDone,
}: {
  lead: Lead;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pkg, setPkg] = useState<string>(PACKAGES[1].name);
  const [tier, setTier] = useState<string>(TIERS[1].name);
  const [method, setMethod] = useState<Method>("director");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<{
    paymentId: string;
    solAmount?: number | undefined;
    recipient?: string | undefined;
    approveUrl?: string | undefined;
  } | null>(null);
  const [signature, setSignature] = useState("");

  const fee = PACKAGES.find((p) => p.name === pkg)?.fee ?? 0;
  const mrr = TIERS.find((t) => t.name === tier)?.mrr ?? 0;

  const solInvoice = useServerFn(createSolanaInvoice);
  const solVerify = useServerFn(verifySolanaPayment);
  const ppOrder = useServerFn(createPaypalOrder);
  const ppCapture = useServerFn(capturePaypalOrder);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const base = {
    leadId: lead.id,
    biz: lead.biz,
    package: pkg,
    tier,
    amountAud: fee,
    mrr,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg border border-line bg-panel p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-[14px] font-bold text-ink">Close → {lead.biz}</h2>
            <p className="mt-1 text-[10px] uppercase tracking-[1.5px] text-dim">
              Human decision. No agent can create a client.
            </p>
          </div>
          <button onClick={onClose} className="text-dim hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-[9px] uppercase tracking-[2px] text-dim">
            Build package
            <select
              value={pkg}
              onChange={(e) => setPkg(e.target.value)}
              className="mt-1 w-full border border-line bg-panel2 px-2 py-2 text-[12px] tracking-normal text-ink"
            >
              {PACKAGES.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} — {AUD(p.fee)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[9px] uppercase tracking-[2px] text-dim">
            Retainer tier
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="mt-1 w-full border border-line bg-panel2 px-2 py-2 text-[12px] tracking-normal text-ink"
            >
              {TIERS.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} — {AUD(t.mrr)}/mo
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="mt-3 text-[12px] text-green">
          {AUD(fee)} setup + {AUD(mrr)}/mo
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["director", "paypal", "solana"] as Method[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMethod(m);
                setInvoice(null);
                setError(null);
              }}
              className={`border px-3 py-1.5 text-[10px] uppercase tracking-[1.5px] ${
                method === m ? "border-purple bg-purple text-white" : "border-line text-dim hover:text-ink"
              }`}
            >
              {m === "director" ? "Paid offline" : m}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-[11px] text-red">{error}</p>}

        <div className="mt-4 space-y-3">
          {method === "director" && (
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const { error: err } = await supabase.rpc("close_deal", {
                    p_lead_id: lead.id,
                    p_package: pkg,
                    p_tier: tier,
                    p_fee: fee,
                    p_mrr: mrr,
                  });
                  if (err) throw new Error(err.message);
                  onDone();
                })
              }
              className="w-full bg-green px-4 py-2.5 text-[11px] font-bold uppercase tracking-[1.5px] text-void disabled:opacity-50"
            >
              Confirm close — money already received
            </button>
          )}


          {method === "paypal" && !invoice && (
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const res = await ppOrder({
                    data: { ...base, returnUrl: window.location.origin + "/mission-control" },
                  });
                  setInvoice(res);
                })
              }
              className="w-full bg-purple px-4 py-2.5 text-[11px] font-bold uppercase tracking-[1.5px] text-white disabled:opacity-50"
            >
              {busy ? "Raising invoice…" : `Raise PayPal invoice — ${AUD(fee)}`}
            </button>
          )}

          {method === "paypal" && invoice?.approveUrl && (
            <div className="space-y-3">
              <a
                href={invoice.approveUrl}
                target="_blank"
                rel="noreferrer"
                className="block border border-purple px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-[1.5px] text-purple"
              >
                Open the PayPal payment page
              </a>
              <p className="text-[11px] text-dim">
                Send that link to the client. Once they have paid, confirm it here — the money lands in
                your PayPal business account.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await ppCapture({ data: { paymentId: invoice.paymentId } });
                    onDone();
                  })
                }
                className="w-full bg-green px-4 py-2.5 text-[11px] font-bold uppercase tracking-[1.5px] text-void disabled:opacity-50"
              >
                {busy ? "Checking PayPal…" : "Confirm PayPal payment"}
              </button>
            </div>
          )}

          {method === "solana" && !invoice && (
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const res = await solInvoice({ data: base });
                  setInvoice(res);
                })
              }
              className="w-full bg-purple px-4 py-2.5 text-[11px] font-bold uppercase tracking-[1.5px] text-white disabled:opacity-50"
            >
              {busy ? "Pricing SOL…" : `Raise crypto invoice — ${AUD(fee)}`}
            </button>
          )}

          {method === "solana" && invoice?.solAmount && (
            <div className="space-y-3">
              <div className="border border-line bg-panel2 p-3">
                <p className="text-[10px] uppercase tracking-[2px] text-dim">Send exactly</p>
                <p className="mt-1 font-display text-[16px] text-green">{invoice.solAmount} SOL</p>
                <p className="mt-2 text-[10px] uppercase tracking-[2px] text-dim">To wallet</p>
                <p className="mt-1 break-all text-[11px] text-ink">{invoice.recipient}</p>
              </div>
              <label className="block text-[9px] uppercase tracking-[2px] text-dim">
                Transaction signature
                <input
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Paste the Phantom transaction signature"
                  className="mt-1 w-full border border-line bg-panel2 px-3 py-2 text-[11px] tracking-normal text-ink outline-none focus:border-purple"
                />
              </label>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await solVerify({ data: { paymentId: invoice.paymentId, signature } });
                    onDone();
                  })
                }
                className="w-full bg-green px-4 py-2.5 text-[11px] font-bold uppercase tracking-[1.5px] text-void disabled:opacity-50"
              >
                {busy ? "Checking the chain…" : "Verify on chain"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
