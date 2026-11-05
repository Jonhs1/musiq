import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export type Profile = {
  id: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  streak_days: number;
  total_practice_seconds: number;
  daily_goal_minutes: number;
};

export type Instrument = { id: string; name: string };

export type MyInstrument = {
  instrument_id: string;
  is_primary: boolean;
  experience_level: 'beginner' | 'intermediate' | 'advanced';
  instruments: { name: string };
};

export const INSTRUMENT_EMOJI: Record<string, string> = {
  drums: '🥁',
  guitar: '🎸',
  bass: '🎸',
  piano: '🎹',
};

export function useProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, nickname, avatar_url, xp, level, streak_days, total_practice_seconds, daily_goal_minutes')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });
}

export function useInstruments() {
  return useQuery({
    queryKey: ['instruments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instruments')
        .select('id, name')
        .order('sort_order');
      if (error) throw error;
      return data as Instrument[];
    },
  });
}

export function useMyInstruments() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['my-instruments', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_instruments')
        .select('instrument_id, is_primary, experience_level, instruments(name)')
        .eq('user_id', userId!)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return data as unknown as MyInstrument[];
    },
  });
}