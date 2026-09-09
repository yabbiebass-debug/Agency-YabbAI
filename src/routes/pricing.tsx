import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SiteFooter, SiteNav } from "@/components/site/SiteNav";
import { AUD, PACKAGES, TIERS } from "@/lib/mission";
import { confirmCheckout, startCheckout } from "@/lib/public.functions";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Packages & Pricing — Basham Automations" },
      {
        name: "description",
        content:
          "Fixed-price automation builds from $1,500 plus a monthly care tier, or a custom scope at your own budget. Pay by card, PayPal or SOL and your build starts the same day.",
      },
      { property: "og:title", content: "Packages & Pricing — Basham Automations" },
      {
        property: "og:description",
        content: "Pick a package or set your own scope and budget. Pay now, build starts immediately.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

type Step = "choose" | "paypal" | "solana" | "done";

function PricingPage() {
  const start = useServerFn(startCheckout);
  const confirm = useServerFn(confirmCheckout);

  const [pkg, setPkg] = useState<string>(PACKAGES[0].name);
  const [custom, setCustom] = useState(false);
  const [customFee, setCustomFee] = useState(2500);
  const [tier, setTier] = useState<string>(TIERS[0].name);
  const [biz, setBiz] = useState("");
  const [email, setEmail] = useState("");
  const [scope, setScope] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("choose");
  const [signature, setSignature] = useState("");
  const [invoice, setInvoice] = useState<{
    paymentId: string; approveUrl: string | null; solAmount: number | null; recipient: string | null;
  } | null>(null);

  const fee = custom ? customFee : (PACKAGES.find((p) => p.name === pkg)?.fee ?? 0);
  const mrr = TIERS.find((t) => t.name === tier)?.mrr ?? 0;
  const packageName = custom ? "Custom build" : pkg;

  async function run(fn: () => Promise<void>) {
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

  const begin = (method: "paypal" | "solana") =>
    run(async () => {
      const res = await start({
        data: {
          method, biz, email, packageName, tier, amountAud: fee, mrr, scope,
          returnUrl: window.location.href,
        },
      });
      setInvoice({
        paymentId: res.paymentId,
        approveUrl: res.approveUrl ?? null,
        solAmount: res.solAmount ?? null,
        recipient: res.recipient ?? null,
      });
      setStep(method);
      if (method === "paypal" && res.approveUrl) window.open(res.approveUrl, "_blank", "noopener");
    });

  return (
    <div className="min-h-screen bg-void text-ink">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="font-display text-3xl font-black">Packages</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-dim">
          Fixed setup fee to build it, a monthly tier to keep it running and improving. Pay now and the
          build starts immediately — you get your delivery link and handover as soon as it ships. Need
          something outside the list? Set your own scope and budget.
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {PACKAGES.map((p) => (
            <button
              key={p.name}
              onClick={() => { setCustom(false); setPkg(p.name); }}
              className={`border p-5 text-left transition ${
                !custom && pkg === p.name ? "border-purple bg-panel" : "border-line bg-panel/60 hover:border-purple/60"
              }`}
            >
              <div className="font-display text-lg font-black">{p.name}</div>
              <div className="mt-1 text-[20px] font-bold text-green">{AUD(p.fee)}</div>
              <div className="text-[10px] uppercase tracking-[1.5px] text-dim">one-off setup</div>
              <ul className="mt-4 space-y-1 text-[12px] text-dim">
                <li>· Scoped build, delivered and handed over</li>
                <li>· Agent-run pipeline wired to your systems</li>
                <li>· Licence-checked tooling only</li>
                {p.fee >= 4000 && <li>· Multi-workflow automation + integrations</li>}
                {p.fee >= 8000 && <li>· Full operations build with reporting</li>}
              </ul>
            </button>
          ))}
        </div>

        <div className="mt-4 border border-line bg-panel/60 p-5">
          <label className="flex items-center gap-2 text-[12px] text-ink">
            <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} />
            Custom scope — name your own build and budget
          </label>
          {custom && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-[9px] uppercase tracking-[2px] text-dim">
                Setup budget (AUD)
                <input
                  type="number"
                  min={100}
                  max={100000}
                  value={customFee}
                  onChange={(e) => setCustomFee(Number(e.target.value))}
                  className="mt-1 block w-40 border border-line bg-panel2 px-3 py-2 text-[12px] tracking-normal text-ink outline-none focus:border-purple"
                />
              </label>
            </div>
          )}
        </div>

        <h2 className="mt-10 font-display text-xl font-black">Monthly care tier</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {TIERS.map((t) => (
            <button
              key={t.name}
              onClick={() => setTier(t.name)}
              className={`border p-4 text-left ${tier === t.name ? "border-green bg-panel" : "border-line bg-panel/60"}`}
            >
              <div className="font-display text-[15px] font-bold">{t.name}</div>
              <div className="text-[13px] text-green">{AUD(t.mrr)}/mo</div>
            </button>
          ))}
        </div>

        <section className="mt-10 max-w-xl border border-line bg-panel p-6">
          <h2 className="font-display text-lg font-black">Checkout</h2>
          <p className="mt-1 text-[12px] text-green">
            {AUD(fee)} setup + {AUD(mrr)}/mo — {packageName} / {tier}
          </p>

          <div className="mt-4 space-y-3">
            <Field label="Business name" value={biz} onChange={setBiz} />
            <Field label="Email" value={email} onChange={setEmail} type="email" />
            <label className="block text-[9px] uppercase tracking-[2px] text-dim">
              What do you want built?
              <textarea
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                rows={3}
                className="mt-1 w-full border border-line bg-panel2 px-3 py-2 text-[12px] normal-case tracking-normal text-ink outline-none focus:border-purple"
              />
            </label>
          </div>

          {error && <p className="mt-3 text-[11px] text-red">{error}</p>}

          {step === "choose" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                disabled={busy || !biz.trim() || !email.trim()}
                onClick={() => begin("paypal")}
                className="bg-green px-4 py-2.5 text-[11px] font-bold uppercase tracking-[1.5px] text-void disabled:opacity-50"
              >
                {busy ? "Working…" : `Pay ${AUD(fee)} — card or PayPal`}
              </button>
              <button
                disabled={busy || !biz.trim() || !email.trim()}
                onClick={() => begin("solana")}
                className="border border-purple px-4 py-2.5 text-[11px] font-bold uppercase tracking-[1.5px] text-purple disabled:opacity-50"
              >
                Pay with SOL
              </button>
            </div>
          )}

          {step === "paypal" && invoice && (
            <div className="mt-4 space-y-3 text-[12px] text-dim">
              <p>
                Finish the payment in the PayPal window
                {invoice.approveUrl && (
                  <>
                    {" "}
                    (
                    <a className="text-blue underline" href={invoice.approveUrl} target="_blank" rel="noopener noreferrer">
                      reopen it
                    </a>
                    )
                  </>
                )}
                , then confirm here.
              </p>
              <button
                disabled={busy}
                onClick={() => run(async () => { await confirm({ data: { paymentId: invoice.paymentId } }); setStep("done"); })}
                className="bg-purple px-4 py-2.5 text-[11px] font-bold uppercase tracking-[1.5px] text-white disabled:opacity-50"
              >
                {busy ? "Checking…" : "I've paid — confirm"}
              </button>
            </div>
          )}

          {step === "solana" && invoice && (
            <div className="mt-4 space-y-3 text-[12px] text-dim">
              <p>
                Send <span className="text-green">{invoice.solAmount} SOL</span> from Phantom to:
              </p>
              <code className="block break-all border border-line bg-panel2 p-2 text-[11px] text-ink">
                {invoice.recipient}
              </code>
              <input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Paste the transaction signature"
                className="w-full border border-line bg-panel2 px-3 py-2 text-[12px] text-ink outline-none focus:border-purple"
              />
              <button
                disabled={busy || signature.trim().length < 40}
                onClick={() =>
                  run(async () => {
                    await confirm({ data: { paymentId: invoice.paymentId, signature: signature.trim() } });
                    setStep("done");
                  })
                }
                className="bg-purple px-4 py-2.5 text-[11px] font-bold uppercase tracking-[1.5px] text-white disabled:opacity-50"
              >
                {busy ? "Verifying on chain…" : "Verify payment"}
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="mt-4 border border-green/40 bg-green/5 p-4 text-[12px] text-green">
              Payment confirmed. Your build is queued and you'll get an email from{" "}
              basham_x@proton.me with your kickoff questions and delivery timeline.
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block text-[9px] uppercase tracking-[2px] text-dim">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-line bg-panel2 px-3 py-2 text-[12px] normal-case tracking-normal text-ink outline-none focus:border-purple"
      />
    </label>
  );
}
