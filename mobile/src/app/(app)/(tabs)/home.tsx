import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { Icon, InstrumentTile } from '../../../components/Icon';
import { useFriendRequests } from '../../../features/friends/api';
import { TodayPlanCard } from '../../../components/TodayPlanCard';
import { Card, ProgressBar, Reveal, Screen, SectionLabel } from '../../../components/ui';
import { useMyInstruments, useProfile } from '../../../features/profile/api';
import { useAuth } from '../../../lib/auth';
import { levelProgress, levelTitle } from '../../../lib/level';
import { syncPendingSessions, usePendingCount } from '../../../lib/pendingSessions';
import { colors, fonts, radius, spacing } from '../../../lib/theme';
import { useUnreadTotal } from '../../../features/chat/api';
import { useIncomingDuelCount } from '../../../features/duels/api';

export default function Home() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { data: profile } = useProfile();
  const { data: myInstruments } = useMyInstruments();
  const pending = usePendingCount((state) => state.count);
  const { data: requests } = useFriendRequests();
  const incomingRequests = requests?.filter((item) => item.direction === 'incoming').length ?? 0;
  const unreadMessages = useUnreadTotal();
  const incomingDuels = useIncomingDuelCount();
  const incoming = incomingRequests + unreadMessages + incomingDuels;

  const xp = profile?.xp ?? 0;
  const progress = levelProgress(xp);
  const totalMinutes = Math.floor((profile?.total_practice_seconds ?? 0) / 60);

  async function retryNow() {
    if (!session) return;
    const result = await syncPendingSessions(session.user.id);
    if (result.synced > 0) {
      queryClient.invalidateQueries({ queryKey: ['profile', session.user.id] });
      queryClient.invalidateQueries({ queryKey: ['unlocked', session.user.id] });
    }
    Alert.alert(
      'Envio',
      `Na fila desta conta: ${result.attempted}\nEnviadas agora: ${result.synced}\nDe outra conta: ${result.otherUsers}` +
      (result.lastError ? `\nErro: ${result.lastError}` : ''),
    );
  }

  return (
    <Screen>
      <Reveal index={0} style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Olá,</Text>
          <Text style={styles.name} numberOfLines={1}>
            {profile?.nickname}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/tuner')} hitSlop={8} style={styles.friendsButton}>
          <Icon name="musical-note" size={22} color={colors.primarySoft} />
        </Pressable>
        <Pressable onPress={() => router.push('/friends')} hitSlop={8} style={styles.friendsButton}>
          <Icon name="people" size={22} color={colors.primarySoft} />
          {incoming > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{incoming}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable onPress={() => router.push('/profile')}>
          <Avatar uri={profile?.avatar_url} name={profile?.nickname} size={48} ring />
        </Pressable>
      </Reveal>

      {pending > 0 ? (
        <Reveal index={1}>
          <Pressable onPress={retryNow} style={styles.pending}>
            <Icon name="sync-outline" size={18} color={colors.gold} />
            <Text style={styles.pendingText}>
              {pending} sessão(ões) aguardando envio · toque para tentar agora
            </Text>
          </Pressable>
        </Reveal>
      ) : null}

      <Reveal index={1}>
        <Card>
          <View style={styles.levelRow}>
            <Text style={styles.levelTitle}>
              Nível {progress.level} · {levelTitle(progress.level)}
            </Text>
            <Text style={styles.xp}>
              {xp} / {progress.next} XP
            </Text>
          </View>
          <ProgressBar ratio={progress.ratio} />
          <View style={styles.stats}>
            <Stat icon="flame" color={colors.magenta} value={`${profile?.streak_days ?? 0}`} label="dias seguidos" />
            <View style={styles.divider} />
            <Stat icon="time-outline" color={colors.primarySoft} value={`${totalMinutes}`} label="min praticados" />
          </View>
        </Card>
      </Reveal>

      <Reveal index={2}>
        <TodayPlanCard />
      </Reveal>

      <Reveal index={3}>
        <SectionLabel>O que você quer praticar?</SectionLabel>
      </Reveal>
      <View style={{ gap: spacing.sm }}>
        {myInstruments?.map((item, index) => (
          <Reveal key={item.instrument_id} index={4 + index}>
            <Pressable
              style={({ pressed }) => [styles.instrument, pressed && { transform: [{ scale: 0.98 }] }]}
              onPress={() =>
                router.push({ pathname: '/instrument/[id]', params: { id: item.instrument_id } })
              }
            >
              <InstrumentTile id={item.instrument_id} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={styles.instrumentName}>{item.instruments.name}</Text>
                {item.is_primary ? <Text style={styles.primaryTag}>Principal</Text> : null}
              </View>
              <Icon name="chevron-forward" size={20} color={colors.textDim} />
            </Pressable>
          </Reveal>
        ))}
      </View>
    </Screen>
  );
}

function Stat({
  icon,
  color,
  value,
  label,
}: {
  icon: 'flame' | 'time-outline';
  color: string;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={22} color={color} />
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  hello: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.body },
  name: { color: colors.text, fontSize: 30, lineHeight: 36, fontFamily: fonts.titleBold },
  friendsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.magenta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontFamily: fonts.bodySemi },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(242,184,75,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(242,184,75,0.28)',
  },
  pendingText: { color: colors.gold, fontSize: 13, fontFamily: fonts.body, flex: 1 },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.title },
  xp: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center' },
  statValue: { color: colors.text, fontSize: 20, lineHeight: 24, fontFamily: fonts.titleBold },
  statLabel: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body },
  divider: { width: 1, height: 32, backgroundColor: colors.border },
  instrument: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  instrumentName: { color: colors.text, fontSize: 18, fontFamily: fonts.title },
  primaryTag: { color: colors.primarySoft, fontSize: 12, fontFamily: fonts.bodyMedium },
});