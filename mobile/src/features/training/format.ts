import type { TrainingGoal } from './types.ts';

// Frase de progresso de uma meta, em português.
export function goalSummary(goal: TrainingGoal): string {
  if (goal.kind === 'bpm') {
    const target = goal.target_bpm ?? 0;
    if (goal.status === 'done') return `Meta atingida: ${target} BPM`;
    const best = goal.best_bpm ?? goal.start_bpm ?? 0;
    const missing = Math.max(0, target - best);
    return `${best} de ${target} BPM · faltam ${missing}`;
  }
  return `${goal.days_done_week ?? 0} de ${goal.days_per_week ?? 0} dias nesta semana`;
}

// Quando foi a última prática do exercício da meta.
export function idleLabel(daysIdle: number | null): string {
  if (daysIdle === null) return 'Nunca praticado';
  if (daysIdle === 0) return 'Praticado hoje';
  if (daysIdle === 1) return 'Ontem';
  return `Há ${daysIdle} dias`;
}
