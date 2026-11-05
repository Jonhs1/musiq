import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { supabase } from '../../lib/supabase';

export type Exercise = {
  id: string;
  instrument_id: string;
  title: string;
  description: string | null;
  objective: string | null;
  difficulty: number;
  recommended_bpm: number | null;
  duration_minutes: number | null;
};

const EXERCISE_COLUMNS =
  'id, instrument_id, title, description, objective, difficulty, recommended_bpm, duration_minutes';

export function useExercises(instrumentId: string) {
  return useQuery({
    queryKey: ['exercises', instrumentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select(EXERCISE_COLUMNS)
        .eq('instrument_id', instrumentId)
        .order('difficulty')
        .order('title');
      if (error) throw error;
      return data as Exercise[];
    },
  });
}

export function useExercise(id: string) {
  return useQuery({
    queryKey: ['exercise', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select(EXERCISE_COLUMNS)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Exercise;
    },
  });
}

export async function saveSession(input: {
  userId: string;
  instrumentId: string;
  exerciseId: string;
  startedAt: string;
  durationSeconds: number;
  bpmStart: number;
  bpmMax: number;
  notes: string;
}): Promise<number> {
  const { data, error } = await supabase
    .from('practice_sessions')
    .insert({
      id: Crypto.randomUUID(),
      user_id: input.userId,
      instrument_id: input.instrumentId,
      exercise_id: input.exerciseId,
      started_at: input.startedAt,
      duration_seconds: input.durationSeconds,
      bpm_start: input.bpmStart,
      bpm_max: input.bpmMax,
      notes: input.notes.trim() || null,
    })
    .select('xp_earned')
    .single();
  if (error) throw error;
  return data.xp_earned as number;
}