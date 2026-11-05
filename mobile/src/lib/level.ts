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

// Mesma fórmula do servidor: nível = floor(sqrt(xp / 100)) + 1
export function levelProgress(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const current = (level - 1) ** 2 * 100;
  const next = level ** 2 * 100;
  return { level, current, next, ratio: (xp - current) / (next - current) };
}