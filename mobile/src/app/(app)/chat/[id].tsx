import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../../../components/Avatar';
import { Icon } from '../../../components/Icon';
import {
  Message,
  useConversations,
  useMarkRead,
  useMessages,
  useSendMedia,
  useSendText,
} from '../../../features/chat/api';
import { Composer } from '../../../features/chat/Composer';
import { MessageBubble } from '../../../features/chat/MessageBubble';
import { useFriends } from '../../../features/friends/api';
import { setActiveChat } from '../../../features/notifications/activeChat';
import { useAuth } from '../../../lib/auth';
import { colors, fonts } from '../../../lib/theme';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const me = session?.user.id;

  const { data: friends } = useFriends();
  const friend = friends?.find((item) => item.user_id === id);
  const { data: messages, isLoading } = useMessages(id);
  const { data: conversations } = useConversations();
  const markRead = useMarkRead();
  const sendText = useSendText(id);
  const sendMedia = useSendMedia(id);

  const unread = conversations?.find((item) => item.friend_id === id)?.unread_count ?? 0;
  const newest = messages?.[0]?.id;

  // marca como lida ao abrir e sempre que chegar mensagem nova com a tela aberta
  useEffect(() => {
    if (id && (unread > 0 || newest)) markRead(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, newest, unread]);

  // avisa o sistema de push qual conversa está aberta
  useEffect(() => {
    setActiveChat(id ?? null);
    return () => setActiveChat(null);
  }, [id]);

  function fail(e: unknown) {
    console.warn('chat send error:', e);
    Alert.alert('Não foi possível enviar', 'Verifique a conexão e tente de novo.');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Icon name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          style={styles.who}
          onPress={() => router.push({ pathname: '/friend/[id]', params: { id } })}
        >
          <Avatar uri={friend?.avatar_url} name={friend?.nickname} size={38} />
          <Text style={styles.name} numberOfLines={1}>
            {friend?.nickname ?? 'Conversa'}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primarySoft} />
          </View>
        ) : (
          <FlatList<Message>
            data={messages ?? []}
            inverted
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageBubble message={item} mine={item.sender_id === me} />}
            contentContainerStyle={{ paddingVertical: 12 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={[styles.center, { transform: [{ scaleY: -1 }] }]}>
                <Text style={styles.empty}>Mande a primeira mensagem para {friend?.nickname ?? 'seu amigo'} 🤘</Text>
              </View>
            }
          />
        )}

        <Composer
          busy={sendMedia.isPending}
          onSendText={(text) => sendText.mutate(text, { onError: fail })}
          onSendImage={(uri, contentType) => sendMedia.mutate({ kind: 'image', uri, contentType }, { onError: fail })}
          onSendAudio={(uri, durationMs) =>
            sendMedia.mutate({ kind: 'audio', uri, contentType: 'audio/mp4', durationMs }, { onError: fail })
          }
        />
        {sendMedia.isPending ? <Text style={styles.sending}>Enviando…</Text> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundDeep,
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, color: colors.text, fontSize: 18, fontFamily: fonts.title },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  empty: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.body, textAlign: 'center' },
  sending: {
    position: 'absolute',
    bottom: 70,
    alignSelf: 'center',
    color: colors.primarySoft,
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
  },
});