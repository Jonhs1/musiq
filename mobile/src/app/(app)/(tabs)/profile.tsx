import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { Button, Screen } from '../../../components/ui';
import { useUnlockedAchievements } from '../../../features/achievements/api';
import { INSTRUMENT_EMOJI, useMyInstruments, useProfile } from '../../../features/profile/api';
import { levelProgress, levelTitle } from '../../../lib/level';
import { supabase } from '../../../lib/supabase';
import { colors, radius, spacing } from '../../../lib/theme';

function formatTotalTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}

export default function Profile() {
  const { data: profile } = useProfile();
  const { data: myInstruments } = useMyInstruments();
  const { data: unlocked } = useUnlockedAchievements();

  const xp = profile?.xp ?? 0;
  const progress = levelProgress(xp);

  return (
    <Screen>
      <View style={styles.header}>
        <Avatar uri={profile?.avatar_url} name={profile?.nickname} size={96} />
        <Text style={styles.nickname}>{profile?.nickname}</Text>
        {profile?.full_name ? <Text style={styles.fullName}>{profile.full_name}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.levelTitle}>
          Nível {progress.level} · {levelTitle(progress.level)}
        </Text>
        <View style={styles.barBackground}>
          <View style={[styles.barFill, { width: `${Math.round(progress.ratio * 100)}%` }]} />
        </View>
        <Text style={styles.xpText}>
          {xp} / {progress.next} XP
        </Text>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Sequência" value={`${profile?.streak_days ?? 0} dias`} />
        <Stat label="Praticado" value={formatTotalTime(profile?.total_practice_seconds ?? 0)} />
        <Stat label="Conquistas" value={String(unlocked?.length ?? 0)} />
      </View>

      <Text style={styles.section}>Instrumentos</Text>
      <View style={{ gap: spacing.sm }}>
        {myInstruments?.map((item) => (
          <View key={item.instrument_id} style={styles.instrument}>
            <Text style={styles.emoji}>{INSTRUMENT_EMOJI[item.instrument_id] ?? '🎵'}</Text>
            <Text style={styles.instrumentName}>{item.instruments.name}</Text>
            {item.is_primary ? <Text style={styles.primaryTag}>principal</Text> : null}
          </View>
        ))}
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <Button title="Sair" variant="ghost" onPress={() => supabase.auth.signOut()} />
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  nickname: { color: colors.text, fontSize: 24, fontWeight: '700', marginTop: spacing.sm },
  fullName: { color: colors.textMuted, fontSize: 14 },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  levelTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  barBackground: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5, backgroundColor: colors.primary },
  xpText: { color: colors.textMuted, fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  section: { color: colors.text, fontSize: 18, fontWeight: '600', marginTop: spacing.sm },
  instrument: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emoji: { fontSize: 24 },
  instrumentName: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  primaryTag: { color: colors.primary, fontSize: 12 },
});