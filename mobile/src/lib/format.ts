export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export const DIFFICULTY_LABELS = ['', 'Iniciante', 'Básico', 'Intermediário', 'Avançado', 'Expert'];

export function difficultyDots(level: number): string {
  return '●'.repeat(level) + '○'.repeat(5 - level);
}