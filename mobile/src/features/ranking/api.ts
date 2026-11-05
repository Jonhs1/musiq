import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export type LeaderboardRow = {
  rank_position: number;
  user_id: string;
  nickname: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
};

export type InstrumentLeaderboardRow = {
  rank_position: number;
  user_id: string;
  nickname: string | null;
  avatar_url: string | null;
  xp: number; // XP acumulado no instrumento
  score: number; // pontuação do ranking (com a queda por inatividade)
  inactive_days: number;
  last_practiced_at: string | null;
};

// Dias sem praticar o instrumento antes de a pontuação começar a cair (igual ao servidor)
export const GRACE_DAYS = 5;

export function useLeaderboard(enabled = true) {
  return useQuery({
    queryKey: ['leaderboard', 'general'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard', { max_rows: 50 });
      if (error) throw error;
      return data as LeaderboardRow[];
    },
  });
}

export function useInstrumentLeaderboard(instrumentId: string | null) {
  return useQuery({
    queryKey: ['leaderboard', 'instrument', instrumentId],
    enabled: !!instrumentId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_instrument_leaderboard', {
        p_instrument: instrumentId!,
        max_rows: 50,
      });
      if (error) throw error;
      return data as InstrumentLeaderboardRow[];
    },
  });
}