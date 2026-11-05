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

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard', { max_rows: 50 });
      if (error) throw error;
      return data as LeaderboardRow[];
    },
  });
}