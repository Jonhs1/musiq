import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import type { PlanItem } from '../plan/api';
import type { TrainingGoal } from './types';

export type { TrainingGoal } from './types';

const MESSAGES: Array<[string, string]> = [
  ['exercicio_invalido', 'Esse exercício não está disponível.'],
  ['meta_invalida', 'Confira os números da meta.'],
  ['meta_duplicada', 'Você já tem uma meta ativa nesse exercício.'],
  ['limite_de_metas', 'Limite de 10 metas ativas. Arquive uma para criar outra.'],
  ['item_invalido', 'Esse item não pode mais ser alterado.'],
  ['plano_cheio', 'O dia já está cheio (12 exercícios).'],
  ['sem_plano', 'Abra o plano uma vez antes de editar o dia.'],
  ['tente_novamente', 'Tente de novo.'],
];

// Traduz os códigos de erro do servidor; qualquer outro vira mensagem genérica.
export function friendlyError(error: unknown): string {
  const message =
    typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
  for (const [code, text] of MESSAGES) {
    if (message.includes(code)) return text;
  }
  return 'Não foi possível concluir. Verifique a conexão.';
}

export function useTrainingGoals() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['training-goals', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_training_goals');
      if (error) throw error;
      return data as TrainingGoal[];
    },
  });
}

export type CreateGoalInput = {
  exerciseId: string;
  kind: 'bpm' | 'consistency';
  startBpm?: number;
  targetBpm?: number;
  daysPerWeek?: number;
};

export function useCreateGoal() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async (input: CreateGoalInput) => {
      const { data, error } = await supabase.rpc('create_training_goal', {
        p_exercise: input.exerciseId,
        p_kind: input.kind,
        p_start_bpm: input.startBpm ?? null,
        p_target_bpm: input.targetBpm ?? null,
        p_days_per_week: input.daysPerWeek ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-goals', userId] });
    },
  });
}

export function useArchiveGoal() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase.rpc('archive_training_goal', { p_goal: goalId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-goals', userId] });
    },
  });
}

// Depois de editar o dia, busca o plano de novo e grava no cache de 'plan'.
async function refreshPlan(queryClient: QueryClient, userId: string | undefined) {
  const { data, error } = await supabase.rpc('get_my_weekly_plan', { p_regenerate: false });
  if (error) throw error;
  queryClient.setQueryData(['plan', userId], data as PlanItem[]);
}

export function useAddToToday() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async (exerciseId: string) => {
      const { error } = await supabase.rpc('plan_add_item', { p_exercise: exerciseId });
      if (error) throw error;
    },
    onSuccess: () => refreshPlan(queryClient, userId),
  });
}

export function useRemoveFromToday() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.rpc('plan_remove_item', { p_item: itemId });
      if (error) throw error;
    },
    onSuccess: () => refreshPlan(queryClient, userId),
  });
}

export function useReplaceTodayItem() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async (input: { itemId: string; exerciseId: string }) => {
      const { error } = await supabase.rpc('plan_replace_item', {
        p_item: input.itemId,
        p_exercise: input.exerciseId,
      });
      if (error) throw error;
    },
    onSuccess: () => refreshPlan(queryClient, userId),
  });
}
