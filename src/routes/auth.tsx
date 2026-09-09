import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Director Sign-in — YABBAI Mission Control" },
      {
        name: "description",
        content:
          "Director sign-in for YABBAI Mission Control: the agent operating system running the pipeline, gates, builds and retainers for Basham Automations.",
      },
      { property: "og:title", content: "Director Sign-in — YABBAI Mission Control" },
      {
        property: "og:description",
        content:
          "Sign in to run the loop: leads, drafts, Director gates, builds, retainers — on real data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/mission-control", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "in") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate({ to: "/mission-control", replace: true });
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
        if (data.session) navigate({ to: "/mission-control", replace: true });
        else setMessage("Check your email to confirm the account, then sign in.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-void px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-[15px] font-extrabold tracking-[0.5px] text-ink">
          YABBAI <span className="text-purple">//</span> MISSION CONTROL
        </h1>
        <p className="mt-1 text-[9.5px] uppercase tracking-[2px] text-dim">
          Basham Automations · Agent Operating System · Director Edition
        </p>

        <form
          onSubmit={submit}
          className="mt-7 space-y-3 border border-line bg-panel p-5"
        >
          <label className="block text-[9px] uppercase tracking-[2px] text-dim">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full border border-line bg-panel2 px-3 py-2 text-[12px] normal-case tracking-normal text-ink outline-none focus:border-purple"
            />
          </label>
          <label className="block text-[9px] uppercase tracking-[2px] text-dim">
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border border-line bg-panel2 px-3 py-2 text-[12px] normal-case tracking-normal text-ink outline-none focus:border-purple"
            />
          </label>

          {error && <p className="text-[11px] text-red">{error}</p>}
          {message && <p className="text-[11px] text-green">{message}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-purple px-4 py-2.5 text-[11px] font-bold uppercase tracking-[1.5px] text-white transition hover:shadow-[0_0_18px_rgba(153,69,255,.5)] disabled:opacity-50"
          >
            {busy ? "Working…" : mode === "in" ? "Sign in" : "Create account"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "in" ? "up" : "in");
              setError(null);
              setMessage(null);
            }}
            className="w-full text-[10px] uppercase tracking-[1.5px] text-dim hover:text-ink"
          >
            {mode === "in" ? "No account yet? Create one" : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
