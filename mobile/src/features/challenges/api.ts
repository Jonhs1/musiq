import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export type Challenge = {
  id: string;
  period: 'daily' | 'weekly';
  title: string;
  description: string;
  instrument_id: string | null;
  progress: number;
  target: number;
  xp_reward: number;
  completed_at: string | null;
};

// O servidor sorteia (se ainda não existir) o desafio do dia e o da semana e devolve os dois
export function useChallenges() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['challenges', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_challenges');
      if (error) throw error;
      return data as Challenge[];
    },
  });
}