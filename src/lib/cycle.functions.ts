import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { aiJson, AiError, classifyLicense } from "./ai.server";

const QUALIFIER_SYS = `You score inbound leads for a done-for-you automation agency serving Australian small service businesses (1-10 staff: trades, clinics, gyms, real estate/accommodation, NDIS). Score 0-100 on ICP fit from business type, stated pain, and buying signals. Reply with ONLY JSON: {"score":0-100,"fit":"Hot|Warm|Cold","reason":"one sentence"}. Never invent details not present in the lead.`;

const PITCHER_SYS = `You draft cold outreach for an automation agency (AU small service businesses). Given a prospect, write a specific, non-salesy first touch. Lead with a concrete observation about THEIR business and one automation that saves time or wins leads. Offer a free automation audit as the hook. Under 90 words. Reply with ONLY JSON: {"subject":"","email":"","dm":""}.`;

const BUILDER_SYS = `You are the delivery agent for an automation agency. Given a client's package and current build percentage, name the next templated deliverable shipped this cycle and the new build percentage (increase by 20-35, never above 100). Reply with ONLY JSON: {"deliverable":"short phrase","build_pct":0-100}.`;

const SUPPORTER_SYS = `You write short retention save plays for an automation agency's at-risk clients. Reply with ONLY JSON: {"play":"two sentences, concrete, one quick win this week"}.`;

const TREASURER_SYS = `You are a read-only finance analyst. You never move money. Given MRR, cash collected and active client count for an AU automation agency, give one reinvestment signal. Reply with ONLY JSON: {"signal":"one sentence"}.`;

export const runCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const owner = context.userId;

    const { count } = await supabase.from("cycles").select("*", { count: "exact", head: true });
    const n = (count ?? 0) + 1;
    await supabase.from("cycles").insert({ n, owner });

    const log = (agent: string, message: string) =>
      supabase.from("events").insert({ agent, message, cycle_n: n, owner });

    const summary = {
      qualified: 0,
      drafted: 0,
      built: 0,
      shipped: 0,
      saves: 0,
    };
    const notes: string[] = [];

    try {
      // ---------- QUALIFY ----------
      const { data: unscored } = await supabase
        .from("leads")
        .select("*")
        .is("fit", null)
        .neq("stage", "Dead")
        .limit(5);

      for (const l of unscored ?? []) {
        const j = await aiJson<{ score: number; fit: string; reason: string }>(
          QUALIFIER_SYS,
          `Business: ${l.biz}\nNiche: ${l.niche ?? "?"}\nSuburb: ${l.suburb ?? "?"}\nPain: ${l.pain ?? "?"}\nNotes: ${l.notes ?? ""}`,
        );
        if (!j) continue;
        const fit = ["Hot", "Warm", "Cold"].includes(j.fit) ? j.fit : "Warm";
        await supabase
          .from("leads")
          .update({
            score: Math.max(0, Math.min(100, Math.round(j.score ?? 0))),
            fit,
            stage: fit === "Cold" ? "Dead" : l.stage,
          })
          .eq("id", l.id);
        summary.qualified++;
      }
      if (summary.qualified) await log("QUALIFIER", `scored ${summary.qualified} lead(s) against the ICP`);

      // ---------- PITCH (gate) ----------
      const { data: hot } = await supabase
        .from("leads")
        .select("*")
        .eq("fit", "Hot")
        .eq("stage", "New")
        .limit(3);

      for (const l of hot ?? []) {
        const j = await aiJson<{ subject: string; email: string; dm: string }>(
          PITCHER_SYS,
          `Business: ${l.biz}\nNiche: ${l.niche ?? "?"}\nSuburb: ${l.suburb ?? "?"}\nPain: ${l.pain ?? "?"}`,
        );
        if (!j?.email) continue;
        await supabase.from("leads").update({ stage: "Outreach drafted" }).eq("id", l.id);
        await supabase.from("approvals").insert({
          owner,
          type: "outreach",
          title: `Send outreach → ${l.biz}`,
          detail: `Subject: ${j.subject}\n\n${j.email}\n\nDM: ${j.dm ?? ""}`,
          agent: "PITCHER",
          payload: { lead_id: l.id, draft: j },
        });
        summary.drafted++;
      }
      if (summary.drafted) await log("PITCHER", `queued ${summary.drafted} outreach draft(s) for your approval`);

      // ---------- BUILD ----------
      const { data: building } = await supabase
        .from("clients")
        .select("*")
        .eq("status", "Onboarding")
        .limit(5);

      for (const c of building ?? []) {
        const j = await aiJson<{ deliverable: string; build_pct: number }>(
          BUILDER_SYS,
          `Client: ${c.biz}\nPackage: ${c.package ?? "?"}\nCurrent build: ${c.build_pct}%`,
        );
        const pct = Math.max(
          c.build_pct,
          Math.min(100, Math.round(j?.build_pct ?? c.build_pct + 25)),
        );
        await supabase
          .from("clients")
          .update({ build_pct: pct, status: pct >= 100 ? "QA" : "Onboarding" })
          .eq("id", c.id);
        await log("BUILDER", `${c.biz}: ${j?.deliverable ?? "deliverable shipped"} — build ${pct}%`);
        summary.built++;
      }

      // ---------- SHIP (gate) ----------
      const { data: qa } = await supabase.from("clients").select("*").eq("status", "QA");
      for (const c of qa ?? []) {
        await supabase.from("clients").update({ status: "Ship pending" }).eq("id", c.id);
        await supabase.from("approvals").insert({
          owner,
          type: "ship",
          title: `Ship build → ${c.biz}`,
          detail: `${c.package ?? "Build"} passed QA end-to-end. Approving starts the ${c.tier ?? "retainer"} $${c.mrr}/mo retainer.`,
          agent: "SHIPPER",
          payload: { client_id: c.id },
        });
        summary.shipped++;
      }
      if (summary.shipped) await log("SHIPPER", `queued ${summary.shipped} ship gate(s) for your approval`);

      // ---------- SUPPORT ----------
      const { data: risky } = await supabase.from("clients").select("id,biz").eq("health", "risk");
      for (const c of risky ?? []) {
        const { count: pend } = await supabase
          .from("approvals")
          .select("*", { count: "exact", head: true })
          .eq("type", "save")
          .eq("status", "pending")
          .eq("payload->>client_id", c.id);
        if (pend) continue;
        const j = await aiJson<{ play: string }>(SUPPORTER_SYS, `Client: ${c.biz}. Payment failed or activity dropped.`);
        await supabase.from("approvals").insert({
          owner,
          type: "save",
          title: `Churn risk → ${c.biz}`,
          detail: j?.play ?? "Check-in call plus one quick win this week.",
          agent: "SUPPORTER",
          payload: { client_id: c.id },
        });
        summary.saves++;
      }
      if (summary.saves) await log("SUPPORTER", `flagged ${summary.saves} churn risk(s) with save plays`);

      // ---------- REINVEST (read-only money) ----------
      const { data: money } = await supabase.from("money_view").select("*").maybeSingle();
      const mrr = Number(money?.mrr ?? 0);
      const cash = Number(money?.cash_collected ?? 0);
      const active = Number(money?.active_clients ?? 0);
      const j = await aiJson<{ signal: string }>(
        TREASURER_SYS,
        `MRR: $${mrr}/mo. Cash collected: $${cash}. Active clients: ${active}.`,
      );
      await log(
        "TREASURER",
        `MRR $${mrr}/mo · cash $${cash} · ${active} active — ${j?.signal ?? "manual outreach, zero spend"}`,
      );

      await supabase.from("cycles").update({ summary }).eq("n", n).eq("owner", owner);
      return { cycle: n, summary, notes };
    } catch (error) {
      const message = error instanceof AiError ? error.message : "Cycle failed.";
      await log("SYSTEM", `cycle ${n} halted: ${message}`);
      throw new Error(message);
    }
  });

