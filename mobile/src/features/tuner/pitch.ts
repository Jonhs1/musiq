// Detecção de altura (YIN) — sem dependências de React/RN.
// Duas fases para ser leve no celular: busca grosseira no sinal reduzido (~5,5 kHz) e
// refinamento ao redor do resultado na taxa original.

export const MIN_RMS = 0.01;
const MIN_FREQ = 25;
const MAX_FREQ = 1200;
const THRESHOLD = 0.15;
const COARSE_RATE = 5500;

export type PitchResult = { frequency: number; clarity: number };

export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/** Interpolação parabólica do mínimo a partir de três pontos (y0, y1, y2) em x = −1, 0, +1 */
function parabolicOffset(y0: number, y1: number, y2: number): number {
  const denominator = y0 - 2 * y1 + y2;
  return denominator === 0 ? 0 : (0.5 * (y0 - y2)) / denominator;
}

function downsample(samples: Float32Array, factor: number): Float32Array {
  if (factor <= 1) return samples;
  const length = Math.floor(samples.length / factor);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    const base = i * factor;
    for (let k = 0; k < factor; k++) sum += samples[base + k];
    out[i] = sum / factor;
  }
  return out;
}

function difference(x: Float32Array, tau: number, window: number): number {
  let sum = 0;
  for (let j = 0; j < window; j++) {
    const delta = x[j] - x[j + tau];
    sum += delta * delta;
  }
  return sum;
}

export function detectPitch(samples: Float32Array, sampleRate: number): PitchResult | null {
  if (rms(samples) < MIN_RMS) return null;

  // ---- fase 1: busca grosseira
  const factor = Math.max(1, Math.floor(sampleRate / COARSE_RATE));
  const coarse = downsample(samples, factor);
  const coarseRate = sampleRate / factor;
  const tauMax = Math.floor(coarseRate / MIN_FREQ);
  const tauMin = Math.max(2, Math.floor(coarseRate / MAX_FREQ));
  const window = coarse.length - tauMax;
  if (window < tauMax) return null;

  // diferença acumulada normalizada d'(τ)
  const d = new Float32Array(tauMax + 1);
  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    const raw = difference(coarse, tau, window);
    running += raw;
    d[tau] = running === 0 ? 1 : (raw * tau) / running;
  }

  // primeiro mínimo local cujo valor (interpolado) fica abaixo do limiar
  let coarseTau = -1;
  let clarity = 0;
  for (let t = 2; t < tauMax; t++) {
    if (d[t] > d[t - 1] || d[t] > d[t + 1]) continue;
    const offset = parabolicOffset(d[t - 1], d[t], d[t + 1]);
    const value = d[t] - 0.25 * (d[t - 1] - d[t + 1]) * offset;
    if (value >= THRESHOLD) continue;
    // mais agudo que a faixa: não inventa uma nota (ex.: assobio, nota aguda de piano)
    if (t + offset < tauMin) return null;
    coarseTau = t + offset;
    clarity = 1 - value;
    break;
  }
  if (coarseTau < 0) return null;

  // ---- fase 2: refinamento na taxa original
  const center = Math.round(coarseTau * factor);
  const lo = Math.max(2, center - factor - 1);
  const hi = center + factor + 1;
  const fineWindow = samples.length - (hi + 1);
  if (fineWindow < hi) return null;

  let bestTau = lo;
  let bestValue = Infinity;
  const values = new Map<number, number>();
  for (let t = lo; t <= hi; t++) {
    const v = difference(samples, t, fineWindow);
    values.set(t, v);
    if (v < bestValue) {
      bestValue = v;
      bestTau = t;
    }
  }
  const before = values.get(bestTau - 1) ?? bestValue;
  const after = values.get(bestTau + 1) ?? bestValue;
  const refined = bestTau + parabolicOffset(before, bestValue, after);
  if (refined <= 0) return null;

  return { frequency: sampleRate / refined, clarity };
}