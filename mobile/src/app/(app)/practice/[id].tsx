import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, ErrorText, Screen } from '../../../components/ui';
import { useExercise } from '../../../features/exercises/api';
import { MetronomePanel, MetronomePanelHandle } from '../../../features/metronome/MetronomePanel';
import { useAuth } from '../../../lib/auth';
import { formatDuration } from '../../../lib/format';
import { enqueueSession, syncPendingSessions } from '../../../lib/pendingSessions';
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

    const metronome = useRef<MetronomePanelHandle>(null);
    const metronomeWasRunning = useRef(false);

    const startedAt = useRef(new Date().toISOString());
    const accumulatedMs = useRef(0);
    const resumedAt = useRef<number | null>(Date.now());
    const [running, setRunning] = useState(true);
    const [elapsedMs, setElapsedMs] = useState(0);

    const [initialBpm, setInitialBpm] = useState<number | null>(null);
    const bpmStart = useRef<number | null>(null);
    const bpmMax = useRef<number>(0);
    const metronomeUsed = useRef(false);

    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Define o BPM inicial quando o exercício carrega
    useEffect(() => {
        if (exercise && initialBpm === null) {
            const initial = clampBpm(exercise.recommended_bpm ?? 60);
            setInitialBpm(initial);
            bpmStart.current = initial;
            bpmMax.current = initial;
        }
    }, [exercise, initialBpm]);

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
        metronomeWasRunning.current = metronome.current?.stop() ?? false;
        setElapsedMs(accumulatedMs.current);
        setRunning(false);
    }

    function resume() {
        resumedAt.current = Date.now();
        setRunning(true);
        if (metronomeWasRunning.current) {
            metronomeWasRunning.current = false;
            metronome.current?.resume();
        }
    }

    // O primeiro BPM em que o metrônomo toca vira o BPM inicial da sessão
    function handleMetronomeStart(bpm: number) {
        if (!metronomeUsed.current) {
            metronomeUsed.current = true;
            bpmStart.current = clampBpm(bpm);
        }
        bpmMax.current = Math.max(bpmMax.current, clampBpm(bpm));
    }

    function handleBpm(bpm: number) {
        bpmMax.current = Math.max(bpmMax.current, clampBpm(bpm));
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
            const userId = session.user.id;
            const sessionId = Crypto.randomUUID();

            // 1. Guarda no aparelho (nunca se perde)  2. Tenta enviar agora, com limite de tempo
            await enqueueSession({
                id: sessionId,
                user_id: userId,
                instrument_id: exercise.instrument_id,
                exercise_id: exercise.id,
                started_at: startedAt.current,
                duration_seconds: seconds,
                bpm_start: bpmStart.current ?? 60,
                bpm_max: bpmMax.current || (bpmStart.current ?? 60),
                notes: notes.trim() || null,
            });

            const syncResult = await Promise.race([
                syncPendingSessions(userId),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
            ]);
            const xpById = syncResult?.xpById ?? {};

            // Sem await: se estiver offline, a atualização espera a internet voltar
            queryClient.invalidateQueries({ queryKey: ['profile', userId] });

            const xp = xpById[sessionId];
            const sent = xp !== undefined;
            Alert.alert(
                sent ? 'Sessão salva!' : 'Sessão guardada!',
                sent
                    ? `${formatDuration(seconds)} praticados · +${xp} XP`
                    : `${formatDuration(seconds)} praticados. Sem conexão agora: a sessão será enviada automaticamente quando você estiver online.`,
                [{ text: 'OK', onPress: () => router.dismissAll() }],
            );
        } catch (e) {
            console.warn('finish error:', e);
            setError(`Não foi possível guardar a sessão: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setSaving(false);
        }
    }

    if (!exercise || initialBpm === null) {
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

            <MetronomePanel
                ref={metronome}
                initialBpm={initialBpm}
                onStart={handleMetronomeStart}
                onBpm={handleBpm}
            />

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

const styles = StyleSheet.create({
    exerciseTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: spacing.md },
    timerBox: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.xs },
    timer: { color: colors.primary, fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'] },
    timerHint: { color: colors.textMuted, fontSize: 13 },
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