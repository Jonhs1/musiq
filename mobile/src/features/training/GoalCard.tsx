import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ProgressBar } from '../../components/ui';
import { colors, fonts, spacing } from '../../lib/theme';
import { goalSummary, idleLabel } from './format';
import type { TrainingGoal } from './types';

export function GoalCard({
  goal,
  onAddToToday,
  onArchive,
}: {
  goal: TrainingGoal;
  onAddToToday: (exerciseId: string) => void;
  onArchive: (goalId: string) => void;
}) {
  const done = goal.status === 'done';

  function confirmArchive() {
    Alert.alert('Arquivar meta?', `"${goal.title}" sai da lista de metas ativas.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Arquivar', style: 'destructive', onPress: () => onArchive(goal.goal_id) },
    ]);
  }

  return (
    <Card highlight={done}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {goal.title}
        </Text>
        {done ? <Text style={styles.doneTag}>Concluída</Text> : null}
      </View>
      <ProgressBar ratio={goal.ratio} color={done ? colors.green : colors.primary} />
      <Text style={styles.summary}>{goalSummary(goal)}</Text>
      {goal.kind === 'bpm' ? <Text style={styles.idle}>{idleLabel(goal.days_idle)}</Text> : null}

      <View style={styles.actions}>
        {!done ? (
          <View style={styles.actionWrap}>
            <Button title="Adicionar ao Hoje" variant="soft" onPress={() => onAddToToday(goal.exercise_id)} />
          </View>
        ) : null}
        {!done ? (
          <View style={styles.actionWrap}>
            <Button title="Arquivar" variant="ghost" onPress={confirmArchive} />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, color: colors.text, fontSize: 16, fontFamily: fonts.title },
  doneTag: { color: colors.green, fontSize: 12, fontFamily: fonts.bodySemi },
  summary: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
  idle: { color: colors.textDim, fontSize: 12, fontFamily: fonts.body },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionWrap: { flex: 1 },
});
