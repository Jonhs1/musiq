import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorText, Reveal, Screen, SectionLabel, Subtitle, Title } from '../../../components/ui';
import { localDateKey, usePlan } from '../../../features/plan/api';
import { useProfile } from '../../../features/profile/api';
import { ExercisePicker } from '../../../features/training/ExercisePicker';
import { GoalCard } from '../../../features/training/GoalCard';
import { TodayList } from '../../../features/training/TodayList';
import {
  friendlyError,
  useAddToToday,
  useArchiveGoal,
  useRemoveFromToday,
  useReplaceTodayItem,
  useTrainingGoals,
} from '../../../features/training/api';
import type { Exercise } from '../../../features/exercises/api';
import { MaterialCard } from '../../../features/materials/MaterialCard';
import { useMaterials } from '../../../features/materials/api';
import { colors, fonts, spacing } from '../../../lib/theme';

type Picker = { mode: 'add' } | { mode: 'replace'; itemId: string; currentExerciseId: string } | null;

// Aba "Treino": o que praticar hoje (editável) e as metas com progresso.
export default function Training() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const plan = usePlan();
  const goals = useTrainingGoals();
  const addToday = useAddToToday();
  const removeToday = useRemoveFromToday();
  const replaceToday = useReplaceTodayItem();
  const archive = useArchiveGoal();
  const materials = useMaterials();
  const [picker, setPicker] = useState<Picker>(null);
  const [showDone, setShowDone] = useState(false);

  useFocusEffect(
    useCallback(() => {
      plan.refetch();
      goals.refetch();
    }, [plan.refetch, goals.refetch]),
  );

  const today = localDateKey(new Date());
  const items = plan.data ?? [];
  const todays = items.filter((item) => item.day_date === today);
  const todayMinutes = todays.reduce((sum, item) => sum + (item.minutes ?? 0), 0);
  const dailyGoal = profile?.daily_goal_minutes ?? 20;
  const todayExerciseIds = todays.map((item) => item.exercise_id);

  const allGoals = goals.data ?? [];
  const activeGoals = allGoals.filter((goal) => goal.status === 'active');
  const doneGoals = allGoals.filter((goal) => goal.status === 'done');

  const mutationFailed = [addToday, removeToday, replaceToday, archive].find((mutation) => mutation.isError);

  function closePicker() {
    setPicker(null);
  }

  function onPickExercise(exercise: Exercise) {
    if (!picker) return;
    if (picker.mode === 'add') {
      addToday.mutate(exercise.id, { onSuccess: closePicker });
    } else {
      replaceToday.mutate({ itemId: picker.itemId, exerciseId: exercise.id }, { onSuccess: closePicker });
    }
  }

  // Ao trocar, o próprio exercício do item pode ficar disponível de novo
  const excludeIds =
    picker?.mode === 'replace'
      ? todayExerciseIds.filter((id) => id !== picker.currentExerciseId)
      : todayExerciseIds;

  return (
    <Screen>
      <Reveal index={0}>
        <Title>Treino</Title>
        <Subtitle>O que praticar hoje e quanto falta para as suas metas.</Subtitle>
      </Reveal>

      <Reveal index={1}>
        <Card>
          <View style={styles.sectionHeader}>
            <SectionLabel>Hoje</SectionLabel>
            <Text style={styles.dayMeta}>
              {todayMinutes} de {dailyGoal} min
            </Text>
          </View>
          {plan.isLoading ? <ActivityIndicator color={colors.primarySoft} /> : null}
          {plan.isError ? <ErrorText>Não foi possível carregar o plano.</ErrorText> : null}
          {plan.data ? (
            <TodayList
              items={items}
              onAdd={() => setPicker({ mode: 'add' })}
              onReplace={(itemId) => {
                const current = items.find((item) => item.item_id === itemId);
                setPicker({ mode: 'replace', itemId, currentExerciseId: current?.exercise_id ?? '' });
              }}
              onRemove={(itemId) => removeToday.mutate(itemId)}
            />
          ) : null}
          <Pressable onPress={() => router.push('/plan-week')} hitSlop={8}>
            <Text style={styles.link}>Ver semana</Text>
          </Pressable>
        </Card>
      </Reveal>

      <Reveal index={2}>
        <View style={styles.sectionHeader}>
          <SectionLabel>Metas</SectionLabel>
          <Button title="Nova meta" variant="soft" icon="add" onPress={() => router.push('/goal-form')} />
        </View>

        {goals.isLoading ? <ActivityIndicator color={colors.primarySoft} /> : null}
        {goals.isError ? <ErrorText>Não foi possível carregar as metas.</ErrorText> : null}

        {!goals.isLoading && !goals.isError && activeGoals.length === 0 && doneGoals.length === 0 ? (
          <Card>
            <Text style={styles.explain}>
              Meta mostra a sua evolução. Escolha um exercício com BPM, um valor inicial e um alvo: a barra sobe
              conforme você pratica. Ou defina quantos dias por semana quer praticar.
            </Text>
          </Card>
        ) : null}

        {activeGoals.map((goal) => (
          <GoalCard
            key={goal.goal_id}
            goal={goal}
            onAddToToday={(exerciseId) => addToday.mutate(exerciseId)}
            onArchive={(goalId) => archive.mutate(goalId)}
          />
        ))}

        {doneGoals.length > 0 ? (
          <>
            <Pressable onPress={() => setShowDone((value) => !value)} hitSlop={8}>
              <Text style={styles.link}>
                {showDone ? 'Ocultar concluídas' : `Concluídas (${doneGoals.length})`}
              </Text>
            </Pressable>
            {showDone
              ? doneGoals.map((goal) => (
                  <GoalCard
                    key={goal.goal_id}
                    goal={goal}
                    onAddToToday={(exerciseId) => addToday.mutate(exerciseId)}
                    onArchive={(goalId) => archive.mutate(goalId)}
                  />
                ))
              : null}
          </>
        ) : null}
      </Reveal>

      <Reveal index={3}>
        <View style={styles.sectionHeader}>
          <SectionLabel>Meus materiais</SectionLabel>
          <Button title="Importar material" variant="soft" icon="add" onPress={() => router.push('/material-import')} />
        </View>
        {materials.isError ? <ErrorText>Não foi possível carregar os materiais.</ErrorText> : null}
        {materials.data && materials.data.length === 0 ? (
          <Card>
            <Text style={styles.explain}>Importe a apostila de um curso e transforme os exercícios em metas e rotina.</Text>
          </Card>
        ) : null}
        {(materials.data ?? []).map((m) => (
          <MaterialCard key={m.id} material={m} onPress={() => router.push({ pathname: '/material/[id]', params: { id: m.id } })} />
        ))}
      </Reveal>

      {mutationFailed ? <ErrorText>{friendlyError(mutationFailed.error)}</ErrorText> : null}

      <Modal visible={picker !== null} animationType="slide" onRequestClose={closePicker}>
        <Screen>
          <Title>{picker?.mode === 'replace' ? 'Trocar exercício' : 'Adicionar ao Hoje'}</Title>
          <Subtitle>Escolha um exercício. Ele entra no dia de hoje.</Subtitle>
          <ExercisePicker onPick={onPickExercise} excludeIds={excludeIds} />
          {addToday.isPending || replaceToday.isPending ? (
            <ActivityIndicator color={colors.primarySoft} />
          ) : null}
          <Button title="Fechar" variant="ghost" onPress={closePicker} />
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  dayMeta: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body },
  link: { color: colors.primarySoft, fontSize: 14, fontFamily: fonts.bodySemi, paddingVertical: 4 },
  explain: { color: colors.textMuted, fontSize: 14, lineHeight: 20, fontFamily: fonts.body },
});
