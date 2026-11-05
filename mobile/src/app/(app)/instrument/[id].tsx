import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../../../components/BackButton';
import { Screen } from '../../../components/ui';
import { useExercises } from '../../../features/exercises/api';
import { INSTRUMENT_EMOJI, useInstruments } from '../../../features/profile/api';
import { difficultyDots } from '../../../lib/format';
import { colors, radius, spacing } from '../../../lib/theme';

export default function InstrumentExercises() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: instruments } = useInstruments();
  const { data: exercises, isLoading, isError } = useExercises(id);
  const instrument = instruments?.find((item) => item.id === id);

  return (
    <Screen>
      <BackButton />
      <Text style={styles.title}>
        {INSTRUMENT_EMOJI[id] ?? '🎵'} {instrument?.name ?? ''}
      </Text>
      <Text style={styles.subtitle}>Escolha um exercício para praticar.</Text>

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {isError ? <Text style={styles.error}>Não foi possível carregar os exercícios.</Text> : null}

      <View style={{ gap: spacing.sm }}>
        {exercises?.map((exercise) => (
          <Pressable
            key={exercise.id}
            style={styles.card}
            onPress={() =>
              router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } })
            }
          >
            <Text style={styles.cardTitle}>{exercise.title}</Text>
            <View style={styles.meta}>
              <Text style={styles.dots}>{difficultyDots(exercise.difficulty)}</Text>
              {exercise.recommended_bpm ? (
                <Text style={styles.metaText}>{exercise.recommended_bpm} BPM</Text>
              ) : null}
              {exercise.duration_minutes ? (
                <Text style={styles.metaText}>{exercise.duration_minutes} min</Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: '700', marginTop: spacing.sm },
  subtitle: { color: colors.textMuted, fontSize: 15 },
  error: { color: colors.danger },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dots: { color: colors.primary, fontSize: 12, letterSpacing: 2 },
  metaText: { color: colors.textMuted, fontSize: 13 },
});