import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { Icon } from '../../components/Icon';
import { Card, ErrorText, ProgressBar, Reveal, SectionLabel } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { colors, fonts, radius, spacing } from '../../lib/theme';
import {
  Duel,
  FORMAT_LABEL,
  duelError,
  scoreUnit,
  useCancelDuel,
  useDuels,
  useRespondDuel,
} from './api';

function shortDate(iso: string | null) {
  if (!iso) return '';
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
}

function daysLeft(endDate: string | null) {
  if (!endDate) return 0;
  const today = new Date();
  const end = new Date(`${endDate}T23:59:59`);
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86_400_000));
}

export function DuelsList() {
  const router = useRouter();
  const { data: duels, isLoading, isError } = useDuels();

  if (isLoading) return <ActivityIndicator color={colors.primarySoft} />;
  if (isError) return <ErrorText>Não foi possível carregar os desafios.</ErrorText>;

  if (!duels || duels.length === 0) {
    return (
      <Card>
        <Text style={styles.emptyTitle}>Nenhum desafio ainda</Text>
        <Text style={styles.muted}>
          Abra o perfil de um amigo e toque em “Desafiar” para começar um duelo de minutos ou de sequência.
        </Text>
      </Card>
    );
  }

  const incoming = duels.filter((item) => item.status === 'pending' && !item.i_am_challenger);
  const active = duels.filter((item) => item.status === 'active');
  const sent = duels.filter((item) => item.status === 'pending' && item.i_am_challenger);
  const finished = duels.filter((item) => item.status === 'finished');

  return (
    <View style={{ gap: spacing.md }}>
      {incoming.length > 0 ? (
        <Section title="Convites recebidos">
          {incoming.map((duel, index) => (
            <Reveal key={duel.id} index={index}>
              <IncomingCard duel={duel} />
            </Reveal>
          ))}
        </Section>
      ) : null}

      {active.length > 0 ? (
        <Section title="Em andamento">
          {active.map((duel, index) => (
            <Reveal key={duel.id} index={index}>
              <ActiveCard duel={duel} onOpen={() => router.push({ pathname: '/friend/[id]', params: { id: duel.other_id } })} />
            </Reveal>
          ))}
        </Section>
      ) : null}

      {sent.length > 0 ? (
        <Section title="Convites enviados">
          {sent.map((duel, index) => (
            <Reveal key={duel.id} index={index}>
              <SentCard duel={duel} />
            </Reveal>
          ))}
        </Section>
      ) : null}

      {finished.length > 0 ? (
        <Section title="Histórico">
          {finished.map((duel, index) => (
            <Reveal key={duel.id} index={index}>
              <FinishedCard duel={duel} />
            </Reveal>
          ))}
        </Section>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </View>
  );
}

function Header({ duel, subtitle }: { duel: Duel; subtitle: string }) {
  return (
    <View style={styles.header}>
      <Avatar uri={duel.other_avatar_url} name={duel.other_nickname} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {duel.other_nickname}
        </Text>
        <Text style={styles.muted}>{subtitle}</Text>
      </View>
      <View style={styles.reward}>
        <Icon name="flash" size={13} color={colors.gold} />
        <Text style={styles.rewardText}>+{duel.xp_reward} XP</Text>
      </View>
    </View>
  );
}

function IncomingCard({ duel }: { duel: Duel }) {
  const respond = useRespondDuel();
  return (
    <Card highlight>
      <Header duel={duel} subtitle={`${FORMAT_LABEL[duel.format]} · ${duel.duration_days} dias`} />
      <Text style={styles.muted}>
        {duel.other_nickname} te desafiou! Começa assim que você aceitar.
      </Text>
      {respond.isError ? <ErrorText>{duelError(respond.error)}</ErrorText> : null}
      <View style={styles.actions}>
        <Pressable
          style={[styles.action, styles.actionOk]}
          onPress={() => respond.mutate({ duelId: duel.id, accept: true })}
          disabled={respond.isPending}
        >
          <Icon name="flash" size={16} color={colors.onPrimary} />
          <Text style={styles.actionOkText}>Aceitar desafio</Text>
        </Pressable>
        <Pressable
          style={[styles.action, styles.actionNo]}
          onPress={() => respond.mutate({ duelId: duel.id, accept: false })}
          disabled={respond.isPending}
        >
          <Text style={styles.actionNoText}>Recusar</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function SentCard({ duel }: { duel: Duel }) {
  const cancel = useCancelDuel();
  return (
    <Card>
      <Header duel={duel} subtitle={`${FORMAT_LABEL[duel.format]} · ${duel.duration_days} dias`} />
      <View style={styles.rowBetween}>
        <Text style={styles.muted}>Aguardando {duel.other_nickname} aceitar…</Text>
        <Pressable onPress={() => cancel.mutate(duel.id)} hitSlop={8}>
          <Text style={styles.cancel}>Cancelar</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function ActiveCard({ duel, onOpen }: { duel: Duel; onOpen: () => void }) {
  const mine = duel.my_score ?? 0;
  const theirs = duel.their_score ?? 0;
  const max = Math.max(mine, theirs, 1);
  const ahead = mine > theirs;
  const tied = mine === theirs;
  const left = daysLeft(duel.end_date);

  return (
    <Pressable onPress={onOpen}>
      <Card highlight>
        <Header
          duel={duel}
          subtitle={`${FORMAT_LABEL[duel.format]} · até ${shortDate(duel.end_date)} (${left === 0 ? 'último dia' : `${left} ${left === 1 ? 'dia' : 'dias'}`})`}
        />

        <View style={{ gap: 6 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.who}>Você</Text>
            <Text style={[styles.score, ahead && { color: colors.green }]}>{scoreUnit(duel.format, mine)}</Text>
          </View>
          <ProgressBar ratio={mine / max} height={8} />
        </View>

        <View style={{ gap: 6 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.who}>{duel.other_nickname}</Text>
            <Text style={[styles.score, !ahead && !tied && { color: colors.magenta }]}>
              {scoreUnit(duel.format, theirs)}
            </Text>
          </View>
          <ProgressBar ratio={theirs / max} height={8} />
        </View>

        <Text style={[styles.status, ahead ? { color: colors.green } : tied ? null : { color: colors.magenta }]}>
          {tied ? 'Empatados por enquanto' : ahead ? 'Você está na frente 🔥' : `${duel.other_nickname} está na frente`}
        </Text>
      </Card>
    </Pressable>
  );
}

function FinishedCard({ duel }: { duel: Duel }) {
  const { session } = useAuth();
  const me = session?.user.id;
  const won = duel.winner_id === me;
  const draw = duel.winner_id === null;

  return (
    <Card>
      <Header
        duel={duel}
        subtitle={`${FORMAT_LABEL[duel.format]} · ${shortDate(duel.start_date)} a ${shortDate(duel.end_date)}`}
      />
      <View style={styles.rowBetween}>
        <View style={[styles.badge, won ? styles.badgeWin : draw ? styles.badgeDraw : styles.badgeLoss]}>
          <Icon
            name={won ? 'trophy' : draw ? 'remove-circle-outline' : 'sad-outline'}
            size={14}
            color={won ? colors.gold : draw ? colors.textMuted : colors.danger}
          />
          <Text style={[styles.badgeText, { color: won ? colors.gold : draw ? colors.textMuted : colors.danger }]}>
            {won ? `Vitória · +${duel.xp_reward} XP` : draw ? `Empate · +${Math.floor(duel.xp_reward / 2)} XP` : 'Derrota'}
          </Text>
        </View>
        <Text style={styles.muted}>
          {scoreUnit(duel.format, duel.my_score ?? 0)} x {scoreUnit(duel.format, duel.their_score ?? 0)}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { color: colors.text, fontSize: 16, fontFamily: fonts.bodySemi },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 18, fontFamily: fonts.body },
  emptyTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.title },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(242,184,75,0.12)',
  },
  rewardText: { color: colors.gold, fontSize: 12, fontFamily: fonts.bodySemi },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: radius.pill,
  },
  actionOk: { flex: 2, backgroundColor: colors.primary },
  actionOkText: { color: colors.onPrimary, fontSize: 14, fontFamily: fonts.bodySemi },
  actionNo: { flex: 1, backgroundColor: colors.surfaceHigh },
  actionNoText: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.bodyMedium },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  cancel: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.bodyMedium },
  who: { color: colors.text, fontSize: 14, fontFamily: fonts.bodyMedium },
  score: { color: colors.text, fontSize: 15, fontFamily: fonts.titleBold },
  status: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.bodyMedium },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  badgeWin: { backgroundColor: 'rgba(242,184,75,0.12)' },
  badgeDraw: { backgroundColor: colors.surfaceHigh },
  badgeLoss: { backgroundColor: 'rgba(255,92,122,0.10)' },
  badgeText: { fontSize: 12, fontFamily: fonts.bodySemi },
});