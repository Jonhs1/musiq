import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { localDateKey, usePlan } from '../features/plan/api';
import { INSTRUMENT_EMOJI } from '../features/profile/api';
import { colors, radius, spacing } from '../lib/theme';

export function TodayPlanCard() {
  const router = useRouter();
  const { data: items } = usePlan();

  if (!items) return null;

  const now = new Date();
  const today = localDateKey(now);
  const todayItems = items.filter((item) => item.day_date === today);
  const isSunday = now.getDay() === 0;

  if (todayItems.length === 0) {
    return (
      <Pressable style={styles.card} onPress={() => router.push('/plan')}>
        <Text style={styles.label}>Treino de hoje</Text>
        <Text style={styles.text}>
          {isSunday ? 'Hoje é dia de descanso 😴' : 'Nenhum treino planejado para hoje.'}
        </Text>
        <Text style={styles.link}>Ver plano da semana →</Text>
      </Pressable>
    );
  }

  const done = todayItems.filter((item) => item.done).length;
  const minutes = todayItems.reduce((sum, item) => sum + (item.minutes ?? 0), 0);
  const next = todayItems.find((item) => !item.done);

  return (
    <View style={[styles.card, !next && styles.cardDone]}>
      <View style={styles.header}>
        <Text style={styles.label}>Treino de hoje</Text>
        <Text style={styles.meta}>
          {done}/{todayItems.length} feitos · {minutes} min
        </Text>
      </View>

      {next ? (
        <Pressable
          style={({ pressed }) => [styles.next, pressed && { opacity: 0.7 }]}
          onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: next.exercise_id } })}
        >
          <Text style={styles.emoji}>{INSTRUMENT_EMOJI[next.instrument_id] ?? '🎵'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.nextLabel}>Próximo</Text>
            <Text style={styles.nextTitle}>{next.title}</Text>
          </View>
          <Text style={styles.go}>Começar</Text>
        </Pressable>
      ) : (
        <Text style={styles.text}>Treino de hoje concluído ✓</Text>
      )}

      <Pressable onPress={() => router.push('/plan')}>
        <Text style={styles.link}>Ver plano da semana →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.sm,
  },
  cardDone: { borderColor: colors.border },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: colors.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  meta: { color: colors.textMuted, fontSize: 12 },
  text: { color: colors.text, fontSize: 15 },
  next: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emoji: { fontSize: 26 },
  nextLabel: { color: colors.textMuted, fontSize: 12 },
  nextTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  go: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  link: { color: colors.textMuted, fontSize: 13 },
});