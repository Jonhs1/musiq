import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import { Button, Card, Chip, ErrorText, Reveal, Screen, SectionLabel, TextField, Title } from '../../components/ui';
import {
  friendlyError,
  useFriendRequests,
  useFriends,
  useMyFriendCode,
  useRemoveFriendship,
  useRespondRequest,
  useSearchUsers,
  useSendRequest,
  useSendRequestByCode,
} from '../../features/friends/api';
import { colors, fonts, radius, spacing } from '../../lib/theme';

type Tab = 'friends' | 'requests' | 'add';

export default function Friends() {
  const [tab, setTab] = useState<Tab>('friends');
  const { data: requests } = useFriendRequests();
  const incoming = requests?.filter((item) => item.direction === 'incoming').length ?? 0;

  return (
    <Screen>
      <BackButton />
      <Reveal index={0}>
        <Title>Amigos</Title>
      </Reveal>

      <View style={styles.tabs}>
        <Chip label="Meus amigos" active={tab === 'friends'} onPress={() => setTab('friends')} />
        <Chip
          label={incoming > 0 ? `Pedidos (${incoming})` : 'Pedidos'}
          active={tab === 'requests'}
          onPress={() => setTab('requests')}
        />
        <Chip label="Adicionar" active={tab === 'add'} onPress={() => setTab('add')} />
      </View>

      {tab === 'friends' ? <FriendsList onAdd={() => setTab('add')} /> : null}
      {tab === 'requests' ? <Requests /> : null}
      {tab === 'add' ? <AddFriend /> : null}
    </Screen>
  );
}

function FriendsList({ onAdd }: { onAdd: () => void }) {
  const router = useRouter();
  const { data: friends, isLoading, isError } = useFriends();

  if (isLoading) return <ActivityIndicator color={colors.primarySoft} />;
  if (isError) return <ErrorText>Não foi possível carregar seus amigos.</ErrorText>;
  if (!friends || friends.length === 0) {
    return (
      <Card>
        <Text style={styles.emptyTitle}>Você ainda não tem amigos por aqui</Text>
        <Text style={styles.muted}>Adicione a galera da banda pelo apelido ou pelo código de amigo.</Text>
        <Button title="Adicionar amigo" icon="person-add" onPress={onAdd} />
      </Card>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {friends.map((friend, index) => (
        <Reveal key={friend.user_id} index={index}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { transform: [{ scale: 0.98 }] }]}
            onPress={() => router.push({ pathname: '/friend/[id]', params: { id: friend.user_id } })}
          >
            <Avatar uri={friend.avatar_url} name={friend.nickname} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{friend.nickname}</Text>
              <Text style={styles.muted}>
                Nível {friend.level} · {friend.xp} XP
              </Text>
            </View>
            {friend.streak_days > 0 ? (
              <View style={styles.streak}>
                <Icon name="flame" size={14} color={colors.magenta} />
                <Text style={styles.streakText}>{friend.streak_days}</Text>
              </View>
            ) : null}
            <Icon name="chevron-forward" size={20} color={colors.textDim} />
          </Pressable>
        </Reveal>
      ))}
    </View>
  );
}

