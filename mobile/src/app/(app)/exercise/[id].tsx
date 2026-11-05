import { ReactNode } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../../../components/BackButton';
import { Dots } from '../../../components/Dots';
import { Button, Card, Reveal, Screen, SectionLabel, Title } from '../../../components/ui';
import { useExercise } from '../../../features/exercises/api';
import { DIFFICULTY_LABELS } from '../../../lib/format';
import { colors, fonts, spacing } from '../../../lib/theme';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: exercise, isLoading } = useExercise(id);

  if (isLoading || !exercise) {
    return (
      <Screen>
        <BackButton />
        <ActivityIndicator color={colors.primarySoft} />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackButton />
      <Reveal index={0}>
        <Title>{exercise.title}</Title>
      </Reveal>

      <Reveal index={1} style={styles.stats}>
        <Stat label="Dificuldade" value={DIFFICULTY_LABELS[exercise.difficulty]}>
          <Dots level={exercise.difficulty} />
        </Stat>
        <Stat label="BPM sugerido" value={exercise.recommended_bpm ? String(exercise.recommended_bpm) : '—'} />
        <Stat label="Duração" value={exercise.duration_minutes ? `${exercise.duration_minutes} min` : '—'} />
      </Reveal>

      {exercise.objective ? (
        <Reveal index={2}>
          <Card>
            <SectionLabel>Objetivo</SectionLabel>
            <Text style={styles.blockText}>{exercise.objective}</Text>
          </Card>
        </Reveal>
      ) : null}

      {exercise.description ? (
        <Reveal index={3}>
          <Card>
            <SectionLabel>Como praticar</SectionLabel>
            <Text style={styles.blockText}>{exercise.description}</Text>
          </Card>
        </Reveal>
      ) : null}

      <Reveal index={4} style={{ marginTop: spacing.sm }}>
        <Button
          title="Iniciar prática"
          icon="play"
          onPress={() => router.push({ pathname: '/practice/[id]', params: { id: exercise.id } })}
        />
      </Reveal>
    </Screen>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  statLabel: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body },
  statValue: { color: colors.text, fontSize: 16, fontFamily: fonts.title },
  blockText: { color: colors.text, fontSize: 15, lineHeight: 23, fontFamily: fonts.body },
});
