// Compasso do exercício importado ("4/4", "7/8"). Só aceita 1–12 tempos e unidade 4 ou 8.
export function parseSignature(text: string | null): { beats: number; unit: 4 | 8 } | null {
  if (!text) return null;
  const m = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/.exec(text);
  if (!m) return null;
  const beats = Number(m[1]);
  const unit = Number(m[2]);
  if (beats < 1 || beats > 12) return null;
  if (unit !== 4 && unit !== 8) return null;
  return { beats, unit };
}
