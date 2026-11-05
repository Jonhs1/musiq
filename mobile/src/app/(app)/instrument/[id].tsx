import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../../../components/BackButton';
import { Dots } from '../../../components/Dots';
import { Icon, InstrumentTile } from '../../../components/Icon';
import { ErrorText, Reveal, Screen, Subtitle, Title } from '../../../components/ui';
import { useExercises } from '../../../features/exercises/api';
import { useInstruments } from '../../../features/profile/api';
import { colors, fonts, radius, spacing } from '../../../lib/theme';

export default function InstrumentExercises() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: instruments } = useInstruments();
  const { data: exercises, isLoading, isError } = useExercises(id);
  const instrument = instruments?.find((item) => item.id === id);

  return (
    <Screen>
      <BackButton />
      <Reveal index={0} style={styles.header}>
        <InstrumentTile id={id} size={56} />
        <View style={{ flex: 1 }}>
          <Title>{instrument?.name ?? ''}</Title>
          <Subtitle>Escolha um exercício para praticar.</Subtitle>
        </View>
      </Reveal>

      {isLoading ? <ActivityIndicator color={colors.primarySoft} /> : null}
      {isError ? <ErrorText>Não foi possível carregar os exercícios.</ErrorText> : null}

      <View style={{ gap: spacing.sm }}>
        {exercises?.map((exercise, index) => (
          <Reveal key={exercise.id} index={index + 1}>
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.98 }] }]}
              onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } })}
            >
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={styles.cardTitle}>{exercise.title}</Text>
                <View style={styles.meta}>
                  <Dots level={exercise.difficulty} />
                  {exercise.recommended_bpm ? (
                    <Text style={styles.metaText}>{exercise.recommended_bpm} BPM</Text>
                  ) : null}
                  {exercise.duration_minutes ? (
                    <Text style={styles.metaText}>{exercise.duration_minutes} min</Text>
                  ) : null}
                </View>
              </View>
              <Icon name="chevron-forward" size={20} color={colors.textDim} />
            </Pressable>
          </Reveal>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.bodySemi },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  metaText: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
});
