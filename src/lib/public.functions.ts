import { createServerFn } from "@tanstack/react-start";

// Public storefront: enquiries and buy-now checkout for visitors who are not
// signed in. Everything runs server-side; a client is only ever created after
// the payment is verified against PayPal or the Solana chain.

const RECIPIENT = "HTN1fvHwbzKiMwh9YXZEe3eooiMdoCAs3TweWdiSZV5i";
const LAMPORTS = 1_000_000_000;
const MIN_AUD = 100;
const MAX_AUD = 100000;

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** The Director account that owns every public lead and payment. */
async function ownerId(db: Admin): Promise<string> {
  const fromEnv = process.env["OWNER_USER_ID"];
  if (fromEnv) return fromEnv;
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(error.message);
  const users = [...data.users].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const first = users[0];
  if (!first) throw new Error("The agency account is not set up yet.");
  return first.id;
}

function clean(v: unknown, max = 200) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function validAmount(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < MIN_AUD || v > MAX_AUD) {
    throw new Error(`Amount must be between $${MIN_AUD} and $${MAX_AUD}.`);
  }
  return Math.round(v);
}

/** Public enquiry form → a real lead in the Director's pipeline. */
export const submitEnquiry = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      biz: string; email: string; phone?: string; niche?: string; suburb?: string; pain?: string;
    }) => {
      const biz = clean(input?.biz, 120);
      const email = clean(input?.email, 160);
      if (!biz) throw new Error("Tell us your business name.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("That email does not look right.");
      return {
        biz, email,
        phone: clean(input?.phone, 40),
        niche: clean(input?.niche, 80),
        suburb: clean(input?.suburb, 80),
        pain: clean(input?.pain, 800),
      };
    },
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const owner = await ownerId(db);
    const { error } = await db.from("leads").insert({
      owner, biz: data.biz, email: data.email,
      phone: data.phone || null,
      niche: data.niche || null,
      suburb: data.suburb || null,
      pain: data.pain || null,
      source: "website",
      stage: "New",
    });
    if (error) throw new Error(error.message);

    await db.from("events").insert({
      owner, agent: "SCOUT", message: `website enquiry — ${data.biz} (${data.email})`,
    });
    return { ok: true };
  });

