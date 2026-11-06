import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export type Friend = {
    user_id: string;
    nickname: string | null;
    avatar_url: string | null;
    level: number;
    xp: number;
    streak_days: number;
    last_practice_date: string | null;
    friends_since: string;
};

export type FriendRequest = {
    friendship_id: string;
    direction: 'incoming' | 'outgoing';
    user_id: string;
    nickname: string | null;
    avatar_url: string | null;
    level: number;
    created_at: string;
};

export type SearchResult = {
    user_id: string;
    nickname: string | null;
    avatar_url: string | null;
    level: number;
    relation: 'none' | 'friend' | 'sent' | 'received';
    friendship_id: string | null;
};

export type FriendProfile = {
    id: string;
    nickname: string | null;
    full_name: string | null;
    avatar_url: string | null;
    xp: number;
    level: number;
    streak_days: number;
    total_practice_seconds: number;
    friends_since: string | null;
    instruments: {
        instrument_id: string;
        name: string;
        is_primary: boolean;
        experience_level: 'beginner' | 'intermediate' | 'advanced';
        xp: number;
    }[];
    achievements: { achievement_id: string; name: string; unlocked_at: string }[];
};

export type UserProfile = {
    id: string;
    nickname: string | null;
    avatar_url: string | null;
    xp: number;
    level: number;
    streak_days: number;
    relation: 'self' | 'friend' | 'none' | 'sent' | 'received';
    friendship_id: string | null;
    // privados: só vêm para amigos e para o próprio usuário
    full_name: string | null;
    total_practice_seconds: number | null;
    friends_since: string | null;
    achievements_count: number;
    achievements: { achievement_id: string; name: string; unlocked_at: string }[];
    instruments: {
        instrument_id: string;
        name: string;
        is_primary: boolean;
        experience_level: 'beginner' | 'intermediate' | 'advanced';
        xp: number;
    }[];
};

// Traduz os erros do servidor para mensagens amigáveis
export function friendlyError(error: unknown): string {
    const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error);
    if (message.includes('user_not_found')) return 'Ninguém encontrado com esse código.';
    if (message.includes('already_friends')) return 'Vocês já são amigos.';
    if (message.includes('already_sent')) return 'Você já enviou um pedido para essa pessoa.';
    if (message.includes('cannot_add_self')) return 'Esse é o seu próprio código.';
    if (message.includes('not_friends')) return 'Só é possível ver o perfil de amigos.';
    return 'Algo deu errado. Verifique a conexão e tente de novo.';
}

export function useFriends() {
    const { session } = useAuth();
    const userId = session?.user.id;
    return useQuery({
        queryKey: ['friends', userId],
        enabled: !!userId,
        staleTime: 0,
        refetchOnMount: 'always',
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_friends');
            if (error) throw error;
            return data as Friend[];
        },
    });
}

export function useFriendRequests() {
    const { session } = useAuth();
    const userId = session?.user.id;
    return useQuery({
        queryKey: ['friend-requests', userId],
        enabled: !!userId,
        staleTime: 0,
        refetchOnMount: 'always',
        refetchInterval: 30_000,
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_friend_requests');
            if (error) throw error;
            return data as FriendRequest[];
        },
    });
}

export function useMyFriendCode() {
    const { session } = useAuth();
    const userId = session?.user.id;
    return useQuery({
        queryKey: ['friend-code', userId],
        enabled: !!userId,
        staleTime: Infinity,
        queryFn: async () => {
            const { data, error } = await supabase.from('profiles').select('friend_code').eq('id', userId!).single();
            if (error) throw error;
            return data.friend_code as string;
        },
    });
}

export function useSearchUsers(query: string) {
    const text = query.trim();
    return useQuery({
        queryKey: ['search-users', text],
        enabled: text.length >= 2,
        staleTime: 0,
        queryFn: async () => {
            const { data, error } = await supabase.rpc('search_users', { p_query: text });
            if (error) throw error;
            return data as SearchResult[];
        },
    });
}

export function useFriendProfile(friendId: string | undefined) {
    return useQuery({
        queryKey: ['friend-profile', friendId],
        enabled: !!friendId,
        retry: false,
        staleTime: 0,
        refetchOnMount: 'always',
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_friend_profile', { p_user_id: friendId! });
            if (error) throw error;
            return data as FriendProfile;
        },
    });
}

/** Perfil de qualquer usuário (amigo ou não); `relation` diz o que dá para fazer */
export function useUserProfile(userId: string | undefined) {
    return useQuery({
        queryKey: ['user-profile', userId],
        enabled: !!userId,
        retry: false,
        staleTime: 0,
        refetchOnMount: 'always',
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_user_profile', { p_user_id: userId! });
            if (error) throw error;
            return data as UserProfile;
        },
    });
}

function useRefreshFriends() {
    const queryClient = useQueryClient();
    return () => {
        queryClient.invalidateQueries({ queryKey: ['friends'] });
        queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
        queryClient.invalidateQueries({ queryKey: ['search-users'] });
        queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
        queryClient.invalidateQueries({ queryKey: ['user-profile'] });
        queryClient.invalidateQueries({ queryKey: ['friend-profile'] });
    };
}

/** Envia pedido pelo id. Resultado: 'sent' (enviado) ou 'accepted' (o outro já tinha pedido: viraram amigos) */
export function useSendRequest() {
    const refresh = useRefreshFriends();
    return useMutation({
        mutationFn: async (userId: string) => {
            const { data, error } = await supabase.rpc('send_friend_request', { p_user_id: userId });
            if (error) throw error;
            return data as 'sent' | 'accepted';
        },
        onSuccess: refresh,
    });
}

export function useSendRequestByCode() {
    const refresh = useRefreshFriends();
    return useMutation({
        mutationFn: async (code: string) => {
            const { data, error } = await supabase.rpc('send_friend_request_by_code', { p_code: code });
            if (error) throw error;
            return data as 'sent' | 'accepted';
        },
        onSuccess: refresh,
    });
}

export function useRespondRequest() {
    const refresh = useRefreshFriends();
    return useMutation({
        mutationFn: async ({ friendshipId, accept }: { friendshipId: string; accept: boolean }) => {
            const { error } = await supabase.rpc('respond_friend_request', {
                p_friendship_id: friendshipId,
                p_accept: accept,
            });
            if (error) throw error;
        },
        onSuccess: refresh,
    });
}

/** Desfaz amizade ou cancela um pedido enviado */
export function useRemoveFriendship() {
    const refresh = useRefreshFriends();
    return useMutation({
        mutationFn: async (userId: string) => {
            const { error } = await supabase.rpc('remove_friendship', { p_user_id: userId });
            if (error) throw error;
        },
        onSuccess: refresh,
    });
}