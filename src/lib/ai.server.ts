const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export class AiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** One tight, JSON-only call to Lovable AI. Never trusts free text. */
export async function aiJson<T>(system: string, prompt: string): Promise<T | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError(401, "AI is not configured on this project.");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: "google/gemini-3.8-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
      message = parsed.error?.message ?? parsed.message ?? text;
    } catch {
      /* keep raw text */
    }
    if (res.status === 429) throw new AiError(429, "AI is rate limited right now. Try the cycle again shortly.");
    if (res.status === 402) throw new AiError(402, message || "AI credits are exhausted. Top up to keep the loop running.");
    throw new AiError(res.status, message || `AI request failed (${res.status}).`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

/** Licence policy, decided on the server — never in the browser. */
export function classifyLicense(license: string): "permissive" | "copyleft" | "blocked" {
  const l = license.trim().toUpperCase();
  if (/^(MIT|APACHE[- ]?2(\.0)?|BSD([- ]?[23](-CLAUSE)?)?|ISC|UNLICENSE|MPL[- ]?2(\.0)?)$/.test(l)) {
    return "permissive";
  }
  if (/^(A?GPL)/.test(l) || l.includes("GPL")) return "copyleft";
  return "blocked";
}
