import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExerciseDetail, Visibility } from '../exercises/api';
import { supabase } from '../../lib/supabase';

export type { Visibility };
export type CommunityExercise = ExerciseDetail;
export type Scope = 'explore' | 'favorites' | 'mine';
export type Order = 'recent' | 'likes';

export type ExerciseInput = {
  instrument_id: string;
  title: string;
  description: string;
  objective: string;
  difficulty: number;
  recommended_bpm: number | null;
  duration_minutes: number | null;
  visibility: Visibility;
};

const MESSAGES: Record<string, string> = {
  not_authenticated: 'Entre na sua conta para continuar.',
  invalid_instrument: 'Escolha um instrumento.',
  invalid_title: 'O título precisa ter de 3 a 60 caracteres.',
  invalid_text: 'A descrição aceita até 600 caracteres e o objetivo até 200.',
  invalid_difficulty: 'Escolha a dificuldade de 1 a 5.',
  invalid_bpm: 'O BPM deve ficar entre 20 e 400.',
  invalid_duration: 'A duração deve ficar entre 1 e 120 minutos.',
  invalid_visibility: 'Escolha quem pode ver o exercício.',
  limit_total: 'Você já tem 20 exercícios. Apague algum para criar outro.',
  limit_daily: 'Você já criou 10 exercícios hoje. Tente de novo amanhã.',
  not_found: 'Este exercício não está mais disponível.',
  not_owner: 'Só quem criou o exercício pode alterá-lo.',
  cannot_report_own: 'Você não pode denunciar o seu próprio exercício.',
  cannot_report_official: 'Este exercício é oficial e não pode ser denunciado.',
};

/** Traduz os códigos de erro do servidor para mensagens em português. */
export function exerciseErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  for (const code of Object.keys(MESSAGES)) {
    if (raw.includes(code)) return MESSAGES[code];
  }
  return 'Não foi possível concluir. Verifique a conexão e tente de novo.';
}

export function useCommunityExercises(p: { instrument: string | null; scope: Scope; order: Order }) {
  return useQuery({
    queryKey: ['community', p.instrument, p.scope, p.order],
    staleTime: 30_000,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_community_exercises', {
        p_instrument: p.instrument,
        p_scope: p.scope,
        p_order: p.order,
        p_limit: 50,
        p_offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as CommunityExercise[];
    },
  });
}

function rpcArgs(input: ExerciseInput) {
  return {
    p_title: input.title,
    p_description: input.description,
    p_objective: input.objective,
    p_difficulty: input.difficulty,
    p_bpm: input.recommended_bpm,
    p_duration: input.duration_minutes,
    p_visibility: input.visibility,
  };
}

function useInvalidateAll() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ['community'] });
    queryClient.invalidateQueries({ queryKey: ['exercises'] });
    if (id) queryClient.invalidateQueries({ queryKey: ['exercise', id] });
  };
}

export function useCreateExercise() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: ExerciseInput) => {
      const { data, error } = await supabase.rpc('create_exercise', { p_instrument: input.instrument_id, ...rpcArgs(input) });
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: () => invalidate(),
  });
}

export function useUpdateExercise(id: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: ExerciseInput) => {
      const { error } = await supabase.rpc('update_exercise', { p_id: id, ...rpcArgs(input) });
      if (error) throw error;
    },
    onSuccess: () => invalidate(id),
  });
}

export function useDeleteExercise() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_exercise', { p_id: id });
      if (error) throw error;
    },
    onSuccess: (_data, id) => invalidate(id),
  });
}

type Patch = Partial<Pick<CommunityExercise, 'liked_by_me' | 'favorited_by_me' | 'likes_count'>>;

/** Atualiza na hora as listas e o detalhe em cache; o servidor confirma depois. */
function usePatchCache() {
  const queryClient = useQueryClient();
  return (id: string, patch: (e: CommunityExercise) => Patch) => {
    queryClient.setQueriesData<CommunityExercise[]>({ queryKey: ['community'] }, (rows) =>
      rows?.map((row) => (row.id === id ? { ...row, ...patch(row) } : row)),
    );
    queryClient.setQueryData<CommunityExercise>(['exercise', id], (row) => (row ? { ...row, ...patch(row) } : row));
  };
}

export function useToggleLike() {
  const invalidate = useInvalidateAll();
  const patch = usePatchCache();
  return useMutation({
    mutationFn: async (exercise: Pick<CommunityExercise, 'id' | 'liked_by_me' | 'likes_count'>) => {
      patch(exercise.id, (e) => ({
        liked_by_me: !e.liked_by_me,
        likes_count: Math.max(0, e.likes_count + (e.liked_by_me ? -1 : 1)),
      }));
      const { error } = await supabase.rpc('toggle_like', { p_id: exercise.id });
      if (error) throw error;
    },
    onSettled: (_d, _e, exercise) => invalidate(exercise.id),
  });
}

export function useToggleFavorite() {
  const invalidate = useInvalidateAll();
  const patch = usePatchCache();
  return useMutation({
    mutationFn: async (exercise: Pick<CommunityExercise, 'id' | 'favorited_by_me'>) => {
      patch(exercise.id, (e) => ({ favorited_by_me: !e.favorited_by_me }));
      const { error } = await supabase.rpc('toggle_favorite', { p_id: exercise.id });
      if (error) throw error;
    },
    onSettled: (_d, _e, exercise) => invalidate(exercise.id),
  });
}

export function useReportExercise() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: { id: string; reason?: string }) => {
      const { error } = await supabase.rpc('report_exercise', { p_id: input.id, p_reason: input.reason ?? null });
      if (error) throw error;
    },
    onSuccess: (_d, input) => invalidate(input.id),
  });
}