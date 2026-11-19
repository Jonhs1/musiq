import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../../components/BackButton';
import { Button, Card, Chip, ErrorText, Screen, SectionLabel, Subtitle, TextField, Title } from '../../components/ui';
import { type Exercise, useExercise } from '../../features/exercises/api';
import { ExercisePicker } from '../../features/training/ExercisePicker';
import { friendlyError, useCreateGoal } from '../../features/training/api';
import { colors, fonts, spacing } from '../../lib/theme';

type Kind = 'bpm' | 'consistency';

export default function GoalForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ exerciseId?: string }>();
  const presetId = typeof params.exerciseId === 'string' ? params.exerciseId : undefined;
  const preset = useExercise(presetId ?? '', !!presetId);
  const create = useCreateGoal();

  const [kind, setKind] = useState<Kind>('bpm');
  const [picked, setPicked] = useState<Exercise | null>(null);
  const [changing, setChanging] = useState(!presetId);
  // null = ainda não editado: usa a sugestão do exercício
  const [startText, setStartText] = useState<string | null>(null);
  const [targetText, setTargetText] = useState<string | null>(null);
  const [days, setDays] = useState(3);
  const [localError, setLocalError] = useState<string | null>(null);

  const exercise: Exercise | null = picked ?? preset.data ?? null;
  const suggestedStart = exercise?.recommended_bpm ?? null;
  const startValue = startText ?? (suggestedStart !== null ? String(suggestedStart) : '');
  const targetValue = targetText ?? (suggestedStart !== null ? String(suggestedStart + 30) : '');

  function pick(next: Exercise) {
    setPicked(next);
    setChanging(false);
    setStartText(null);
    setTargetText(null);
    setLocalError(null);
  }

  function submit() {
    if (!exercise) return;
    setLocalError(null);
    if (kind === 'bpm') {
      const start = Number(startValue);
      const target = Number(targetValue);
      const valid =
        Number.isInteger(start) &&
        Number.isInteger(target) &&
        start >= 20 &&
        start <= 400 &&
        target >= 20 &&
        target <= 400 &&
        target > start;
      if (!valid) {
        setLocalError('Início e alvo entre 20 e 400, com o alvo maior que o início.');
        return;
      }
      create.mutate(
        { exerciseId: exercise.id, kind: 'bpm', startBpm: start, targetBpm: target },
        { onSuccess: () => router.back() },
      );
      return;
    }
    create.mutate(
      { exerciseId: exercise.id, kind: 'consistency', daysPerWeek: days },
      { onSuccess: () => router.back() },
    );
  }

  const errorText = localError ?? (create.isError ? friendlyError(create.error) : null);

  return (
    <Screen>
      <BackButton />
      <Title>Nova meta</Title>
      <Subtitle>Escolha o tipo, o exercício e os números. O progresso sai sozinho das suas sessões.</Subtitle>

      <SectionLabel>Tipo</SectionLabel>
      <View style={styles.row}>
        <Chip label="Velocidade (BPM)" active={kind === 'bpm'} onPress={() => setKind('bpm')} />
        <Chip label="Constância" active={kind === 'consistency'} onPress={() => setKind('consistency')} />
      </View>

      <SectionLabel>Exercício</SectionLabel>
      {exercise && !changing ? (
        <Card>
          <Text style={styles.exerciseTitle}>{exercise.title}</Text>
          <Button title="Trocar exercício" variant="ghost" onPress={() => setChanging(true)} />
        </Card>
      ) : (
        <ExercisePicker onPick={pick} onlyWithBpm={kind === 'bpm'} />
      )}

      {exercise && !changing ? (
        <Card>
          {kind === 'bpm' ? (
            <View style={{ gap: spacing.md }}>
              <TextField
                label="BPM atual"
                keyboardType="number-pad"
                value={startValue}
                onChangeText={setStartText}
                maxLength={3}
              />
              <TextField
                label="BPM alvo"
                keyboardType="number-pad"
                value={targetValue}
                onChangeText={setTargetText}
                maxLength={3}
              />
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.label}>Dias por semana</Text>
              <View style={styles.row}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <Chip key={n} label={String(n)} active={days === n} onPress={() => setDays(n)} />
                ))}
              </View>
            </View>
          )}
        </Card>
      ) : null}

      <ErrorText>{errorText}</ErrorText>
      <Button
        title="Criar meta"
        onPress={submit}
        loading={create.isPending}
        disabled={!exercise || changing}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  exerciseTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.title },
  label: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
});
