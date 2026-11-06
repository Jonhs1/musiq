import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export type DuelFormat = 'minutes' | 'streak';
export type DuelStatus = 'pending' | 'active' | 'finished';

export type Duel = {
  id: string;
  format: DuelFormat;
  duration_days: number;
  status: DuelStatus;
  xp_reward: number;
  start_date: string | null;
  end_date: string | null;
  i_am_challenger: boolean;
  other_id: string;
  other_nickname: string | null;
  other_avatar_url: string | null;
  my_score: number | null;
  their_score: number | null;
  winner_id: string | null;
  created_at: string;
  finished_at: string | null;
};

export const FORMAT_LABEL: Record<DuelFormat, string> = {
  minutes: 'Duelo de minutos',
  streak: 'Duelo de sequência',
};

export const FORMAT_RULE: Record<DuelFormat, string> = {
  minutes: 'Quem praticar mais minutos no período vence.',
  streak: 'Quem fizer a maior sequência de dias seguidos praticando vence. Empate: mais minutos.',
};

export function scoreUnit(format: DuelFormat, value: number) {
  return format === 'minutes' ? `${value} min` : `${value} ${value === 1 ? 'dia' : 'dias'}`;
}

export function rewardFor(days: number) {
  return 50 + 25 * days;
}

export function duelError(error: unknown) {
  const message = (error as { message?: string } | null)?.message ?? '';
  if (message.includes('duel_exists')) return 'Vocês já têm um desafio desse formato em andamento.';
  if (message.includes('not_friends')) return 'Vocês não são mais amigos.';
  if (message.includes('duel_not_found')) return 'Esse desafio não existe mais.';
  return 'Não foi possível concluir. Tente de novo.';
}

export function useDuels() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['duels', userId],
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_friend_duels');
      if (error) throw error;
      return data as Duel[];
    },
  });
}

/** Convites recebidos esperando resposta (para o selo da Home) */
export function useIncomingDuelCount() {
  const { data } = useDuels();
  return data?.filter((item) => item.status === 'pending' && !item.i_am_challenger).length ?? 0;
}

function useRefreshDuels() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['duels'] });
    // o vencedor ganha XP: atualiza perfil e rankings
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
  };
}

export function useCreateDuel() {
  const refresh = useRefreshDuels();
  return useMutation({
    mutationFn: async (input: { friendId: string; format: DuelFormat; days: number }) => {
      const { error } = await supabase.rpc('create_duel', {
        p_friend: input.friendId,
        p_format: input.format,
        p_days: input.days,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useRespondDuel() {
  const refresh = useRefreshDuels();
  return useMutation({
    mutationFn: async (input: { duelId: string; accept: boolean }) => {
      const { error } = await supabase.rpc('respond_duel', { p_duel: input.duelId, p_accept: input.accept });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useCancelDuel() {
  const refresh = useRefreshDuels();
  return useMutation({
    mutationFn: async (duelId: string) => {
      const { error } = await supabase.rpc('cancel_duel', { p_duel: duelId });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}