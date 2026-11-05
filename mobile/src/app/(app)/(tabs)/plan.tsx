import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Screen } from '../../../components/ui';
import {
  localDateKey,
  PlanItem,
  usePlan,
  useRegeneratePlan,
  WEEKDAY_NAMES,
  weekDayKeys,
} from '../../../features/plan/api';
import { INSTRUMENT_EMOJI, useProfile } from '../../../features/profile/api';
import { colors, radius, spacing } from '../../../lib/theme';

export default function Plan() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: items, isLoading, isError, refetch } = usePlan();
  const regenerate = useRegeneratePlan();
  const [goal, setGoal] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const savedGoal = profile?.daily_goal_minutes ?? 20;
  const currentGoal = goal ?? savedGoal;
  const goalChanged = currentGoal !== savedGoal;

  const days = weekDayKeys();
  const today = localDateKey(new Date());

  function openExercise(item: PlanItem) {
    router.push({ pathname: '/exercise/[id]', params: { id: item.exercise_id } });
  }

  return (
    <Screen>
      <Text style={styles.title}>Plano da semana</Text>
      <Text style={styles.subtitle}>
        Sugestão baseada no seu nível, na sua meta e nos instrumentos que você anda deixando de lado.
      </Text>

      <View style={styles.goalCard}>
        <View style={styles.goalRow}>
          <Text style={styles.goalLabel}>Meta diária</Text>
          <View style={styles.goalControls}>
            <RoundButton label="−5" onPress={() => setGoal(Math.max(5, currentGoal - 5))} />
            <Text style={styles.goalValue}>{currentGoal} min</Text>
            <RoundButton label="+5" onPress={() => setGoal(Math.min(180, currentGoal + 5))} />
          </View>
        </View>
        <Button
          title={goalChanged ? 'Aplicar meta e refazer o plano' : 'Refazer o plano de hoje em diante'}
          variant={goalChanged ? 'primary' : 'ghost'}
          loading={regenerate.isPending}
          onPress={() => regenerate.mutate(currentGoal)}
        />
        {regenerate.isError ? (
          <Text style={styles.error}>Não foi possível refazer o plano. Verifique a conexão.</Text>
        ) : null}
      </View>

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {isError ? <Text style={styles.error}>Não foi possível carregar o plano.</Text> : null}

      {items
        ? days.map((key, index) => {
            const dayItems = items.filter((item) => item.day_date === key);
            const isToday = key === today;
            const isPast = key < today;
            const isRest = index === 6;
            const doneCount = dayItems.filter((item) => item.done).length;
            const totalMinutes = dayItems.reduce((sum, item) => sum + (item.minutes ?? 0), 0);

            return (
              <View key={key} style={[styles.day, isToday && styles.dayToday]}>
                <View style={styles.dayHeader}>
                  <Text style={[styles.dayName, isToday && { color: colors.primary }]}>
                    {WEEKDAY_NAMES[index]}
                    {isToday ? ' · hoje' : ''}
                  </Text>
                  {dayItems.length > 0 ? (
                    <Text style={styles.dayMeta}>
                      {doneCount}/{dayItems.length} feitos · {totalMinutes} min
                    </Text>
                  ) : null}
                </View>

                {dayItems.length === 0 ? (
                  <Text style={styles.empty}>
                    {isRest ? 'Dia de descanso 😴' : isPast ? 'Sem treino planejado' : 'Sem treino planejado'}
                  </Text>
                ) : (
                  dayItems.map((item) => (
                    <Pressable
                      key={item.item_id}
                      style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
                      onPress={() => openExercise(item)}
                    >
                      <Text style={styles.itemEmoji}>{INSTRUMENT_EMOJI[item.instrument_id] ?? '🎵'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemTitle, item.done && styles.itemTitleDone]}>{item.title}</Text>
                        <Text style={styles.itemMeta}>
                          {item.minutes ?? '—'} min · nível {item.difficulty}
                          {item.recommended_bpm ? ` · ${item.recommended_bpm} BPM` : ''}
                        </Text>
                      </View>
                      <Text style={[styles.check, item.done && { color: colors.primary }]}>
                        {item.done ? '✓' : '○'}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            );
          })
        : null}
    </Screen>
  );
}

function RoundButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.round, pressed && { opacity: 0.6 }]}>
      <Text style={styles.roundText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: '700', marginTop: spacing.md },
  subtitle: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 13 },
  goalCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalLabel: { color: colors.textMuted, fontSize: 14 },
  goalControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  goalValue: { color: colors.text, fontSize: 18, fontWeight: '700', minWidth: 70, textAlign: 'center' },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  day: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  dayToday: { borderColor: colors.primary },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  dayMeta: { color: colors.textMuted, fontSize: 12 },
  empty: { color: colors.textMuted, fontSize: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 },
  itemEmoji: { fontSize: 22 },
  itemTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  itemTitleDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  itemMeta: { color: colors.textMuted, fontSize: 12 },
  check: { color: colors.textMuted, fontSize: 20, fontWeight: '800', width: 24, textAlign: 'center' },
});