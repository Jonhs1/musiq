import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export type Visibility = 'private' | 'friends' | 'public';

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

/** Exercício com dados da comunidade (criador, curtidas, favorito). Oficiais têm created_by nulo. */
export type ExerciseDetail = Exercise & {
  visibility: Visibility;
  likes_count: number;
  created_by: string | null;
  creator_nickname: string | null;
  creator_avatar_url: string | null;
  liked_by_me: boolean;
  favorited_by_me: boolean;
  created_at: string;
};

const EXERCISE_COLUMNS =
  'id, instrument_id, title, description, objective, difficulty, recommended_bpm, duration_minutes';

/** Lista de um instrumento: exercícios oficiais e os criados pelo próprio usuário. */
export function useExercises(instrumentId: string) {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['exercises', instrumentId, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select(EXERCISE_COLUMNS)
        .eq('instrument_id', instrumentId)
        .or(`created_by.is.null,created_by.eq.${userId}`)
        .order('difficulty')
        .order('title');
      if (error) throw error;
      return data as Exercise[];
    },
  });
}

/** Um exercício (oficial ou da comunidade). Falha com 'not_found' se não existir ou não estiver mais visível. */
export function useExercise(id: string, enabled = true) {
  return useQuery({
    queryKey: ['exercise', id],
    enabled: enabled && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_exercise', { p_id: id });
      if (error) throw error;
      const row = (data as ExerciseDetail[] | null)?.[0];
      if (!row) throw new Error('not_found');
      return row;
    },
    retry: (count, error) => (error instanceof Error && error.message === 'not_found' ? false : count < 1),
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