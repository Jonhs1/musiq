import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export type Achievement = {
  id: string;
  name: string;
  description: string;
  xp_reward: number;
  is_secret: boolean;
};

export type UnlockedAchievement = { achievement_id: string; unlocked_at: string };

const ORDER = [
  'first_step',
  'discipline',
  'tireless',
  'speedster',
  'rhythm_master',
  'perfectionist',
  'multi_instrumentalist',
  'centenary',
];

export function useAchievements() {
  return useQuery({
    queryKey: ['achievements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('achievements')
        .select('id, name, description, xp_reward, is_secret');
      if (error) throw error;
      return (data as Achievement[]).sort((a, b) => {
        const ia = ORDER.indexOf(a.id);
        const ib = ORDER.indexOf(b.id);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
    },
  });
}

export function useUnlockedAchievements() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['unlocked', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_achievements')
        .select('achievement_id, unlocked_at')
        .eq('user_id', userId!);
      if (error) throw error;
      return data as UnlockedAchievement[];
    },
  });
}