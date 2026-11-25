// Tipos puros (sem imports de runtime), para os testes rodarem em Node.
export type TrainingGoal = {
  goal_id: string;
  exercise_id: string;
  title: string;
  instrument_id: string;
  kind: 'bpm' | 'consistency';
  start_bpm: number | null;
  target_bpm: number | null;
  days_per_week: number | null;
  status: 'active' | 'done';
  best_bpm: number | null;
  days_done_week: number | null;
  days_idle: number | null;
  ratio: number;
  created_at: string;
  completed_at: string | null;
};
