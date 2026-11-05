import { useQueryClient } from '@tanstack/react-query';
import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, ErrorText, Screen } from '../../../components/ui';
import { saveSession, useExercise } from '../../../features/exercises/api';
import { useAuth } from '../../../lib/auth';
import { formatDuration } from '../../../lib/format';
import { colors, radius, spacing } from '../../../lib/theme';

const MIN_BPM = 20;
const MAX_BPM = 400;
const clampBpm = (value: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, value));

export default function Practice() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { data: exercise } = useExercise(id);

  const startedAt = useRef(new Date().toISOString());
  const accumulatedMs = useRef(0);
  const resumedAt = useRef<number | null>(Date.now());
  const [running, setRunning] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);

  const [bpm, setBpm] = useState<number | null>(null);
  const bpmStart = useRef<number | null>(null);
  const bpmMax = useRef<number>(0);

  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Define o BPM inicial quando o exercício carrega
  useEffect(() => {
    if (exercise && bpm === null) {
      const initial = clampBpm(exercise.recommended_bpm ?? 60);
      setBpm(initial);
      bpmStart.current = initial;
      bpmMax.current = initial;
    }
  }, [exercise, bpm]);

  // Cronômetro baseado em relógio (não acumula erro)
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setElapsedMs(accumulatedMs.current + (Date.now() - (resumedAt.current ?? Date.now())));
    }, 250);
    return () => clearInterval(timer);
  }, [running]);

  function totalMs() {
    return accumulatedMs.current + (resumedAt.current ? Date.now() - resumedAt.current : 0);
  }

  function pause() {
    if (resumedAt.current) {
      accumulatedMs.current += Date.now() - resumedAt.current;
      resumedAt.current = null;
    }
    setElapsedMs(accumulatedMs.current);
    setRunning(false);
  }

  function resume() {
    resumedAt.current = Date.now();
    setRunning(true);
  }

  function changeBpm(delta: number) {
    setBpm((current) => {
      const next = clampBpm((current ?? 60) + delta);
      bpmMax.current = Math.max(bpmMax.current, next);
      return next;
    });
  }

  function cancel() {
    Alert.alert('Descartar prática?', 'O tempo desta sessão não será registrado.', [
      { text: 'Continuar praticando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  async function finish() {
    if (!exercise || !session) return;
    const seconds = Math.floor(totalMs() / 1000);
    if (seconds < 10) {
      Alert.alert('Sessão muito curta', 'Pratique pelo menos 10 segundos para registrar.');
      return;
    }
    pause();
    setSaving(true);
    setError(null);
    try {
      const xp = await saveSession({
        userId: session.user.id,
        instrumentId: exercise.instrument_id,
        exerciseId: exercise.id,
        startedAt: startedAt.current,
        durationSeconds: seconds,
        bpmStart: bpmStart.current ?? 60,
        bpmMax: bpmMax.current || (bpmStart.current ?? 60),
        notes,
      });
      await queryClient.invalidateQueries({ queryKey: ['profile', session.user.id] });
      Alert.alert('Sessão salva!', `${formatDuration(seconds)} praticados · +${xp} XP`, [
        { text: 'OK', onPress: () => router.dismissAll() },
      ]);
    } catch (e) {
      console.warn('saveSession error:', e);
      setError(`Não foi possível salvar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  if (!exercise || bpm === null) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <Text style={styles.exerciseTitle}>{exercise.title}</Text>

      <View style={styles.timerBox}>
        <Text style={styles.timer}>{formatDuration(Math.floor(elapsedMs / 1000))}</Text>
        <Text style={styles.timerHint}>
          {running ? 'Praticando…' : 'Pausado'} · XP a cada 10 minutos completos
        </Text>
      </View>

      <View style={styles.bpmBox}>
        <Text style={styles.bpmLabel}>BPM de referência</Text>
        <View style={styles.bpmRow}>
          <BpmButton label="−5" onPress={() => changeBpm(-5)} />
          <BpmButton label="−1" onPress={() => changeBpm(-1)} />
          <Text style={styles.bpmValue}>{bpm}</Text>
          <BpmButton label="+1" onPress={() => changeBpm(1)} />
          <BpmButton label="+5" onPress={() => changeBpm(5)} />
        </View>
        <Text style={styles.bpmHint}>
          Anote aqui a velocidade em que você está treinando. O clique do metrônomo chega em breve.
        </Text>
      </View>

      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Anotações da sessão (opcional)"
        placeholderTextColor={colors.textMuted}
        multiline
        style={styles.notes}
      />

      <ErrorText>{error}</ErrorText>

      <View style={{ gap: spacing.sm }}>
        <Button title="Finalizar e salvar" onPress={finish} loading={saving} />
        <Button
          title={running ? 'Pausar' : 'Retomar'}
          variant="ghost"
          onPress={running ? pause : resume}
          disabled={saving}
        />
        <Button title="Descartar" variant="ghost" onPress={cancel} disabled={saving} />
      </View>
    </Screen>
  );
}

function BpmButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.bpmButton, pressed && { opacity: 0.7 }]}>
      <Text style={styles.bpmButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  exerciseTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: spacing.md },
  timerBox: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.xs },
  timer: { color: colors.primary, fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timerHint: { color: colors.textMuted, fontSize: 13 },
  bpmBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  bpmLabel: { color: colors.textMuted, fontSize: 13 },
  bpmRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bpmValue: { color: colors.text, fontSize: 36, fontWeight: '800', minWidth: 80, textAlign: 'center' },
  bpmHint: { color: colors.textMuted, fontSize: 12 },
  bpmButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bpmButtonText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  notes: {
    minHeight: 90,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
    textAlignVertical: 'top',
  },
});