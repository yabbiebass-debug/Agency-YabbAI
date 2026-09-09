import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { runCycle, evaluateForgeCandidate } from "@/lib/cycle.functions";
import {
  AGENTS,
  AUD,
  STAGES,
  type Approval,
  type Client,
  type Lead,
  type MissionEvent,
  type Payment,
} from "@/lib/mission";
import { CycleRing } from "@/components/mission/CycleRing";
import { PaymentDialog } from "@/components/mission/PaymentDialog";

export const Route = createFileRoute("/_authenticated/mission-control")({
  head: () => ({
    meta: [
      { title: "Mission Control — YABBAI Agent Operating System" },
      {
        name: "description",
        content:
          "Run the loop: live pipeline, Director approval gates, client builds, retainers and treasury on real data.",
      },
      { property: "og:title", content: "Mission Control — YABBAI Agent Operating System" },
      {
        property: "og:description",
        content: "Live pipeline, approval gates, builds and retainers in one console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MissionControl,
});

const TABS = ["Pipeline", "Clients", "Cycle log", "Model & wiring"] as const;
type Tab = (typeof TABS)[number];

type TableName = "leads" | "clients" | "approvals" | "events" | "payments";

function useTable<T>(key: string, table: TableName, order: string) {
  return useQuery({
    queryKey: [key],
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select("*").order(order, { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as T[];
    },
  });
}

function MissionControl() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("Pipeline");
  const [activeStage, setActiveStage] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [closing, setClosing] = useState<Lead | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [autoCycle, setAutoCycle] = useState(false);

  const leads = useTable<Lead>("leads", "leads", "created_at");
  const clients = useTable<Client>("clients", "clients", "created_at");
  const approvals = useTable<Approval>("approvals", "approvals", "created_at");
  const events = useTable<MissionEvent>("events", "events", "created_at");
  const payments = useTable<Payment>("payments", "payments", "created_at");
  const cycles = useQuery({
    queryKey: ["cycles"],
    queryFn: async () => {
      const { count, error } = await supabase.from("cycles").select("*", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("mission")
      .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
        const table = (payload as { table?: string }).table;
        if (table) qc.invalidateQueries({ queryKey: [table] });
        qc.invalidateQueries({ queryKey: ["cycles"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const pending = useMemo(
    () => (approvals.data ?? []).filter((a) => a.status === "pending"),
    [approvals.data],
  );
  const activeClients = useMemo(() => clients.data ?? [], [clients.data]);
  const mrr = activeClients.reduce((s, c) => s + Number(c.mrr), 0);
  const cash = (payments.data ?? [])
    .filter((p) => p.status === "confirmed")
    .reduce((s, p) => s + Number(p.amount_aud), 0);
  const pipelineValue = (leads.data ?? [])
    .filter((l) => !["Won", "Lost"].includes(l.stage))
    .length;

  const cycleFn = useServerFn(runCycle);
  const forgeFn = useServerFn(evaluateForgeCandidate);

  async function act(fn: () => Promise<unknown>, note?: string) {
    setBanner(null);
    try {
      await fn();
      qc.invalidateQueries();
      if (note) setBanner(note);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleRunCycle() {
    setRunning(true);
    setBanner(null);
    try {
      for (let i = 0; i < STAGES.length; i++) {
        setActiveStage(i);
        await new Promise((r) => setTimeout(r, 140));
      }
      const res = await cycleFn({});
      qc.invalidateQueries();
      setBanner(
        `Cycle ${res.cycle} done — ${res.summary.qualified} scored, ${res.summary.drafted} drafts queued, ${res.summary.built} builds moved, ${res.summary.shipped} ready to ship.`,
      );
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "The cycle could not finish.");
    } finally {
      setActiveStage(null);
      setRunning(false);
    }
  }

  // restore the saved "leave the cycle on" preference after hydration
  useEffect(() => {
    if (window.localStorage.getItem("yabbai.autocycle") === "on") setAutoCycle(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("yabbai.autocycle", autoCycle ? "on" : "off");
    if (!autoCycle) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled || running) return;
      void handleRunCycle();
    };
    const first = window.setTimeout(tick, 2000);
    const timer = window.setInterval(tick, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCycle]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-void text-ink">
      {/* command bar */}
      <header className="flex flex-wrap items-center gap-5 border-b border-line bg-gradient-to-b from-purple/[0.06] to-transparent px-5 py-3.5">
        <div>
          <div className="font-display text-[15px] font-extrabold tracking-[0.5px]">
            YABBAI <b className="text-purple">MISSION CONTROL</b>
          </div>
          <small className="block text-[9.5px] tracking-[2px] text-dim">
            BASHAM AUTOMATIONS · AGENT OPERATING SYSTEM
          </small>
        </div>

        <div className="ml-auto flex flex-wrap gap-6">
          <Kpi label="MRR" value={AUD(mrr)} tone="green" />
          <Kpi label="Cash in" value={AUD(cash)} tone="green" />
          <Kpi label="Clients" value={String(activeClients.length)} tone="ink" />
          <Kpi label="Open leads" value={String(pipelineValue)} tone="purple" />
          <Kpi label="Gates open" value={String(pending.length)} tone="amber" />
        </div>

        <div className="flex items-center gap-2.5">
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-[2px] border px-3 py-2.5 text-[10px] uppercase tracking-[1.5px] ${
              autoCycle ? "border-green text-green" : "border-line text-dim"
            }`}
            title="Keep the loop running by itself every 5 minutes while this console is open"
          >
            <input
              type="checkbox"
              checked={autoCycle}
              onChange={(e) => setAutoCycle(e.target.checked)}
              className="accent-green"
            />
            Auto cycle{autoCycle ? " on" : ""}
          </label>
          <button
            onClick={handleRunCycle}
            disabled={running}
            className="rounded-[2px] bg-purple px-4 py-2.5 text-[11px] font-bold uppercase tracking-[1.5px] text-white transition hover:shadow-[0_0_18px_rgba(153,69,255,.5)] disabled:opacity-50"
          >
            {running ? "Running…" : "Run cycle"}
          </button>
          <button
            onClick={signOut}
            className="rounded-[2px] border border-line px-3 py-2.5 text-[10px] uppercase tracking-[1.5px] text-dim hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </header>

      {banner && (
        <div className="border-b border-line bg-panel px-5 py-2 text-[11px] text-amber">{banner}</div>
      )}

      <div className="grid gap-4 p-4 lg:grid-cols-[300px_1fr_340px]">
        {/* left: ring + agents */}
        <aside className="space-y-4">
          <Panel title="The loop">
            <CycleRing cycles={cycles.data ?? 0} activeStage={activeStage} />
            <p className="mt-2 text-[10px] leading-relaxed text-dim">
              Amber keys are your gates: outreach, proposals and shipping never leave the building
              without you. Closing a deal is human-only.
            </p>
          </Panel>
          <Panel title="Agents">
            <ul className="space-y-2">
              {AGENTS.map((a) => (
                <li key={a.name} className="border-l-2 border-purple/40 pl-2">
                  <div className="text-[11px] font-bold tracking-[1px] text-ink">{a.name}</div>
                  <div className="text-[10px] text-dim">{a.role}</div>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>

        {/* middle: tabs */}
        <main className="space-y-3">
          <nav className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`border px-3 py-1.5 text-[10px] uppercase tracking-[1.5px] ${
                  tab === t ? "border-purple text-purple" : "border-line text-dim hover:text-ink"
                }`}
              >
                {t}
              </button>
            ))}
            {tab === "Pipeline" && (
              <button
                onClick={() => setAddOpen(true)}
                className="ml-auto border border-green px-3 py-1.5 text-[10px] uppercase tracking-[1.5px] text-green"
              >
                + Add lead
              </button>
            )}
          </nav>

          {tab === "Pipeline" && (
            <Panel title={`Pipeline — ${leads.data?.length ?? 0} leads`}>
              {(leads.data ?? []).length === 0 && (
                <Empty text="No leads yet. Add one, then run a cycle to have the agents score it and draft outreach." />
              )}
              <div className="space-y-2">
                {(leads.data ?? []).map((l) => (
                  <div key={l.id} className="border border-line bg-panel2 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-bold text-ink">{l.biz}</span>
                      <span className="text-[10px] text-dim">
                        {[l.niche, l.suburb].filter(Boolean).join(" · ")}
                      </span>
                      <span className="ml-auto text-[10px] uppercase tracking-[1.5px] text-purple">
                        {l.stage}
                      </span>
                      {l.score !== null && (
                        <span className="text-[10px] text-dim">score {l.score}</span>
                      )}
                    </div>
                    {l.pain && <p className="mt-1 text-[11px] text-dim">{l.pain}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {["Contacted", "New"].includes(l.stage) && (
                        <SmallBtn
                          onClick={() => act(async () => {
                            const { error } = await supabase.rpc("mark_replied", { p_lead_id: l.id });
                            if (error) throw new Error(error.message);
                          }, `${l.biz} marked as replied — proposal queued for your approval.`)}
                        >
                          Mark replied
                        </SmallBtn>
                      )}
                      {["Awaiting close", "Replied"].includes(l.stage) && (
                        <SmallBtn tone="green" onClick={() => setClosing(l)}>
                          Close deal
                        </SmallBtn>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {tab === "Clients" && (
            <Panel title={`Clients — ${AUD(mrr)}/mo`}>
              {activeClients.length === 0 && <Empty text="No clients yet. Close a deal to start one." />}
              <div className="space-y-2">
                {activeClients.map((c) => (
                  <div key={c.id} className="border border-line bg-panel2 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-bold">{c.biz}</span>
                      <span className="text-[10px] text-dim">
                        {c.package} · {c.tier}
                      </span>
                      <span className="ml-auto text-[12px] text-green">{AUD(c.mrr)}/mo</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-panel">
                        <div
                          className="h-full bg-purple"
                          style={{ width: `${Math.min(100, c.build_pct)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-dim">{c.build_pct}%</span>
                      <span
                        className={`text-[10px] uppercase tracking-[1.5px] ${
                          c.health === "ok" ? "text-dim" : "text-red"
                        }`}
                      >
                        {c.status} · {c.health}
                      </span>
                    </div>
                    <div className="mt-1 text-[9px] uppercase tracking-[1.5px] text-dim2">
                      created via {c.created_via.replace("_", " ")}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {tab === "Cycle log" && (
            <Panel title="Cycle log">
              {(events.data ?? []).length === 0 && <Empty text="Nothing logged yet." />}
              <div className="max-h-[520px] space-y-1 overflow-y-auto">
                {(events.data ?? []).map((e) => (
                  <div key={e.id} className="flex gap-2 border-b border-line/50 py-1.5 text-[11px]">
                    <span className="w-[76px] shrink-0 text-dim2">
                      {new Date(e.created_at).toLocaleTimeString("en-AU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="w-[76px] shrink-0 font-bold text-purple">{e.agent}</span>
                    <span className="text-dim">{e.message}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {tab === "Model & wiring" && (
            <ModelPanel
              onForge={(name, license) =>
                act(
                  () => forgeFn({ data: { name, license } }),
                  "Licence checked. Anything permissive is queued for your approval.",
                )
              }
              payments={payments.data ?? []}
            />
          )}
        </main>

        {/* right: approvals */}
        <aside>
          <Panel title={`Approval queue — ${pending.length}`}>
            {pending.length === 0 && <Empty text="Nothing waiting on you. Run a cycle." />}
            <div className="space-y-2">
              {pending.map((a) => (
                <div key={a.id} className="border border-amber/40 bg-panel2 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-[1.5px] text-amber">{a.type}</span>
                    <span className="ml-auto text-[9px] uppercase tracking-[1.5px] text-dim">
                      {a.agent}
                    </span>
                  </div>
                  <div className="mt-1 text-[12px] font-bold">{a.title}</div>
                  {a.detail && <p className="mt-1 text-[11px] text-dim">{a.detail}</p>}
                  {a.license && (
                    <p className="mt-1 text-[10px] uppercase tracking-[1.5px] text-dim2">
                      licence {a.license} · {a.license_class}
                    </p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <SmallBtn
                      tone="green"
                      onClick={() =>
                        act(async () => {
                          const { error } = await supabase.rpc("approve_approval", { p_id: a.id });
                          if (error) throw new Error(error.message);
                        }, "Approved.")
                      }
                    >
                      Approve
                    </SmallBtn>
                    <SmallBtn
                      tone="red"
                      onClick={() =>
                        act(async () => {
                          const { error } = await supabase.rpc("reject_approval", { p_id: a.id });
                          if (error) throw new Error(error.message);
                        }, "Rejected.")
                      }
                    >
                      Reject
                    </SmallBtn>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>

      {closing && (
        <PaymentDialog
          lead={closing}
          onClose={() => setClosing(null)}
          onDone={() => {
            setClosing(null);
            qc.invalidateQueries();
            setBanner("Client created and money recorded.");
          }}
        />
      )}
      {addOpen && (
        <AddLeadDialog
          onClose={() => setAddOpen(false)}
          onDone={() => {
            setAddOpen(false);
            qc.invalidateQueries({ queryKey: ["leads"] });
          }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  const color =
    tone === "green" ? "text-green" : tone === "purple" ? "text-purple" : tone === "amber" ? "text-amber" : "text-ink";
  return (
    <div className="text-right">
      <div className={`font-display text-[17px] font-semibold ${color}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-[2px] text-dim">{label}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-line bg-panel p-4">
      <h2 className="mb-3 text-[9px] uppercase tracking-[2px] text-dim">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[11px] text-dim2">{text}</p>;
}

function SmallBtn({
  children,
  onClick,
  tone = "purple",
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "purple" | "green" | "red";
}) {
  const cls =
    tone === "green"
      ? "border-green text-green"
      : tone === "red"
        ? "border-red text-red"
        : "border-purple text-purple";
  return (
    <button
      onClick={onClick}
      className={`border px-2.5 py-1 text-[10px] uppercase tracking-[1.5px] ${cls} hover:opacity-80`}
    >
      {children}
    </button>
  );
}

function ModelPanel({
  onForge,
  payments,
}: {
  onForge: (name: string, license: string) => void;
  payments: Payment[];
}) {
  const [name, setName] = useState("");
  const [license, setLicense] = useState("MIT");

  return (
    <div className="space-y-3">
      <Panel title="How the money works">
        <ul className="space-y-1.5 text-[11px] text-dim">
          <li>Build packages: Starter $1,500 · Growth $4,000 · Full Ops $8,000 (one-off).</li>
          <li>Retainers: Maintain $500 · Optimize $1,500 · Scale $3,500 per month.</li>
          <li>Payments accepted: PayPal business and SOL to your Phantom wallet.</li>
          <li>Every payment is verified server-side before a client can exist.</li>
        </ul>
      </Panel>

      <Panel title="Payments ledger">
        {payments.length === 0 && <Empty text="No payments recorded yet." />}
        <div className="space-y-1">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center gap-2 border-b border-line/50 py-1.5 text-[11px]">
              <span className="w-[60px] uppercase tracking-[1px] text-purple">{p.method}</span>
              <span className="flex-1 text-ink">{p.biz}</span>
              <span className="text-dim">
                {p.sol_amount ? `${p.sol_amount} SOL` : AUD(Number(p.amount_aud))}
              </span>
              <span className={p.status === "confirmed" ? "text-green" : "text-amber"}>{p.status}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Forge — build vs buy">
        <p className="mb-2 text-[11px] text-dim">
          Check any open-source tool before it goes near a client build. Permissive licences get queued
          for your approval; anything unknown or proprietary is blocked outright.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tool or repo name"
            className="min-w-[160px] flex-1 border border-line bg-panel2 px-2 py-2 text-[11px] text-ink outline-none focus:border-purple"
          />
          <input
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            placeholder="Licence"
            className="w-[120px] border border-line bg-panel2 px-2 py-2 text-[11px] text-ink outline-none focus:border-purple"
          />
          <SmallBtn onClick={() => name.trim() && onForge(name.trim(), license.trim())}>
            Evaluate
          </SmallBtn>
        </div>
      </Panel>
    </div>
  );
}

function AddLeadDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ biz: "", niche: "", suburb: "", pain: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = (key: keyof typeof form, label: string) => (
    <label className="block text-[9px] uppercase tracking-[2px] text-dim">
      {label}
      <input
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="mt-1 w-full border border-line bg-panel2 px-3 py-2 text-[12px] tracking-normal text-ink outline-none focus:border-purple"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md border border-line bg-panel p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[14px] font-bold">Add a lead</h2>
          <button onClick={onClose} className="text-dim hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {field("biz", "Business name")}
          <div className="grid grid-cols-2 gap-3">
            {field("niche", "Niche")}
            {field("suburb", "Suburb")}
          </div>
          {field("pain", "Pain / hook")}
          <div className="grid grid-cols-2 gap-3">
            {field("email", "Email")}
            {field("phone", "Phone")}
          </div>
          {error && <p className="text-[11px] text-red">{error}</p>}
          <button
            disabled={busy || !form.biz.trim()}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const { error: err } = await supabase.from("leads").insert({
                biz: form.biz.trim(),
                niche: form.niche || null,
                suburb: form.suburb || null,
                pain: form.pain || null,
                email: form.email || null,
                phone: form.phone || null,
                source: "manual",
              });
              setBusy(false);
              if (err) setError(err.message);
              else onDone();
            }}
            className="w-full bg-purple px-4 py-2.5 text-[11px] font-bold uppercase tracking-[1.5px] text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add lead"}
          </button>
        </div>
      </div>
    </div>
  );
}
