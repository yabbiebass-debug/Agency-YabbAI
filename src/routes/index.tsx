import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteNav } from "@/components/site/SiteNav";
import { AUD, PACKAGES, TIERS } from "@/lib/mission";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Basham Automations — AI Agents That Run Your Back Office" },
      {
        name: "description",
        content:
          "We build and run AI agent systems for small businesses: lead capture, follow-up, quoting and reporting. Fixed-price builds from $1,500 plus a monthly care tier. Pay online, build starts today.",
      },
      { property: "og:title", content: "Basham Automations — AI Agents That Run Your Back Office" },
      {
        property: "og:description",
        content: "Fixed-price AI automation builds from $1,500. Pay by card, PayPal or SOL and your build starts today.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const STEPS = [
  ["01 · Scope", "You tell us the bottleneck. We come back with a fixed price and a delivery date."],
  ["02 · Pay", "Card, PayPal or SOL. Payment confirms and the build enters the queue automatically."],
  ["03 · Build", "Our agent loop drafts, builds and tests — every client-facing step approved by a human."],
  ["04 · Ship", "You get the handover, the docs and a monthly tier that keeps improving it."],
];

const PROOF = [
  ["Human-approved", "No agent sends a message, closes a deal or moves money without your sign-off."],
  ["Licence-clean", "Every tool we ship is checked for commercial-use rights before it goes near your business."],
  ["Live dashboard", "Your work runs through a real operations console, not a spreadsheet."],
];

function Landing() {
  return (
    <div className="min-h-screen bg-void text-ink">
      <SiteNav />

      <section className="relative overflow-hidden border-b border-line">
        <img
          src={hero}
          alt="Abstract glowing network of automated workflows"
          width={1600}
          height={900}
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="relative mx-auto max-w-4xl px-5 py-24 text-center">
          <div className="inline-block border border-purple/50 px-3 py-1 text-[9px] uppercase tracking-[2.5px] text-purple">
            Basham Automations · Australia
          </div>
          <h1 className="mt-6 font-display text-4xl font-black leading-tight sm:text-6xl">
            AI agents that run the boring half of your business
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[14px] leading-relaxed text-dim">
            Lead capture, follow-up, quoting, scheduling and reporting — built once, run daily, watched by a
            human. Fixed price. No retainers you can't leave.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/pricing"
              className="bg-green px-6 py-3 text-[11px] font-bold uppercase tracking-[2px] text-void hover:shadow-[0_0_24px_rgba(0,255,136,.35)]"
            >
              Buy a package
            </Link>
            <Link
              to="/contact"
              className="border border-line px-6 py-3 text-[11px] font-bold uppercase tracking-[2px] text-ink hover:border-purple"
            >
              Get a quote
            </Link>
          </div>
          <p className="mt-4 text-[10px] uppercase tracking-[2px] text-dim">
            From {AUD(PACKAGES[0].fee)} setup + {AUD(TIERS[0].mrr)}/mo
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-5">
        <section className="grid gap-4 py-16 md:grid-cols-3">
          {PROOF.map(([t, d]) => (
            <div key={t} className="border border-line bg-panel p-6">
              <div className="font-display text-[16px] font-bold text-green">{t}</div>
              <p className="mt-2 text-[12px] leading-relaxed text-dim">{d}</p>
            </div>
          ))}
        </section>

        <section className="border-t border-line py-16">
          <h2 className="font-display text-2xl font-black">How it works</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {STEPS.map(([t, d]) => (
              <div key={t} className="border border-line bg-panel/60 p-5">
                <div className="text-[10px] uppercase tracking-[2px] text-purple">{t}</div>
                <p className="mt-2 text-[12px] leading-relaxed text-dim">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-line py-16">
          <h2 className="font-display text-2xl font-black">Packages</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PACKAGES.map((p) => (
              <div key={p.name} className="border border-line bg-panel p-6">
                <div className="font-display text-lg font-black">{p.name}</div>
                <div className="mt-1 text-[22px] font-bold text-green">{AUD(p.fee)}</div>
                <div className="text-[10px] uppercase tracking-[1.5px] text-dim">one-off setup</div>
                <Link
                  to="/pricing"
                  className="mt-5 block border border-purple px-4 py-2 text-center text-[10px] font-bold uppercase tracking-[2px] text-purple hover:bg-purple hover:text-white"
                >
                  Choose {p.name}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-dim">
            Need something else?{" "}
            <Link to="/pricing" className="text-purple underline">
              Set your own scope and budget
            </Link>
            .
          </p>
        </section>

        <section className="border-t border-line py-20 text-center">
          <h2 className="font-display text-3xl font-black">Ready to stop doing it manually?</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/pricing" className="bg-purple px-6 py-3 text-[11px] font-bold uppercase tracking-[2px] text-white">
              Buy now
            </Link>
            <Link to="/contact" className="border border-line px-6 py-3 text-[11px] font-bold uppercase tracking-[2px]">
              Enquire first
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
