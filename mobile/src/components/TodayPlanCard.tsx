import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { localDateKey, usePlan } from '../features/plan/api';
import { colors, fonts, spacing } from '../lib/theme';
import { Icon, InstrumentTile } from './Icon';
import { Card, ProgressBar } from './ui';

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
      <Pressable onPress={() => router.push('/plan')}>
        <Card>
          <Text style={styles.label}>Treino de hoje</Text>
          <View style={styles.restRow}>
            <Icon name={isSunday ? 'moon' : 'calendar-outline'} size={20} color={colors.primarySoft} />
            <Text style={styles.text}>
              {isSunday ? 'Hoje é dia de descanso.' : 'Nenhum treino planejado para hoje.'}
            </Text>
          </View>
          <Text style={styles.link}>Ver plano da semana</Text>
        </Card>
      </Pressable>
    );
  }

  const done = todayItems.filter((item) => item.done).length;
  const minutes = todayItems.reduce((sum, item) => sum + (item.minutes ?? 0), 0);
  const next = todayItems.find((item) => !item.done);

  return (
    <Card highlight={!!next}>
      <View style={styles.header}>
        <Text style={styles.label}>Treino de hoje</Text>
        <Text style={styles.meta}>
          {done}/{todayItems.length} feitos · {minutes} min
        </Text>
      </View>

      <ProgressBar ratio={done / todayItems.length} color={next ? colors.primary : colors.green} />

      {next ? (
        <Pressable
          style={({ pressed }) => [styles.next, pressed && { opacity: 0.75 }]}
          onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: next.exercise_id } })}
        >
          <InstrumentTile id={next.instrument_id} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={styles.nextLabel}>Próximo</Text>
            <Text style={styles.nextTitle} numberOfLines={2}>
              {next.title}
            </Text>
          </View>
          <View style={styles.go}>
            <Icon name="play" size={16} color={colors.onPrimary} />
          </View>
        </Pressable>
      ) : (
        <View style={styles.restRow}>
          <Icon name="checkmark-circle" size={22} color={colors.green} />
          <Text style={styles.text}>Treino de hoje concluído.</Text>
        </View>
      )}

      <Pressable onPress={() => router.push('/plan')} hitSlop={8}>
        <Text style={styles.link}>Ver plano da semana</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: {
    color: colors.primarySoft,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontFamily: fonts.title,
  },
  meta: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body },
  text: { color: colors.text, fontSize: 15, fontFamily: fonts.body, flex: 1 },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  next: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  nextLabel: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body },
  nextTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.bodySemi },
  go: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  link: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.bodyMedium },
});