/** FORGE: evaluate a candidate open-source tool. Licence policy is server-side. */
export const evaluateForgeCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; license: string; note?: string }) => {
    if (!input?.name?.trim()) throw new Error("Name is required.");
    if (!input?.license?.trim()) throw new Error("Licence is required.");
    return {
      name: input.name.trim(),
      license: input.license.trim(),
      note: (input.note ?? "").trim(),
    };
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const owner = context.userId;
    const licenseClass = classifyLicense(data.license);

    const detail =
      licenseClass === "permissive"
        ? `${data.note || "Build-vs-buy candidate."}\n\nLicence ${data.license} — permissive. Fork and adapt is clean.`
        : licenseClass === "copyleft"
          ? `${data.note || "Build-vs-buy candidate."}\n\nLicence ${data.license} — copyleft. Fine in-house; redistributing to clients carries source-disclosure obligations.`
          : `${data.note || "Build-vs-buy candidate."}\n\nLicence ${data.license} — blocked. Cloning a closed product is not a fork; this can never be approved.`;

    const { data: approval, error } = await supabase
      .from("approvals")
      .insert({
        owner,
        type: "fork",
        title: `Build-vs-buy: ${data.name}`,
        detail,
        agent: "FORGE",
        license: data.license,
        license_class: licenseClass,
        payload: { name: data.name },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("forge_evaluations").insert({
      owner,
      name: data.name,
      license: data.license,
      license_class: licenseClass,
      note: data.note || null,
      approval_id: approval.id,
    });

    await supabase.from("events").insert({
      owner,
      agent: "FORGE",
      message: `licence check ${data.name} (${data.license}) → ${licenseClass}`,
    });

    return { licenseClass };
  });
