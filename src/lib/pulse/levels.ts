// YABBAI PULSE — deterministic level + chart generation.
// Pure data/math; safe on server and client.

export type Wave = "triangle" | "sawtooth" | "square";
export type Density = "quarter" | "eighth" | "e+sync" | "16th" | "dense16";

export interface Level {
  id: number;
  name: string;
  bpm: number;
  bars: number;
  approach: number;
  wave: Wave;
  scaleName: string;
  scale: number[];
  root: number;
  difficulty: string;
  stars: number;
  base: number;
  density: Density;
}

export const SCALES: Record<string, number[]> = {
  minPent: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  wholeish: [0, 2, 4, 6, 8, 10],
};

export const LEVELS: Level[] = [
  {
    id: 0, name: "BOOT SEQUENCE", bpm: 96, bars: 16, approach: 1.5, wave: "triangle",
    scaleName: "minPent", scale: SCALES["minPent"]!, root: 57, difficulty: "WARMUP",
    stars: 1, base: 40, density: "quarter",
  },
  {
    id: 1, name: "NEON DRIFT", bpm: 124, bars: 18, approach: 1.25, wave: "sawtooth",
    scaleName: "dorian", scale: SCALES["dorian"]!, root: 55, difficulty: "EASY",
    stars: 2, base: 70, density: "eighth",
  },
  {
    id: 2, name: "GRID SURGE", bpm: 142, bars: 20, approach: 1.05, wave: "sawtooth",
    scaleName: "phrygian", scale: SCALES["phrygian"]!, root: 53, difficulty: "MEDIUM",
    stars: 3, base: 110, density: "e+sync",
  },
  {
    id: 3, name: "OVERCLOCK", bpm: 162, bars: 22, approach: 0.92, wave: "square",
    scaleName: "harmonic", scale: SCALES["harmonic"]!, root: 52, difficulty: "HARD",
    stars: 4, base: 155, density: "16th",
  },
  {
    id: 4, name: "VOID PROTOCOL", bpm: 182, bars: 24, approach: 0.8, wave: "square",
    scaleName: "wholeish", scale: SCALES["wholeish"]!, root: 50, difficulty: "INSANE",
    stars: 5, base: 210, density: "dense16",
  },
];

const ALL16 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const EVEN16 = [0, 2, 4, 6, 8, 10, 12, 14];

interface Pattern { kick: number[]; snare: number[]; hat: number[]; lead: number[] }

export const PATTERNS: Record<Density, Pattern> = {
  quarter: { kick: [0, 8], snare: [8], hat: [0, 4, 8, 12], lead: [0, 8] },
  eighth: { kick: [0, 8], snare: [4, 12], hat: EVEN16, lead: [0, 4, 8, 12] },
  "e+sync": { kick: [0, 6, 8], snare: [4, 12], hat: EVEN16, lead: [0, 3, 6, 8, 11, 14] },
  "16th": { kick: [0, 4, 8, 12], snare: [4, 12], hat: ALL16, lead: EVEN16 },
  dense16: {
    kick: [0, 3, 6, 8, 11, 14], snare: [4, 12], hat: ALL16,
    lead: [0, 2, 3, 5, 6, 8, 10, 11, 13, 14],
  },
};

const CHORDS = [0, 0, -2, 3, 0, 0, 5, -2];

export function midiToFreq(m: number) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SoundEvent =
  | { t: number; kind: "kick" | "snare" | "hat" }
  | { t: number; kind: "bass" | "lead"; freq: number };

export interface Note { t: number; lane: number; judged: boolean; hit: boolean }

export interface Chart {
  events: SoundEvent[];
  notes: Note[];
  duration: number;
  stepDur: number;
}

export function buildChart(level: Level): Chart {
  const stepDur = 60 / level.bpm / 4;
  const rng = mulberry32((level.id + 1) * 1337);
  const events: SoundEvent[] = [];
  const notes: Note[] = [];
  const pat = PATTERNS[level.density];
  const scale = level.scale;
  let arp = 0;

  for (let bar = 0; bar < level.bars; bar++) {
    const chord = CHORDS[bar % CHORDS.length]!;
    const root = level.root + chord;
    for (let step = 0; step < 16; step++) {
      const t = (bar * 16 + step) * stepDur;
      if (pat.kick.includes(step)) {
        events.push({ t, kind: "kick" });
        events.push({ t, kind: "bass", freq: midiToFreq(root - 12) });
      }
      if (pat.snare.includes(step)) events.push({ t, kind: "snare" });
      if (pat.hat.includes(step)) events.push({ t, kind: "hat" });
      if (pat.lead.includes(step)) {
        const deg = arp % scale.length;
        const oct = Math.floor(arp / scale.length) % 2;
        events.push({ t, kind: "lead", freq: midiToFreq(root + 12 + scale[deg]! + oct * 12) });
        arp++;
        if (bar >= 1) notes.push({ t, lane: Math.floor(rng() * 4) % 4, judged: false, hit: false });
      }
    }
  }

  events.sort((a, b) => a.t - b.t);
  notes.sort((a, b) => a.t - b.t);
  return { events, notes, duration: level.bars * 16 * stepDur + 1.5, stepDur };
}

export const TIER = (acc: number) =>
  acc >= 95 ? "VOID" : acc >= 88 ? "PLATINUM" : acc >= 75 ? "GOLD" : acc >= 60 ? "SILVER" : "COPPER";

export const TIER_COLOR: Record<string, string> = {
  VOID: "#9945FF",
  PLATINUM: "#5ad1ff",
  GOLD: "#F5A623",
  SILVER: "#c7d2e8",
  COPPER: "#c97b4a",
};

export const LANE_COLORS = ["#14F195", "#F5A623", "#9945FF", "#5ad1ff"];
export const PERFECT_WINDOW = 0.06;
export const GOOD_WINDOW = 0.13;
