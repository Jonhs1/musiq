import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { InstrumentTile } from '../../components/Icon';
import { Chip, ErrorText } from '../../components/ui';
import { colors, fonts, radius, spacing } from '../../lib/theme';
import { type Exercise, useExercises } from '../exercises/api';
import { useMyInstruments } from '../profile/api';

// Escolhe um instrumento (dos que o usuário toca) e lista os exercícios dele.
export function ExercisePicker({
  onPick,
  onlyWithBpm = false,
  excludeIds = [],
}: {
  onPick: (exercise: Exercise) => void;
  onlyWithBpm?: boolean;
  excludeIds?: string[];
}) {
  const { data: mine, isLoading: loadingInstruments } = useMyInstruments();
  const [chosen, setChosen] = useState<string | null>(null);
  const instrumentId = chosen ?? mine?.[0]?.instrument_id ?? '';
  const { data: exercises, isLoading, isError } = useExercises(instrumentId);

  const list = (exercises ?? []).filter(
    (exercise) => (!onlyWithBpm || exercise.recommended_bpm !== null) && !excludeIds.includes(exercise.id),
  );

  if (loadingInstruments) return <ActivityIndicator color={colors.primarySoft} />;

  return (
    <View style={{ gap: spacing.sm }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {(mine ?? []).map((item) => (
          <Chip
            key={item.instrument_id}
            label={item.instruments.name}
            active={item.instrument_id === instrumentId}
            onPress={() => setChosen(item.instrument_id)}
          />
        ))}
      </ScrollView>

      {isLoading ? <ActivityIndicator color={colors.primarySoft} /> : null}
      {isError ? <ErrorText>Não foi possível carregar os exercícios.</ErrorText> : null}
      {!isLoading && !isError && list.length === 0 ? (
        <Text style={styles.empty}>
          {onlyWithBpm ? 'Nenhum exercício com BPM recomendado neste instrumento.' : 'Nenhum exercício aqui.'}
        </Text>
      ) : null}

      {list.map((exercise) => (
        <Pressable
          key={exercise.id}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          onPress={() => onPick(exercise)}
        >
          <InstrumentTile id={exercise.instrument_id} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{exercise.title}</Text>
            <Text style={styles.meta}>
              nível {exercise.difficulty}
              {exercise.duration_minutes ? ` · ${exercise.duration_minutes} min` : ''}
              {exercise.recommended_bpm ? ` · ${exercise.recommended_bpm} BPM` : ''}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { gap: spacing.sm, paddingVertical: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 15, fontFamily: fonts.bodySemi },
  meta: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body },
  empty: { color: colors.textDim, fontSize: 14, fontFamily: fonts.body },
});