function Requests() {
  const { data: requests, isLoading } = useFriendRequests();
  const respond = useRespondRequest();
  const remove = useRemoveFriendship();

  if (isLoading) return <ActivityIndicator color={colors.primarySoft} />;

  const incoming = requests?.filter((item) => item.direction === 'incoming') ?? [];
  const outgoing = requests?.filter((item) => item.direction === 'outgoing') ?? [];

  if (incoming.length === 0 && outgoing.length === 0) {
    return <Text style={styles.muted}>Nenhum pedido pendente.</Text>;
  }

  return (
    <View style={{ gap: spacing.md }}>
      {incoming.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <SectionLabel>Recebidos</SectionLabel>
          {incoming.map((request) => (
            <View key={request.friendship_id} style={styles.row}>
              <Avatar uri={request.avatar_url} name={request.nickname} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{request.nickname}</Text>
                <Text style={styles.muted}>Nível {request.level}</Text>
              </View>
              <Pressable
                style={[styles.round, styles.roundOk]}
                onPress={() => respond.mutate({ friendshipId: request.friendship_id, accept: true })}
                hitSlop={6}
              >
                <Icon name="checkmark" size={20} color={colors.green} />
              </Pressable>
              <Pressable
                style={[styles.round, styles.roundNo]}
                onPress={() => respond.mutate({ friendshipId: request.friendship_id, accept: false })}
                hitSlop={6}
              >
                <Icon name="close" size={20} color={colors.danger} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {outgoing.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <SectionLabel>Enviados</SectionLabel>
          {outgoing.map((request) => (
            <View key={request.friendship_id} style={styles.row}>
              <Avatar uri={request.avatar_url} name={request.nickname} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{request.nickname}</Text>
                <Text style={styles.muted}>Aguardando resposta</Text>
              </View>
              <Pressable onPress={() => remove.mutate(request.user_id)} hitSlop={8}>
                <Text style={styles.cancel}>Cancelar</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function AddFriend() {
  const { data: myCode } = useMyFriendCode();
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const { data: results, isFetching } = useSearchUsers(query);
  const sendRequest = useSendRequest();
  const sendByCode = useSendRequestByCode();

  function feedback(result: 'sent' | 'accepted') {
    setMessage({
      ok: true,
      text: result === 'accepted' ? 'Pronto! Vocês agora são amigos.' : 'Pedido enviado!',
    });
  }

  function send(userId: string) {
    setMessage(null);
    sendRequest.mutate(userId, {
      onSuccess: feedback,
      onError: (error) => setMessage({ ok: false, text: friendlyError(error) }),
    });
  }

  function sendCode() {
    setMessage(null);
    sendByCode.mutate(query, {
      onSuccess: (result) => {
        feedback(result);
        setQuery('');
      },
      onError: (error) => setMessage({ ok: false, text: friendlyError(error) }),
    });
  }

  const looksLikeCode = /^[A-Za-z0-9]{8}$/.test(query.trim());

  return (
    <View style={{ gap: spacing.md }}>
      <Card highlight>
        <SectionLabel>Seu código de amigo</SectionLabel>
        <Text style={styles.code}>{myCode ?? '········'}</Text>
        <Text style={styles.muted}>Compartilhe com quem você quer ter por perto.</Text>
        <Button
          title="Compartilhar código"
          variant="soft"
          icon="share-outline"
          onPress={() =>
            Share.share({ message: `Me adiciona no SnakeTune! Meu código de amigo: ${myCode}` })
          }
          disabled={!myCode}
        />
      </Card>

      <TextField
        label="Buscar por apelido ou código"
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setMessage(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Ex.: Rafa ou K7M2QX9A"
      />

      {message ? <Text style={[styles.feedback, !message.ok && { color: colors.danger }]}>{message.text}</Text> : null}

      {looksLikeCode ? (
        <Button title="Enviar pedido pelo código" icon="person-add" onPress={sendCode} loading={sendByCode.isPending} />
      ) : null}

      {isFetching ? <ActivityIndicator color={colors.primarySoft} /> : null}
      {query.trim().length >= 2 && !isFetching && results?.length === 0 && !looksLikeCode ? (
        <Text style={styles.muted}>Ninguém encontrado com esse apelido.</Text>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        {results?.map((user) => (
          <View key={user.user_id} style={styles.row}>
            <Avatar uri={user.avatar_url} name={user.nickname} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{user.nickname}</Text>
              <Text style={styles.muted}>Nível {user.level}</Text>
            </View>
            {user.relation === 'none' ? (
              <Pressable style={styles.addButton} onPress={() => send(user.user_id)} hitSlop={6}>
                <Icon name="person-add" size={16} color={colors.onPrimary} />
                <Text style={styles.addText}>Adicionar</Text>
              </Pressable>
            ) : user.relation === 'received' ? (
              <Pressable style={styles.addButton} onPress={() => send(user.user_id)} hitSlop={6}>
                <Text style={styles.addText}>Aceitar</Text>
              </Pressable>
            ) : (
              <Text style={styles.status}>{user.relation === 'friend' ? 'Amigos' : 'Pedido enviado'}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { color: colors.text, fontSize: 15, fontFamily: fonts.bodySemi },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 18, fontFamily: fonts.body },
  emptyTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.title },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  streakText: { color: colors.magenta, fontSize: 13, fontFamily: fonts.bodySemi },
  round: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  roundOk: { borderColor: 'rgba(61,220,151,0.4)', backgroundColor: 'rgba(61,220,151,0.10)' },
  roundNo: { borderColor: 'rgba(255,92,122,0.4)', backgroundColor: 'rgba(255,92,122,0.10)' },
  cancel: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.bodyMedium },
  code: { color: colors.primarySoft, fontSize: 34, letterSpacing: 4, fontFamily: fonts.titleBold },
  feedback: { color: colors.green, fontSize: 14, fontFamily: fonts.bodyMedium },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  addText: { color: colors.onPrimary, fontSize: 13, fontFamily: fonts.bodySemi },
  status: { color: colors.textDim, fontSize: 13, fontFamily: fonts.bodyMedium },
});