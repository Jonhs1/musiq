import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export type MessageKind = 'text' | 'image' | 'audio';

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  kind: MessageKind;
  body: string | null;
  media_path: string | null;
  media_duration_ms: number | null;
  created_at: string;
  read_at: string | null;
};

export type Conversation = {
  friend_id: string;
  nickname: string | null;
  avatar_url: string | null;
  last_kind: MessageKind | null;
  last_body: string | null;
  last_sender_id: string | null;
  last_at: string | null;
  unread_count: number;
};

const BUCKET = 'chat-media';

export function useConversations() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['conversations', userId],
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_conversations');
      if (error) throw error;
      return data as Conversation[];
    },
  });
}

export function useUnreadTotal() {
  const { data } = useConversations();
  return data?.reduce((sum, item) => sum + item.unread_count, 0) ?? 0;
}

/** Últimas 100 mensagens da conversa, da mais nova para a mais antiga (use com lista invertida) */
export function useMessages(friendId: string | undefined) {
  return useQuery({
    queryKey: ['messages', friendId],
    enabled: !!friendId,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_messages', { p_friend: friendId!, p_limit: 100 });
      if (error) throw error;
      return data as Message[];
    },
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return async (friendId: string) => {
    await supabase.rpc('mark_conversation_read', { p_friend: friendId });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };
}

export function useSendText(friendId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.rpc('send_message', {
        p_recipient: friendId,
        p_kind: 'text',
        p_body: text,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', friendId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/mp4': 'm4a',
};

/** Envia uma foto ou um áudio: sobe o arquivo e registra a mensagem */
export function useSendMedia(friendId: string) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: { kind: 'image' | 'audio'; uri: string; contentType: string; durationMs?: number }) => {
      const me = session!.user.id;
      const extension = EXTENSIONS[input.contentType] ?? 'bin';
      const path = `${me}/${friendId}/${Crypto.randomUUID()}.${extension}`;

      const response = await fetch(input.uri);
      const bytes = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: input.contentType });
      if (uploadError) throw uploadError;

      const { error } = await supabase.rpc('send_message', {
        p_recipient: friendId,
        p_kind: input.kind,
        p_media_path: path,
        p_duration_ms: input.durationMs ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', friendId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

/** Link temporário (1 hora) para ver uma foto ou ouvir um áudio */
export function useMediaUrl(path: string | null) {
  return useQuery({
    queryKey: ['chat-media-url', path],
    enabled: !!path,
    staleTime: 1000 * 60 * 50,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}