import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function paypalBase() {
  return process.env["PAYPAL_ENV"] === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

async function paypalToken(): Promise<string> {
  const id = process.env["PAYPAL_CLIENT_ID"];
  const secret = process.env["PAYPAL_CLIENT_SECRET"];
  if (!id || !secret) throw new Error("PayPal is not configured.");

  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("PayPal rejected the app credentials. Check the client ID and secret.");
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("PayPal did not return an access token.");
  return json.access_token;
}

/** Raise a PayPal invoice for a client. Funds land in the Director's PayPal business account. */
export const createPaypalOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      leadId?: string | null;
      biz: string;
      package: string;
      tier: string;
      amountAud: number;
      mrr: number;
      returnUrl: string;
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
        returnUrl: input.returnUrl,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const token = await paypalToken();
    const amount = data.amountAud.toFixed(2);

    const res = await fetch(`${paypalBase()}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: { currency_code: "AUD", value: amount },
            description: `${data.package} setup — ${data.biz}`.slice(0, 127),
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
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`PayPal could not create the invoice. ${text.slice(0, 200)}`);
    }
    const order = (await res.json()) as { id: string; links?: { rel: string; href: string }[] };
    const approveUrl = order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;

    const { data: row, error } = await context.supabase
      .from("payments")
      .insert({
        owner: context.userId,
        lead_id: data.leadId,
        method: "paypal",
        purpose: "setup",
        biz: data.biz,
        package: data.package,
        tier: data.tier,
        amount_aud: data.amountAud,
        mrr: data.mrr,
        reference: order.id,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("events").insert({
      owner: context.userId,
      agent: "TREASURER",
      message: `PayPal invoice raised — ${data.biz} $${data.amountAud}`,
    });

    return { paymentId: row.id, orderId: order.id, approveUrl };
  });

/** Capture an approved PayPal order, then create the client from the confirmed payment. */
export const capturePaypalOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string }) => {
    if (!input?.paymentId) throw new Error("Payment is required.");
    return { paymentId: input.paymentId };
  })
  .handler(async ({ data, context }) => {
    const { data: payment, error } = await context.supabase
      .from("payments")
      .select("*")
      .eq("id", data.paymentId)
      .single();
    if (error || !payment) throw new Error("Invoice not found.");
    if (payment.status === "confirmed") return { status: "confirmed", clientId: payment.client_id };
    if (!payment.reference) throw new Error("This invoice has no PayPal order attached.");

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
        throw new Error("The buyer has not approved this PayPal payment yet.");
      }
      throw new Error(issue?.description ?? "PayPal could not capture this payment.");
    }

    const capture = body.purchase_units?.[0]?.payments?.captures?.[0];
    if (body.status !== "COMPLETED" || capture?.status !== "COMPLETED") {
      throw new Error("PayPal has not completed this payment yet.");
    }

    const paid = Number(capture.amount?.value ?? 0);
    if (capture.amount?.currency_code !== "AUD" || paid < Number(payment.amount_aud) * 0.99) {
      throw new Error(`Underpaid: PayPal received ${paid} ${capture.amount?.currency_code ?? ""}.`);
    }

    const { error: updateError } = await context.supabase
      .from("payments")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", payment.id);
    if (updateError) throw new Error(updateError.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: clientId, error: rpcError } = await supabaseAdmin.rpc("create_client_from_payment", {
      p_payment_id: payment.id,
    });
    if (rpcError) throw new Error(rpcError.message);

    return { status: "confirmed", clientId: clientId as string };
  });
