import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { PulseGame, type RunResult } from "@/components/pulse/PulseGame";
import { LEVELS, TIER_COLOR, type Level } from "@/lib/pulse/levels";

export const Route = createFileRoute("/pulse")({
  head: () => ({
    meta: [
      { title: "YABBAI PULSE — Neon 4-Lane Rhythm Game" },
      {
        name: "description",
        content:
          "Five escalating levels of synthesized neon rhythm. Hit the beat, build combo, earn in-game $BARS with the HASH MINER overclock simulation.",
      },
      { property: "og:title", content: "YABBAI PULSE — Neon 4-Lane Rhythm Game" },
      {
        property: "og:description",
        content: "Four lanes, five live-synthesized tracks, tiered in-game $BARS. Play in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pulse,
});

interface Best { tier: string; accuracy: number; bars: number }

interface Breakdown {
  base: number; comboBonus: number; minerBonus: number; persistBonus: number; total: number;
}

function Pulse() {
  const [screen, setScreen] = useState<"select" | "play" | "results">("select");
  const [level, setLevel] = useState<Level>(LEVELS[0]!);
  const [result, setResult] = useState<(RunResult & { breakdown: Breakdown }) | null>(null);
  const [session, setSession] = useState(0);
  const [retries, setRetries] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [best, setBest] = useState<Record<number, Best>>({});

  const start = (l: Level, isRetry = false) => {
    setLevel(l);
    if (isRetry) setRetries((r) => r + 1);
    setScreen("play");
  };

  const onFinish = useCallback(
    (r: RunResult) => {
      const playtime = seconds + r.seconds;
      const base = Math.round(level.base * (r.accuracy / 100));
      const comboBonus = Math.round(level.base * (r.maxCombo / 200));
      const minerBonus = Math.floor(r.hashpower);
      const persistBonus = retries * 5 + Math.floor(playtime / 60) * 3;
      const total = base + comboBonus + minerBonus + persistBonus;
      setSeconds(playtime);
      setSession((s) => s + total);
      setBest((b) => {
        const prev = b[level.id];
        if (prev && prev.accuracy >= r.accuracy) return b;
        return { ...b, [level.id]: { tier: r.tier, accuracy: r.accuracy, bars: total } };
      });
      setResult({ ...r, breakdown: { base, comboBonus, minerBonus, persistBonus, total } });
      setScreen("results");
    },
    [level, retries, seconds],
  );

  const exit = useCallback(() => setScreen("select"), []);

  return (
    <main className="min-h-screen bg-void px-4 py-8 text-ink">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-black tracking-tight text-ink">
              YABBAI <span className="text-purple">PULSE</span>
            </h1>
            <p className="mt-1 font-mono text-[11px] text-dim">
              4 lanes · 5 live-synthesized levels · D F J K or tap
            </p>
          </div>
          <div className="border border-line bg-panel px-4 py-2 text-right">
            <div className="font-mono text-[9px] uppercase tracking-[2px] text-dim">Session $BARS</div>
            <div className="font-display text-xl font-black text-green">{session.toLocaleString()}</div>
          </div>
        </header>

        {screen === "select" && (
          <section>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {LEVELS.map((l) => {
                const b = best[l.id];
                return (
                  <button
                    key={l.id}
                    onClick={() => { setRetries(0); start(l); }}
                    className="group border border-line bg-panel p-4 text-left transition-colors hover:border-purple focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-display text-[15px] font-black">{l.name}</span>
                      <span className="font-mono text-[10px] text-dim">{l.bpm} BPM</span>
                    </div>
                    <div className="mt-2 font-mono text-[10px] uppercase tracking-[1.5px] text-amber">
                      {l.difficulty} {"★".repeat(l.stars)}
                      <span className="text-dim">{"☆".repeat(5 - l.stars)}</span>
                    </div>
                    <div className="mt-2 font-mono text-[11px] text-green">base {l.base}+ $BARS tier</div>
                    <div className="mt-2 font-mono text-[10px] text-dim">
                      {b ? (
                        <>
                          best <span style={{ color: TIER_COLOR[b.tier] }}>{b.tier}</span>{" "}
                          {b.accuracy.toFixed(1)}% · {b.bars} $BARS
                        </>
                      ) : (
                        "no run yet"
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-6 font-mono text-[10px] leading-relaxed text-dim">
              $BARS are in-game points; the HASH MINER is a themed simulation that pays in-game $BARS — no
              real mining, no cash-out.
            </p>
          </section>
        )}

        {screen === "play" && <PulseGame level={level} onFinish={onFinish} onExit={exit} />}

        {screen === "results" && result && (
          <section className="mx-auto max-w-md border border-line bg-panel p-6 text-center">
            <div
              className="font-display text-3xl font-black"
              style={{ color: TIER_COLOR[result.tier] }}
            >
              {result.tier}
            </div>
            <div className="mt-1 font-mono text-[12px] text-dim">
              {level.name} · {result.accuracy.toFixed(2)}% · max combo {result.maxCombo}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px]">
              <div className="border border-line p-2">
                <div className="text-green">{result.perfect}</div>
                <div className="text-[9px] uppercase tracking-[1.5px] text-dim">Perfect</div>
              </div>
              <div className="border border-line p-2">
                <div className="text-blue" style={{ color: "#5ad1ff" }}>{result.good}</div>
                <div className="text-[9px] uppercase tracking-[1.5px] text-dim">Good</div>
              </div>
              <div className="border border-line p-2">
                <div className="text-red">{result.miss}</div>
                <div className="text-[9px] uppercase tracking-[1.5px] text-dim">Miss</div>
              </div>
            </div>

            <div className="mt-4 space-y-1 border-t border-line pt-4 text-left font-mono text-[11px]">
              <Row label="Base (difficulty × accuracy)" value={result.breakdown.base} />
              <Row label="Combo bonus" value={result.breakdown.comboBonus} />
              <Row label="Overclock bonus (miner sim)" value={result.breakdown.minerBonus} />
              <Row label="Persistence" value={result.breakdown.persistBonus} />
              <div className="flex justify-between border-t border-line pt-2 font-bold text-green">
                <span>Total $BARS</span>
                <span>+{result.breakdown.total}</span>
              </div>
            </div>

            <div className="mt-3 font-mono text-[10px] text-dim">
              session {session} $BARS · {retries} retries · {seconds}s played
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {level.id < LEVELS.length - 1 && (
                <button
                  onClick={() => { setRetries(0); start(LEVELS[level.id + 1]!); }}
                  className="bg-purple px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-white"
                >
                  Next level
                </button>
              )}
              <button
                onClick={() => start(level, true)}
                className="border border-green px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-green"
              >
                Retry
              </button>
              <button
                onClick={exit}
                className="border border-line px-4 py-2 font-mono text-[10px] uppercase tracking-[1.5px] text-dim hover:text-ink"
              >
                Levels
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-dim">
      <span>{label}</span>
      <span className="text-ink">+{value}</span>
    </div>
  );
}