function paypalBase() {
  return process.env["PAYPAL_ENV"] === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

async function paypalToken(): Promise<string> {
  const id = process.env["PAYPAL_CLIENT_ID"];
  const secret = process.env["PAYPAL_CLIENT_SECRET"];
  if (!id || !secret) throw new Error("Card payments are not configured yet.");
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("PayPal rejected the app credentials.");
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("PayPal did not return an access token.");
  return json.access_token;
}

async function solPriceAud(): Promise<number> {
  const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=aud");
  if (!res.ok) throw new Error("Could not read the current SOL price. Try again in a moment.");
  const json = (await res.json()) as { solana?: { aud?: number } };
  const price = json.solana?.aud;
  if (!price || price <= 0) throw new Error("Could not read the current SOL price. Try again in a moment.");
  return price;
}

/** Start a public checkout. Records a pending payment and returns the payment step. */
export const startCheckout = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      method: "paypal" | "solana";
      biz: string; email: string; packageName: string; tier: string;
      amountAud: number; mrr: number; scope?: string; returnUrl: string;
    }) => {
      const biz = clean(input?.biz, 120);
      const email = clean(input?.email, 160);
      if (!biz) throw new Error("Tell us your business name.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("That email does not look right.");
      if (input?.method !== "paypal" && input?.method !== "solana") throw new Error("Pick a payment method.");
      return {
        method: input.method, biz, email,
        packageName: clean(input?.packageName, 60) || "Custom build",
        tier: clean(input?.tier, 60) || "Maintain",
        amountAud: validAmount(input?.amountAud),
        mrr: Math.max(0, Math.round(Number(input?.mrr ?? 0))),
        scope: clean(input?.scope, 800),
        returnUrl: clean(input?.returnUrl, 300),
      };
    },
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const owner = await ownerId(db);

    const { data: lead, error: leadError } = await db
      .from("leads")
      .insert({
        owner, biz: data.biz, email: data.email, source: "website",
        stage: "Awaiting close",
        pain: data.scope || null,
        notes: `Self-serve checkout — ${data.packageName} / ${data.tier}`,
      })
      .select("id")
      .single();
    if (leadError) throw new Error(leadError.message);

    const base = {
      owner, lead_id: lead.id, purpose: "setup", biz: data.biz,
      package: data.packageName, tier: data.tier,
      amount_aud: data.amountAud, mrr: data.mrr, status: "pending",
    };

    if (data.method === "paypal") {
      const token = await paypalToken();
      const res = await fetch(`${paypalBase()}/v2/checkout/orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: { currency_code: "AUD", value: data.amountAud.toFixed(2) },
              description: `${data.packageName} setup — ${data.biz}`.slice(0, 127),
            },
          ],
          application_context: {
            brand_name: "YABBAI",
            user_action: "PAY_NOW",
            return_url: data.returnUrl,
            cancel_url: data.returnUrl,
          },
        }),
      });
      if (!res.ok) throw new Error("PayPal could not start this checkout. Try again shortly.");
      const order = (await res.json()) as { id: string; links?: { rel: string; href: string }[] };
      const approveUrl = order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;

      const { data: row, error } = await db
        .from("payments")
        .insert({ ...base, method: "paypal", reference: order.id })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      await db.from("events").insert({
        owner, agent: "TREASURER",
        message: `website checkout started (PayPal) — ${data.biz} $${data.amountAud}`,
      });
      return { paymentId: row.id, approveUrl, solAmount: null as number | null, recipient: null as string | null };
    }

    const price = await solPriceAud();
    const solAmount = Number((data.amountAud / price).toFixed(6));
    const { data: row, error } = await db
      .from("payments")
      .insert({ ...base, method: "solana", sol_amount: solAmount, recipient: RECIPIENT })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await db.from("events").insert({
      owner, agent: "TREASURER",
      message: `website checkout started (SOL) — ${data.biz} ${solAmount} SOL`,
    });
    return { paymentId: row.id, approveUrl: null as string | null, solAmount, recipient: RECIPIENT };
  });

type RpcTx = {
  result?: {
    meta?: { err: unknown; preBalances: number[]; postBalances: number[] } | null;
    transaction?: { message?: { accountKeys?: (string | { pubkey: string })[] } };
  } | null;
  error?: { message?: string };
};

/** Confirm a public checkout server-side, then create the client. */
export const confirmCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: { paymentId: string; signature?: string }) => {
    if (!input?.paymentId) throw new Error("Checkout not found.");
    return { paymentId: clean(input.paymentId, 60), signature: clean(input?.signature, 120) };
  })
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: payment, error } = await db
      .from("payments")
      .select("*")
      .eq("id", data.paymentId)
      .single();
    if (error || !payment) throw new Error("Checkout not found.");
    if (payment.status === "confirmed") return { status: "confirmed" as const };

    if (payment.method === "paypal") {
      if (!payment.reference) throw new Error("This checkout has no PayPal order attached.");
      const token = await paypalToken();
      const res = await fetch(`${paypalBase()}/v2/checkout/orders/${payment.reference}/capture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      });
      const body = (await res.json().catch(() => ({}))) as {
        status?: string;
        details?: { issue?: string; description?: string }[];
        purchase_units?: {
          payments?: { captures?: { status?: string; amount?: { value?: string; currency_code?: string } }[] };
        }[];
      };
      if (!res.ok) {
        const issue = body.details?.[0];
        if (issue?.issue === "ORDER_NOT_APPROVED") {
          throw new Error("Finish the payment in the PayPal window, then press confirm again.");
        }
        throw new Error(issue?.description ?? "PayPal could not take this payment.");
      }
      const capture = body.purchase_units?.[0]?.payments?.captures?.[0];
      if (body.status !== "COMPLETED" || capture?.status !== "COMPLETED") {
        throw new Error("PayPal has not completed this payment yet.");
      }
      const paid = Number(capture.amount?.value ?? 0);
      if (capture.amount?.currency_code !== "AUD" || paid < Number(payment.amount_aud) * 0.99) {
        throw new Error("The amount received does not match this order.");
      }
    } else if (payment.method === "solana") {
      if (!data.signature || data.signature.length < 40) {
        throw new Error("Paste the Solana transaction signature from your wallet.");
      }
      const res = await fetch(process.env["SOLANA_RPC_URL"] ?? "https://api.mainnet-beta.solana.com", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "getTransaction",
          params: [data.signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }],
        }),
      });
      if (!res.ok) throw new Error("Could not reach the Solana network. Try again.");
      const json = (await res.json()) as RpcTx;
      if (json.error) throw new Error(json.error.message ?? "Solana lookup failed.");
      const tx = json.result;
      if (!tx?.meta) throw new Error("Transaction not confirmed yet. Wait a few seconds and retry.");
      if (tx.meta.err) throw new Error("That transaction failed on chain.");
      const keys = (tx.transaction?.message?.accountKeys ?? []).map((k) =>
        typeof k === "string" ? k : k.pubkey,
      );
      const idx = keys.indexOf(RECIPIENT);
      if (idx === -1) throw new Error("That transaction did not pay the agency wallet.");
      const received = ((tx.meta.postBalances[idx] ?? 0) - (tx.meta.preBalances[idx] ?? 0)) / LAMPORTS;
      if (received < Number(payment.sol_amount ?? 0) * 0.99) {
        throw new Error("The wallet received less than the invoice amount.");
      }
      const { error: dupe } = await db
        .from("payments")
        .update({ reference: data.signature })
        .eq("id", payment.id);
      if (dupe) throw new Error("That transaction has already been used.");
    } else {
      throw new Error("Unsupported payment method.");
    }

    const { error: updateError } = await db
      .from("payments")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", payment.id);
    if (updateError) throw new Error(updateError.message);

    const { error: rpcError } = await db.rpc("create_client_from_payment", { p_payment_id: payment.id });
    if (rpcError) throw new Error(rpcError.message);

    return { status: "confirmed" as const };
  });
