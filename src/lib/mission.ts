export const STAGES = [
  "SCOUT",
  "QUALIFY",
  "PITCH",
  "CLOSE",
  "BUILD",
  "SHIP",
  "SUPPORT",
  "REINVEST",
] as const;

export const GATED: Record<string, boolean> = {
  PITCH: true,
  SHIP: true,
  CLOSE: false,
};

export const AGENTS: { name: string; role: string }[] = [
  { name: "SCOUT", role: "finds prospects, attaches the audit hook" },
  { name: "QUALIFIER", role: "scores fit against the ICP" },
  { name: "PITCHER", role: "drafts outreach + proposals (gated)" },
  { name: "BUILDER", role: "assembles templated deliverables" },
  { name: "SHIPPER", role: "QA and handover (gated)" },
  { name: "SUPPORTER", role: "churn flags and save plays" },
  { name: "FORGE", role: "build-vs-buy with licence policy" },
  { name: "TREASURER", role: "reads the money, never moves it" },
];

export const PACKAGES = [
  { name: "Starter", fee: 1500 },
  { name: "Growth", fee: 4000 },
  { name: "Full Ops", fee: 8000 },
] as const;

export const TIERS = [
  { name: "Maintain", mrr: 500 },
  { name: "Optimize", mrr: 1500 },
  { name: "Scale", mrr: 3500 },
] as const;

export const SOL_RECIPIENT = "HTN1fvHwbzKiMwh9YXZEe3eooiMdoCAs3TweWdiSZV5i";

export const AUD = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-AU");

export type Lead = {
  id: string;
  biz: string;
  niche: string | null;
  suburb: string | null;
  pain: string | null;
  email: string | null;
  phone: string | null;
  fit: string | null;
  score: number | null;
  stage: string;
  source: string;
  notes: string | null;
  created_at: string;
};

export type Client = {
  id: string;
  biz: string;
  package: string | null;
  setup_fee: number;
  setup_paid: boolean;
  tier: string | null;
  mrr: number;
  status: string;
  build_pct: number;
  health: string;
  created_via: string;
  created_at: string;
};

export type Approval = {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  payload: Record<string, unknown>;
  agent: string;
  license: string | null;
  license_class: string | null;
  status: string;
  created_at: string;
};

export type MissionEvent = {
  id: string;
  cycle_n: number;
  agent: string;
  message: string;
  created_at: string;
};

export type Payment = {
  id: string;
  method: string;
  purpose: string;
  biz: string | null;
  package: string | null;
  tier: string | null;
  amount_aud: number;
  mrr: number;
  sol_amount: number | null;
  recipient: string | null;
  reference: string | null;
  status: string;
  client_id: string | null;
  created_at: string;
};
