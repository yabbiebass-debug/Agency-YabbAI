import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RECIPIENT = "HTN1fvHwbzKiMwh9YXZEe3eooiMdoCAs3TweWdiSZV5i";
const LAMPORTS = 1_000_000_000;

function rpcUrl() {
  return process.env["SOLANA_RPC_URL"] ?? "https://api.mainnet-beta.solana.com";
}

async function solPriceAud(): Promise<number> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=aud",
  );
  if (!res.ok) throw new Error("Could not read the current SOL price. Try again in a moment.");
  const json = (await res.json()) as { solana?: { aud?: number } };
  const price = json.solana?.aud;
  if (!price || price <= 0) throw new Error("Could not read the current SOL price. Try again in a moment.");
  return price;
}

/** Create a crypto invoice: amount in AUD converted to SOL, paid to the agency wallet. */
export const createSolanaInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      leadId?: string | null;
      biz: string;
      package: string;
      tier: string;
      amountAud: number;
      mrr: number;
    }) => {
      if (!input?.biz?.trim()) throw new Error("Business name is required.");
      if (!(input.amountAud > 0)) throw new Error("Amount must be greater than zero.");
      return {
        leadId: input.leadId ?? null,
        biz: input.biz.trim(),
        package: input.package,
        tier: input.tier,
        amountAud: Number(input.amountAud),
        mrr: Number(input.mrr ?? 0),
      };
    },
  )
  .handler(async ({ data, context }) => {
    const price = await solPriceAud();
    const solAmount = Number((data.amountAud / price).toFixed(6));

    const { data: row, error } = await context.supabase
      .from("payments")
      .insert({
        owner: context.userId,
        lead_id: data.leadId,
        method: "solana",
        purpose: "setup",
        biz: data.biz,
        package: data.package,
        tier: data.tier,
        amount_aud: data.amountAud,
        mrr: data.mrr,
        sol_amount: solAmount,
        recipient: RECIPIENT,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("events").insert({
      owner: context.userId,
      agent: "TREASURER",
      message: `crypto invoice raised — ${data.biz} $${data.amountAud} (${solAmount} SOL)`,
    });

    return { paymentId: row.id, solAmount, recipient: RECIPIENT, priceAud: price };
  });

type RpcTx = {
  result?: {
    meta?: {
      err: unknown;
      preBalances: number[];
      postBalances: number[];
    } | null;
    transaction?: { message?: { accountKeys?: (string | { pubkey: string })[] } };
    slot?: number;
  } | null;
  error?: { message?: string };
};

/** Verify a Solana payment on chain, then create the client. Server-side only. */
export const verifySolanaPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string; signature: string }) => {
    if (!input?.paymentId) throw new Error("Payment is required.");
    const sig = (input.signature ?? "").trim();
    if (sig.length < 40) throw new Error("That does not look like a Solana transaction signature.");
    return { paymentId: input.paymentId, signature: sig };
  })
  .handler(async ({ data, context }) => {
    const { data: payment, error } = await context.supabase
      .from("payments")
      .select("*")
      .eq("id", data.paymentId)
      .single();
    if (error || !payment) throw new Error("Invoice not found.");
    if (payment.status === "confirmed") return { status: "confirmed", clientId: payment.client_id };

    const res = await fetch(rpcUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          data.signature,
          { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 },
        ],
      }),
    });
    if (!res.ok) throw new Error("Could not reach the Solana network. Try again.");
    const json = (await res.json()) as RpcTx;
    if (json.error) throw new Error(json.error.message ?? "Solana lookup failed.");

    const tx = json.result;
    if (!tx || !tx.meta) throw new Error("Transaction not found or not confirmed yet. Wait a few seconds and retry.");
    if (tx.meta.err) throw new Error("That transaction failed on chain.");

    const keys = (tx.transaction?.message?.accountKeys ?? []).map((k) =>
      typeof k === "string" ? k : k.pubkey,
    );
    const idx = keys.indexOf(RECIPIENT);
    if (idx === -1) throw new Error("That transaction did not pay the agency wallet.");

    const received =
      ((tx.meta.postBalances[idx] ?? 0) - (tx.meta.preBalances[idx] ?? 0)) / LAMPORTS;
    const expected = Number(payment.sol_amount ?? 0);
    if (received < expected * 0.99) {
      throw new Error(
        `Underpaid: the wallet received ${received.toFixed(4)} SOL, invoice is ${expected} SOL.`,
      );
    }

    const { error: updateError } = await context.supabase
      .from("payments")
      .update({ status: "confirmed", reference: data.signature, confirmed_at: new Date().toISOString() })
      .eq("id", payment.id);
    if (updateError) {
      if (updateError.code === "23505") throw new Error("That transaction has already been used for another invoice.");
      throw new Error(updateError.message);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: clientId, error: rpcError } = await supabaseAdmin.rpc("create_client_from_payment", {
      p_payment_id: payment.id,
    });
    if (rpcError) throw new Error(rpcError.message);

    return { status: "confirmed", clientId: clientId as string, received };
  });
