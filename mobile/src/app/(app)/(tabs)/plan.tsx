import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, InstrumentTile } from '../../../components/Icon';
import { Button, Card, ErrorText, IconButton, Reveal, Screen, Subtitle, Title } from '../../../components/ui';
import {
  localDateKey,
  PlanItem,
  usePlan,
  useRegeneratePlan,
  WEEKDAY_NAMES,
  weekDayKeys,
} from '../../../features/plan/api';
import { useProfile } from '../../../features/profile/api';
import { colors, fonts, radius, spacing } from '../../../lib/theme';

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
      <Reveal index={0}>
        <Title>Plano da semana</Title>
        <Subtitle>
          Sugestão baseada no seu nível, na sua meta e nos instrumentos que você anda deixando de lado.
        </Subtitle>
      </Reveal>

      <Reveal index={1}>
        <Card>
          <View style={styles.goalRow}>
            <View>
              <Text style={styles.goalLabel}>Meta diária</Text>
              <Text style={styles.goalValue}>{currentGoal} min</Text>
            </View>
            <View style={styles.goalControls}>
              <IconButton name="remove" onPress={() => setGoal(Math.max(5, currentGoal - 5))} />
              <IconButton name="add" onPress={() => setGoal(Math.min(180, currentGoal + 5))} />
            </View>
          </View>
          <Button
            title={goalChanged ? 'Aplicar meta e refazer o plano' : 'Refazer o plano de hoje em diante'}
            variant={goalChanged ? 'primary' : 'ghost'}
            loading={regenerate.isPending}
            onPress={() => regenerate.mutate(currentGoal)}
          />
          {regenerate.isError ? (
            <ErrorText>Não foi possível refazer o plano. Verifique a conexão.</ErrorText>
          ) : null}
        </Card>
      </Reveal>

      {isLoading ? <ActivityIndicator color={colors.primarySoft} /> : null}
      {isError ? <ErrorText>Não foi possível carregar o plano.</ErrorText> : null}

      {items
        ? days.map((key, index) => {
            const dayItems = items.filter((item) => item.day_date === key);
            const isToday = key === today;
            const isRest = index === 6;
            const doneCount = dayItems.filter((item) => item.done).length;
            const totalMinutes = dayItems.reduce((sum, item) => sum + (item.minutes ?? 0), 0);

            return (
              <Reveal key={key} index={2 + index}>
                <Card highlight={isToday}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayTitleRow}>
                      <Text style={[styles.dayName, isToday && { color: colors.primarySoft }]}>
                        {WEEKDAY_NAMES[index]}
                      </Text>
                      {isToday ? (
                        <View style={styles.todayTag}>
                          <Text style={styles.todayTagText}>Hoje</Text>
                        </View>
                      ) : null}
                    </View>
                    {dayItems.length > 0 ? (
                      <Text style={styles.dayMeta}>
                        {doneCount}/{dayItems.length} feitos · {totalMinutes} min
                      </Text>
                    ) : null}
                  </View>

                  {dayItems.length === 0 ? (
                    <View style={styles.emptyRow}>
                      {isRest ? <Icon name="moon" size={16} color={colors.textDim} /> : null}
                      <Text style={styles.empty}>{isRest ? 'Dia de descanso' : 'Sem treino planejado'}</Text>
                    </View>
                  ) : (
                    dayItems.map((item) => (
                      <Pressable
                        key={item.item_id}
                        style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
                        onPress={() => openExercise(item)}
                      >
                        <InstrumentTile id={item.instrument_id} size={40} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.itemTitle, item.done && styles.itemTitleDone]}>{item.title}</Text>
                          <Text style={styles.itemMeta}>
                            {item.minutes ?? '—'} min · nível {item.difficulty}
                            {item.recommended_bpm ? ` · ${item.recommended_bpm} BPM` : ''}
                          </Text>
                        </View>
                        <Icon
                          name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
                          size={24}
                          color={item.done ? colors.green : colors.borderStrong}
                        />
                      </Pressable>
                    ))
                  )}
                </Card>
              </Reveal>
            );
          })
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalLabel: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
  goalValue: { color: colors.text, fontSize: 28, lineHeight: 34, fontFamily: fonts.titleBold },
  goalControls: { flexDirection: 'row', gap: spacing.sm },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayName: { color: colors.text, fontSize: 17, fontFamily: fonts.title },
  todayTag: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
  },
  todayTagText: { color: colors.primarySoft, fontSize: 11, fontFamily: fonts.bodySemi },
  dayMeta: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empty: { color: colors.textDim, fontSize: 14, fontFamily: fonts.body },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  itemTitle: { color: colors.text, fontSize: 15, fontFamily: fonts.bodySemi },
  itemTitleDone: { color: colors.textDim, textDecorationLine: 'line-through' },
  itemMeta: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body },
});
