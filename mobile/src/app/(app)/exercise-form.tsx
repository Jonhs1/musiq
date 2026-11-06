import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../../components/BackButton';
import { Icon, InstrumentIcon } from '../../components/Icon';
import { Button, Chip, ErrorText, Reveal, SectionLabel, Screen, TextField, Title } from '../../components/ui';
import {
  exerciseErrorMessage,
  ExerciseInput,
  useCreateExercise,
  useUpdateExercise,
  Visibility,
} from '../../features/community/api';
import { useExercise } from '../../features/exercises/api';
import { useInstruments } from '../../features/profile/api';
import { DIFFICULTY_LABELS } from '../../lib/format';
import { colors, fonts, radius, spacing } from '../../lib/theme';

const VISIBILITY: { id: Visibility; title: string; text: string; icon: 'lock-closed' | 'people' | 'earth' }[] = [
  { id: 'private', title: 'Privado', text: 'Só você vê e pratica.', icon: 'lock-closed' },
  { id: 'friends', title: 'Só amigos', text: 'Você e seus amigos veem na Comunidade.', icon: 'people' },
  { id: 'public', title: 'Público', text: 'Todos os usuários veem na Comunidade.', icon: 'earth' },
];

function toNumber(text: string): number | null {
  const n = parseInt(text.replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export default function ExerciseForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const router = useRouter();
  const { data: instruments } = useInstruments();
  const { data: existing, isLoading: loadingExisting, isError: errorExisting } = useExercise(id ?? '', editing);
  const create = useCreateExercise();
  const update = useUpdateExercise(id ?? '');

  const [instrument, setInstrument] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [objective, setObjective] = useState('');
  const [difficulty, setDifficulty] = useState(2);
  const [bpm, setBpm] = useState('');
  const [duration, setDuration] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('friends');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Em edição, preenche o formulário uma vez com os dados atuais
  useEffect(() => {
    if (editing && existing && !loaded) {
      setInstrument(existing.instrument_id);
      setTitle(existing.title);
      setDescription(existing.description ?? '');
      setObjective(existing.objective ?? '');
      setDifficulty(existing.difficulty);
      setBpm(existing.recommended_bpm ? String(existing.recommended_bpm) : '');
      setDuration(existing.duration_minutes ? String(existing.duration_minutes) : '');
      setVisibility(existing.visibility);
      setLoaded(true);
    }
  }, [editing, existing, loaded]);

  const saving = create.isPending || update.isPending;

  function validate(): ExerciseInput | null {
    const cleanTitle = title.trim();
    if (!instrument) return fail('Escolha um instrumento.');
    if (cleanTitle.length < 3 || cleanTitle.length > 60) return fail('O título precisa ter de 3 a 60 caracteres.');
    if (description.length > 600) return fail('A descrição aceita até 600 caracteres.');
    if (objective.length > 200) return fail('O objetivo aceita até 200 caracteres.');
    const bpmValue = bpm.trim() ? toNumber(bpm) : null;
    if (bpmValue !== null && (bpmValue < 20 || bpmValue > 400)) return fail('O BPM deve ficar entre 20 e 400.');
    const durationValue = duration.trim() ? toNumber(duration) : null;
    if (durationValue !== null && (durationValue < 1 || durationValue > 120)) {
      return fail('A duração deve ficar entre 1 e 120 minutos.');
    }
    setError(null);
    return {
      instrument_id: instrument,
      title: cleanTitle,
      description: description.trim(),
      objective: objective.trim(),
      difficulty,
      recommended_bpm: bpmValue,
      duration_minutes: durationValue,
      visibility,
    };
  }

  function fail(message: string): null {
    setError(message);
    return null;
  }

  async function submit() {
    const input = validate();
    if (!input) return;
    try {
      if (editing) {
        await update.mutateAsync(input);
        router.back();
      } else {
        const created = await create.mutateAsync(input);
        router.replace({ pathname: '/exercise/[id]', params: { id: created.id } });
      }
    } catch (e) {
      setError(exerciseErrorMessage(e));
    }
  }

  if (editing && loadingExisting) {
    return (
      <Screen>
        <BackButton />
        <ActivityIndicator color={colors.primarySoft} />
      </Screen>
    );
  }

  if (editing && (errorExisting || !existing)) {
    return (
      <Screen>
        <BackButton />
        <ErrorText>Este exercício não está disponível para edição.</ErrorText>
        <Button title="Voltar" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackButton />
      <Reveal index={0}>
        <Title>{editing ? 'Editar exercício' : 'Criar exercício'}</Title>
      </Reveal>

      <Reveal index={1} style={{ gap: spacing.sm }}>
        <SectionLabel>Instrumento</SectionLabel>
        <View style={styles.wrap}>
          {instruments
            ?.filter((item) => !editing || item.id === instrument)
            .map((item) => (
              <Chip
                key={item.id}
                label={item.name}
                active={instrument === item.id}
                onPress={() => {
                  if (!editing) setInstrument(item.id);
                }}
                icon={
                  <InstrumentIcon id={item.id} size={16} color={instrument === item.id ? colors.primarySoft : colors.textMuted} />
                }
              />
            ))}
        </View>
        {editing ? <Text style={styles.hint}>O instrumento não pode ser alterado depois de criado.</Text> : null}
      </Reveal>

      <Reveal index={2} style={{ gap: spacing.md }}>
        <TextField label="Título" value={title} onChangeText={setTitle} maxLength={60} placeholder="Ex.: Groove de funk em 16 notas" />
        <TextField
          label="Como praticar (opcional)"
          value={description}
          onChangeText={setDescription}
          maxLength={600}
          multiline
          placeholder="Explique o passo a passo do exercício."
          style={styles.multiline}
        />
        <TextField
          label="Objetivo (opcional)"
          value={objective}
          onChangeText={setObjective}
          maxLength={200}
          placeholder="O que o exercício desenvolve?"
        />
      </Reveal>

      <Reveal index={3} style={{ gap: spacing.sm }}>
        <SectionLabel>Dificuldade</SectionLabel>
        <View style={styles.wrap}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Chip key={n} label={`${n} · ${DIFFICULTY_LABELS[n]}`} active={difficulty === n} onPress={() => setDifficulty(n)} />
          ))}
        </View>
      </Reveal>

      <Reveal index={4} style={styles.row}>
        <View style={{ flex: 1 }}>
          <TextField label="BPM (opcional)" value={bpm} onChangeText={setBpm} keyboardType="number-pad" maxLength={3} placeholder="Ex.: 80" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Minutos (opcional)" value={duration} onChangeText={setDuration} keyboardType="number-pad" maxLength={3} placeholder="Ex.: 10" />
        </View>
      </Reveal>

      <Reveal index={5} style={{ gap: spacing.sm }}>
        <SectionLabel>Quem pode ver</SectionLabel>
        {VISIBILITY.map((item) => {
          const active = visibility === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setVisibility(item.id)}
              style={[styles.option, active && styles.optionActive]}
            >
              <Icon name={item.icon} size={20} color={active ? colors.primarySoft : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, active && { color: colors.primarySoft }]}>{item.title}</Text>
                <Text style={styles.optionText}>{item.text}</Text>
              </View>
              {active ? <Icon name="checkmark-circle" size={20} color={colors.primarySoft} /> : null}
            </Pressable>
          );
        })}
      </Reveal>

      <ErrorText>{error}</ErrorText>

      <Reveal index={6} style={{ marginTop: spacing.sm }}>
        <Button title={editing ? 'Salvar alterações' : 'Publicar exercício'} icon="checkmark" onPress={submit} loading={saving} />
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
  row: { flexDirection: 'row', gap: spacing.md },
  multiline: { height: 120, paddingTop: spacing.md, textAlignVertical: 'top' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  optionTitle: { color: colors.text, fontSize: 15, fontFamily: fonts.bodySemi },
  optionText: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
});