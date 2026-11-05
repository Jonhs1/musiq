import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Screen } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { colors, radius, spacing } from '../../lib/theme';
import { INSTRUMENT_EMOJI, useMyInstruments, useProfile } from '../../features/profile/api';
import { formatDuration } from '../../lib/format';

export default function Home() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: myInstruments } = useMyInstruments();

  const totalMinutes = Math.floor((profile?.total_practice_seconds ?? 0) / 60);

  return (
    <Screen>
      <Text style={styles.greeting}>Olá, {profile?.nickname}!</Text>
      <Text style={styles.stats}>
        Nível {profile?.level} · {profile?.xp} XP · {profile?.streak_days} dias seguidos
      </Text>
      <Text style={styles.stats}>
        Total praticado: {formatDuration((profile?.total_practice_seconds ?? 0) % 3600)} ({totalMinutes} min)
      </Text>

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

      <View style={{ marginTop: spacing.xl }}>
        <Button title="Sair" variant="ghost" onPress={() => supabase.auth.signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { color: colors.text, fontSize: 28, fontWeight: '700', marginTop: spacing.md },
  stats: { color: colors.textMuted, fontSize: 14 },
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