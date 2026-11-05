import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export type PlanItem = {
  item_id: string;
  day_date: string; // 'AAAA-MM-DD'
  slot: number;
  instrument_id: string;
  exercise_id: string;
  title: string;
  difficulty: number;
  recommended_bpm: number | null;
  minutes: number | null;
  done: boolean;
};

export const WEEKDAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export function localDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Datas da semana atual, de segunda (índice 0) a domingo (índice 6)
export function weekDayKeys(now = new Date()) {
  const offset = (now.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) =>
    localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset + i)),
  );
}

// O servidor cria o plano da semana (se ainda não existir) e devolve os exercícios de cada dia
export function usePlan() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['plan', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_weekly_plan', { p_regenerate: false });
      if (error) throw error;
      return data as PlanItem[];
    },
  });
}

// Salva a meta diária e refaz o plano de hoje em diante
export function useRegeneratePlan() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async (goalMinutes: number) => {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ daily_goal_minutes: goalMinutes })
        .eq('id', userId!);
      if (updateError) throw updateError;
      const { data, error } = await supabase.rpc('get_my_weekly_plan', { p_regenerate: true });
      if (error) throw error;
      return data as PlanItem[];
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['plan', userId], data);
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });
}