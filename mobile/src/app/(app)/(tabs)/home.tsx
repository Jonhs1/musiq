import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { TodayPlanCard } from '../../../components/TodayPlanCard';
import { Screen } from '../../../components/ui';
import { colors, radius, spacing } from '../../../lib/theme';
import { INSTRUMENT_EMOJI, useMyInstruments, useProfile } from '../../../features/profile/api';
import { useAuth } from '../../../lib/auth';
import { formatDuration } from '../../../lib/format';
import { syncPendingSessions, usePendingCount } from '../../../lib/pendingSessions';

export default function Home() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { data: profile } = useProfile();
  const { data: myInstruments } = useMyInstruments();
  const pending = usePendingCount((state) => state.count);

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
      <Text style={styles.greeting}>Olá, {profile?.nickname}!</Text>
      <Text style={styles.stats}>
        Nível {profile?.level} · {profile?.xp} XP · {profile?.streak_days} dias seguidos
      </Text>
      <Text style={styles.stats}>
        Total praticado: {formatDuration((profile?.total_practice_seconds ?? 0) % 3600)} ({totalMinutes} min)
      </Text>
      {pending > 0 ? (
        <Pressable onPress={retryNow}>
          <Text style={styles.pending}>
            ⏳ {pending} sessão(ões) aguardando envio · toque para tentar agora
          </Text>
        </Pressable>
      ) : null}

      <TodayPlanCard />

      <Text style={styles.section}>O que você quer praticar hoje?</Text>
      <View style={{ gap: spacing.sm }}>
        {myInstruments?.map((item) => (
          <Pressable
            key={item.instrument_id}
            style={styles.card}
            onPress={() =>
              router.push({ pathname: '/instrument/[id]', params: { id: item.instrument_id } })
            }
          >
            <Text style={styles.emoji}>{INSTRUMENT_EMOJI[item.instrument_id] ?? '🎵'}</Text>
            <Text style={styles.cardText}>{item.instruments.name}</Text>
            {item.is_primary ? <Text style={styles.primaryTag}>principal</Text> : null}
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { color: colors.text, fontSize: 28, fontWeight: '700', marginTop: spacing.md },
  stats: { color: colors.textMuted, fontSize: 14 },
  pending: { color: colors.gold, fontSize: 13 },
  section: { color: colors.text, fontSize: 18, fontWeight: '600', marginTop: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emoji: { fontSize: 28 },
  cardText: { color: colors.text, fontSize: 18, fontWeight: '600', flex: 1 },
  primaryTag: { color: colors.primary, fontSize: 12 },
});