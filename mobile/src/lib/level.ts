const TITLES = [
  'Iniciante',
  'Aprendiz',
  'Praticante',
  'Instrumentista',
  'Especialista',
  'Virtuoso',
  'Mestre',
  'Ionin',
];

export function levelTitle(level: number): string {
  return TITLES[Math.min(level, TITLES.length) - 1] ?? TITLES[0];
}

/**
 * Sequência real de dias.
 *
 * O servidor só mexe em `streak_days` quando uma prática é registrada. Quem
 * parou de praticar continuaria vendo o número antigo por semanas; a sequência
 * só vale se o último dia praticado foi hoje ou ontem.
 */
export function currentStreak(streakDays: number, lastPracticeDate: string | null | undefined): number {
  if (!streakDays || streakDays <= 0 || !lastPracticeDate) return 0;
  const [year, month, day] = lastPracticeDate.split('-').map(Number);
  if (!year || !month || !day) return 0;
  const last = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysApart = Math.round((today.getTime() - last.getTime()) / 86_400_000);
  return daysApart <= 1 ? streakDays : 0;
}

// Mesma fórmula do servidor: nível = floor(sqrt(xp / 100)) + 1
export function levelProgress(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const current = (level - 1) ** 2 * 100;
  const next = level ** 2 * 100;
  return { level, current, next, ratio: (xp - current) / (next - current) };
}