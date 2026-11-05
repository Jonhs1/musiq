import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../../../components/BackButton';
import { Button, Screen } from '../../../components/ui';
import { useExercise } from '../../../features/exercises/api';
import { DIFFICULTY_LABELS, difficultyDots } from '../../../lib/format';
import { colors, radius, spacing } from '../../../lib/theme';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: exercise, isLoading } = useExercise(id);

  if (isLoading || !exercise) {
    return (
      <Screen>
        <BackButton />
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackButton />
      <Text style={styles.title}>{exercise.title}</Text>

      <View style={styles.stats}>
        <Stat label="Dificuldade" value={DIFFICULTY_LABELS[exercise.difficulty]} extra={difficultyDots(exercise.difficulty)} />
        <Stat label="BPM sugerido" value={exercise.recommended_bpm ? String(exercise.recommended_bpm) : '—'} />
        <Stat label="Duração" value={exercise.duration_minutes ? `${exercise.duration_minutes} min` : '—'} />
      </View>

      {exercise.objective ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Objetivo</Text>
          <Text style={styles.blockText}>{exercise.objective}</Text>
        </View>
      ) : null}

      {exercise.description ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Como praticar</Text>
          <Text style={styles.blockText}>{exercise.description}</Text>
        </View>
      )  : null}

      <View style={{ marginTop: spacing.md }}>
        <Button
          title="Iniciar prática"
          onPress={() => router.push({ pathname: '/practice/[id]', params: { id: exercise.id } })}
        />
      </View>
    </Screen>
  );
}

function Stat({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {extra ? <Text style={styles.statExtra}>{extra}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 26, fontWeight: '700', marginTop: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '700' },
  statExtra: { color: colors.primary, fontSize: 10, letterSpacing: 2 },
  block: { gap: spacing.xs },
  blockTitle: { color: colors.primary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  blockText: { color: colors.text, fontSize: 16, lineHeight: 23 },
});