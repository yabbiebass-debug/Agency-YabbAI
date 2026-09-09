import { useEffect, useRef } from "react";
import { PulseAudio } from "@/lib/pulse/audio";
import {
  buildChart, GOOD_WINDOW, LANE_COLORS, PERFECT_WINDOW, TIER,
  type Level, type Note,
} from "@/lib/pulse/levels";

export interface RunResult {
  perfect: number;
  good: number;
  miss: number;
  maxCombo: number;
  accuracy: number;
  hashpower: number;
  tier: string;
  seconds: number;
}

interface Popup { lane: number; text: string; born: number; color: string }

export function PulseGame({
  level, onFinish, onExit,
}: { level: Level; onFinish: (r: RunResult) => void; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hitRef = useRef<(lane: number) => void>(() => {});
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const chart = buildChart(level);
    const notes: Note[] = chart.notes.map((n) => ({ ...n }));
    const audio = new PulseAudio();
    let audioStart = 0;
    let evIndex = 0;
    let raf = 0;
    let schedTimer: ReturnType<typeof setInterval> | undefined;
    let done = false;
    let lastFrame = 0;

    const stats = { perfect: 0, good: 0, miss: 0 };
    let combo = 0;
    let maxCombo = 0;
    let miner = 0;
    let hashpower = 0;
    const popups: Popup[] = [];

    let W = 0, H = 0, hitY = 0, laneW = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = rect.width;
      H = rect.height;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      hitY = H * 0.84;
      laneW = (W - 54) / 4;
    };
    resize();
    window.addEventListener("resize", resize);

    const songPos = () => audio.ctx.currentTime - audioStart;

    const judge = (lane: number) => {
      const now = songPos();
      let best: Note | null = null;
      let bestD = Infinity;
      for (const n of notes) {
        if (n.judged || n.lane !== lane) continue;
        const d = Math.abs(n.t - now);
        if (d < bestD) { bestD = d; best = n; }
        if (n.t - now > GOOD_WINDOW) break;
      }
      if (!best || bestD > GOOD_WINDOW) return;
      best.judged = true;
      best.hit = true;
      const perfect = bestD <= PERFECT_WINDOW;
      if (perfect) { stats.perfect++; miner += 6; } else { stats.good++; miner += 3; }
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      miner = Math.max(0, Math.min(100, miner));
      popups.push({
        lane, text: perfect ? "PERFECT" : "GOOD", born: performance.now(),
        color: perfect ? "#14F195" : "#5ad1ff",
      });
      audio.blip();
    };
    hitRef.current = judge;

    const keyMap: Record<string, number> = {
      d: 0, f: 1, j: 2, k: 3, "1": 0, "2": 1, "3": 2, "4": 3,
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "Escape") { onExit(); return; }
      const lane = keyMap[e.key.toLowerCase()];
      if (lane === undefined) return;
      e.preventDefault();
      judge(lane);
    };
    window.addEventListener("keydown", onKey);

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - 12;
      const lane = Math.floor(x / laneW);
      if (lane >= 0 && lane < 4) judge(lane);
    };
    canvas.addEventListener("pointerdown", onPointer);

    const finish = () => {
      if (done) return;
      done = true;
      const total = stats.perfect + stats.good + stats.miss;
      const accuracy = total ? ((stats.perfect + 0.5 * stats.good) / total) * 100 : 0;
      finishRef.current({
        ...stats, maxCombo, accuracy, hashpower,
        tier: TIER(accuracy), seconds: Math.max(0, Math.round(songPos())),
      });
    };

    const scheduler = () => {
      const lookahead = 0.12;
      while (evIndex < chart.events.length) {
        const ev = chart.events[evIndex]!;
        if (ev.t + audioStart >= audio.ctx.currentTime + lookahead) break;
        audio.play(ev, ev.t + audioStart, level.wave);
        evIndex++;
      }
    };

    const draw = (now: number) => {
      const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
      lastFrame = now;
      const pos = songPos();

      // miner sim
      miner = Math.max(0, Math.min(100, miner - 4 * dt));
      const oc = 1 + (miner / 100) * 2;
      const cf = Math.min(2, 1 + combo / 60);
      if (pos > 0) hashpower += oc * cf * dt * 2.2;

      // misses
      for (const n of notes) {
        if (!n.judged && pos - n.t > GOOD_WINDOW) {
          n.judged = true;
          stats.miss++;
          combo = 0;
          miner = Math.max(0, miner - 18);
          popups.push({ lane: n.lane, text: "MISS", born: now, color: "#ff6a6a" });
        }
      }

      const pxPerSec = (hitY + 30) / level.approach;
      ctx2d.clearRect(0, 0, W, H);
      ctx2d.fillStyle = "#02060f";
      ctx2d.fillRect(0, 0, W, H);

      // lanes
      for (let i = 0; i < 4; i++) {
        const x = 12 + i * laneW;
        ctx2d.fillStyle = i % 2 ? "rgba(8,18,38,0.7)" : "rgba(8,18,38,0.45)";
        ctx2d.fillRect(x, 0, laneW - 4, H);
        ctx2d.strokeStyle = "rgba(91,111,153,0.18)";
        ctx2d.strokeRect(x + 0.5, 0.5, laneW - 5, H - 1);
      }

      // hit line
      ctx2d.save();
      ctx2d.shadowBlur = reduced ? 0 : 18;
      ctx2d.shadowColor = "#5ad1ff";
      ctx2d.strokeStyle = "#5ad1ff";
      ctx2d.lineWidth = 3;
      ctx2d.beginPath();
      ctx2d.moveTo(12, hitY);
      ctx2d.lineTo(12 + laneW * 4 - 4, hitY);
      ctx2d.stroke();
      ctx2d.restore();

      // notes
      for (const n of notes) {
        if (n.hit) continue;
        const y = hitY - (n.t - pos) * pxPerSec;
        if (y < -40 || y > H + 40) continue;
        if (n.judged && !n.hit && y > hitY + 40) continue;
        const x = 12 + n.lane * laneW + 8;
        const w = laneW - 20;
        ctx2d.save();
        ctx2d.shadowBlur = reduced ? 0 : 14;
        ctx2d.shadowColor = LANE_COLORS[n.lane]!;
        ctx2d.fillStyle = LANE_COLORS[n.lane]!;
        ctx2d.globalAlpha = n.judged ? 0.25 : 1;
        const r = 6;
        ctx2d.beginPath();
        ctx2d.roundRect(x, y - 9, w, 18, r);
        ctx2d.fill();
        ctx2d.restore();
      }

      // lane key caps
      const caps = ["D", "F", "J", "K"];
      ctx2d.font = "700 12px 'JetBrains Mono', monospace";
      ctx2d.textAlign = "center";
      for (let i = 0; i < 4; i++) {
        ctx2d.fillStyle = "rgba(207,227,255,0.55)";
        ctx2d.fillText(caps[i]!, 12 + i * laneW + laneW / 2 - 2, H - 12);
      }

      // progress
      const pct = Math.max(0, Math.min(1, pos / chart.duration));
      ctx2d.fillStyle = "rgba(91,111,153,0.25)";
      ctx2d.fillRect(0, 0, W, 4);
      ctx2d.fillStyle = "#9945FF";
      ctx2d.fillRect(0, 0, W * pct, 4);

      // HUD
      const totalJ = stats.perfect + stats.good + stats.miss;
      const acc = totalJ ? ((stats.perfect + 0.5 * stats.good) / totalJ) * 100 : 100;
      ctx2d.textAlign = "left";
      ctx2d.font = "700 13px 'JetBrains Mono', monospace";
      ctx2d.fillStyle = "#14F195";
      ctx2d.fillText(`${acc.toFixed(1)}%`, 14, 26);
      ctx2d.textAlign = "right";
      ctx2d.fillStyle = "#cfe3ff";
      ctx2d.fillText(`${level.name} · ${level.bpm} BPM`, W - 62, 26);

      if (combo > 1) {
        ctx2d.textAlign = "center";
        ctx2d.font = "900 46px 'Unbounded', sans-serif";
        ctx2d.fillStyle = "rgba(207,227,255,0.9)";
        ctx2d.fillText(String(combo), W / 2, H * 0.4);
        ctx2d.font = "700 11px 'JetBrains Mono', monospace";
        ctx2d.fillStyle = "#5b6f99";
        ctx2d.fillText("COMBO", W / 2, H * 0.4 + 18);
      }

      // count-in
      if (pos < 0) {
        ctx2d.textAlign = "center";
        ctx2d.font = "900 26px 'Unbounded', sans-serif";
        ctx2d.fillStyle = "#F5A623";
        ctx2d.fillText("GET READY", W / 2, H * 0.55);
      }

      // miner meter
      const mx = W - 40, my = 60, mh = H * 0.5, mw = 16;
      ctx2d.fillStyle = "rgba(8,18,38,0.9)";
      ctx2d.fillRect(mx, my, mw, mh);
      ctx2d.strokeStyle = "rgba(91,111,153,0.4)";
      ctx2d.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);
      const fill = (miner / 100) * mh;
      ctx2d.save();
      ctx2d.shadowBlur = reduced ? 0 : 12;
      ctx2d.shadowColor = "#14F195";
      ctx2d.fillStyle = "#14F195";
      ctx2d.fillRect(mx, my + mh - fill, mw, fill);
      ctx2d.restore();
      ctx2d.textAlign = "center";
      ctx2d.font = "700 11px 'JetBrains Mono', monospace";
      ctx2d.fillStyle = "#F5A623";
      ctx2d.fillText(`x${oc.toFixed(2)}`, mx + mw / 2, my - 8);
      ctx2d.save();
      ctx2d.translate(mx + mw / 2 + 14, my + mh / 2);
      ctx2d.rotate(Math.PI / 2);
      ctx2d.fillStyle = "#5b6f99";
      ctx2d.font = "700 9px 'JetBrains Mono', monospace";
      ctx2d.fillText("HASH MINER (SIM)", 0, 0);
      ctx2d.restore();

      // popups
      for (let i = popups.length - 1; i >= 0; i--) {
        const p = popups[i]!;
        const age = (now - p.born) / 700;
        if (age > 1) { popups.splice(i, 1); continue; }
        ctx2d.globalAlpha = 1 - age;
        ctx2d.textAlign = "center";
        ctx2d.font = "900 14px 'Unbounded', sans-serif";
        ctx2d.fillStyle = p.color;
        ctx2d.fillText(p.text, 12 + p.lane * laneW + laneW / 2, hitY - 40 - age * 34);
        ctx2d.globalAlpha = 1;
      }

      if (pos > chart.duration) { finish(); return; }
      raf = requestAnimationFrame(draw);
    };

    void audio.resume().then(() => {
      audioStart = audio.ctx.currentTime + 1.0;
      schedTimer = setInterval(scheduler, 25);
      raf = requestAnimationFrame(draw);
    });

    return () => {
      done = true;
      cancelAnimationFrame(raf);
      if (schedTimer) clearInterval(schedTimer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onPointer);
      audio.close();
    };
  }, [level, onExit]);

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <canvas
        ref={canvasRef}
        className="h-[68vh] max-h-[720px] min-h-[420px] w-full touch-none rounded-md border border-line"
        aria-label={`${level.name} playfield`}
      />
      <div className="mt-3 grid grid-cols-4 gap-2">
        {["D", "F", "J", "K"].map((k, i) => (
          <button
            key={k}
            onPointerDown={(e) => { e.preventDefault(); hitRef.current(i); }}
            style={{ borderColor: LANE_COLORS[i], color: LANE_COLORS[i] }}
            className="touch-none border bg-panel py-4 font-mono text-[13px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {k}
          </button>
        ))}
      </div>
      <button
        onClick={onExit}
        className="mt-3 border border-line px-4 py-2 font-mono text-[10px] uppercase tracking-[1.5px] text-dim hover:text-ink"
      >
        Quit to levels
      </button>
    </div>
  );
}
