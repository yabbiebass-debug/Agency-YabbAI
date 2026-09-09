import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SiteFooter, SiteNav } from "@/components/site/SiteNav";
import { submitEnquiry } from "@/lib/public.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Enquire — Basham Automations" },
      {
        name: "description",
        content:
          "Tell us what you want automated. Send an enquiry and get a scoped, fixed-price answer back — no sales call required.",
      },
      { property: "og:title", content: "Enquire — Basham Automations" },
      {
        property: "og:description",
        content: "Send your business, your bottleneck and your budget. You get a scoped quote back.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const send = useServerFn(submitEnquiry);
  const [form, setForm] = useState({ biz: "", email: "", phone: "", niche: "", suburb: "", pain: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await send({ data: form });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-void text-ink">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-5 py-12">
        <h1 className="font-display text-3xl font-black">Tell us what's slowing you down</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-dim">
          One form. We scope it, price it and come back to you. If you already know what you want, you can{" "}
          <Link to="/pricing" className="text-purple underline">
            buy a package outright
          </Link>{" "}
          instead.
        </p>

        {sent ? (
          <div className="mt-8 border border-green/40 bg-green/5 p-6 text-[13px] text-green">
            Got it — your enquiry is in the pipeline. We'll reply to {form.email} shortly.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-3 border border-line bg-panel p-6">
            <F label="Business name" value={form.biz} onChange={set("biz")} required />
            <F label="Email" value={form.email} onChange={set("email")} type="email" required />
            <F label="Phone (optional)" value={form.phone} onChange={set("phone")} />
            <div className="grid gap-3 sm:grid-cols-2">
              <F label="Industry" value={form.niche} onChange={set("niche")} />
              <F label="Suburb / city" value={form.suburb} onChange={set("suburb")} />
            </div>
            <label className="block text-[9px] uppercase tracking-[2px] text-dim">
              What needs fixing?
              <textarea
                rows={5}
                value={form.pain}
                onChange={(e) => set("pain")(e.target.value)}
                className="mt-1 w-full border border-line bg-panel2 px-3 py-2 text-[12px] normal-case tracking-normal text-ink outline-none focus:border-purple"
              />
            </label>
            {error && <p className="text-[11px] text-red">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-purple px-4 py-2.5 text-[11px] font-bold uppercase tracking-[1.5px] text-white disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send enquiry"}
            </button>
          </form>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function F({
  label, value, onChange, type = "text", required,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block text-[9px] uppercase tracking-[2px] text-dim">
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-line bg-panel2 px-3 py-2 text-[12px] normal-case tracking-normal text-ink outline-none focus:border-purple"
      />
    </label>
  );
}
