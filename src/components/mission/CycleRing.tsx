import { STAGES } from "@/lib/mission";

const CX = 150;
const CY = 150;
const R = 108;
const GATES = new Set(["PITCH", "CLOSE", "SHIP"]);

function polar(angleDeg: number, radius: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
}

function arc(startDeg: number, endDeg: number) {
  const s = polar(startDeg, R);
  const e = polar(endDeg, R);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`;
}

export function CycleRing({ cycles, activeStage }: { cycles: number; activeStage: number | null }) {
  const step = 360 / STAGES.length;

  return (
    <svg
      viewBox="0 0 300 300"
      className="block h-auto w-full"
      role="img"
      aria-label="Eight-stage business cycle with three Director approval gates"
    >
      {STAGES.map((name, i) => {
        const start = i * step + 2;
        const end = (i + 1) * step - 2;
        const active = activeStage === i;
        const gate = GATES.has(name);
        return (
          <path
            key={name}
            d={arc(start, end)}
            fill="none"
            strokeWidth={13}
            strokeLinecap="butt"
            className="transition-[stroke] duration-200"
            stroke={
              active
                ? gate
                  ? "var(--amber)"
                  : "var(--purple)"
                : "var(--panel2)"
            }
            style={
              active
                ? {
                    filter: `drop-shadow(0 0 6px ${gate ? "var(--amber)" : "var(--purple)"})`,
                  }
                : undefined
            }
          />
        );
      })}

      {STAGES.map((name, i) => {
        const mid = i * step + step / 2;
        const label = polar(mid, R + 24);
        const dot = polar(mid, R);
        const gate = GATES.has(name);
        return (
          <g key={`l-${name}`}>
            {gate && (
              <>
                <circle cx={dot.x} cy={dot.y} r={9} fill="var(--void)" stroke="var(--amber)" strokeWidth={2} />
                <text
                  x={dot.x}
                  y={dot.y + 3}
                  textAnchor="middle"
                  className="font-mono text-[8px] font-bold"
                  fill="var(--amber)"
                >
                  ⚿
                </text>
              </>
            )}
            <text
              x={label.x}
              y={label.y + 3}
              textAnchor="middle"
              className="font-mono text-[7.5px] tracking-[1px]"
              fill={activeStage === i ? "var(--ink)" : "var(--dim)"}
              fontWeight={activeStage === i ? 700 : 400}
            >
              {name}
            </text>
          </g>
        );
      })}

      <text x={CX} y={148} textAnchor="middle" className="font-display text-2xl font-extrabold" fill="var(--ink)">
        {cycles}
      </text>
      <text x={CX} y={166} textAnchor="middle" className="font-mono text-[7px] tracking-[3px]" fill="var(--dim)">
        CYCLES
      </text>
    </svg>
  );
}
