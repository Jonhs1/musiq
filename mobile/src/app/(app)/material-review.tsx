import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { BackButton } from '../../components/BackButton';
import { Button, Card, Chip, ErrorText, Screen, SectionLabel, Subtitle, TextField, Title } from '../../components/ui';
import { friendlyImportError, useSaveMaterial } from '../../features/materials/api';
import type { DraftExercise, MaterialDraft } from '../../features/materials/normalize';
import { useDraftStore } from '../../features/materials/draftStore';
import { useInstruments } from '../../features/profile/api';
import { colors, fonts, spacing } from '../../lib/theme';

function numberOrNull(text: string): number | null {
  if (text.trim() === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export default function MaterialReview() {
  const router = useRouter();
  const draft = useDraftStore((s) => s.draft);
  const update = useDraftStore((s) => s.update);
  const clear = useDraftStore((s) => s.clear);
  const { data: instruments } = useInstruments();
  const save = useSaveMaterial();
  const [rulesOpen, setRulesOpen] = useState(false);

  if (!draft) {
    return (
      <Screen>
        <BackButton />
        <Title>Nada para revisar</Title>
        <Subtitle>Envie um material primeiro.</Subtitle>
        <Button title="Importar material" onPress={() => router.replace('/material-import')} />
      </Screen>
    );
  }

  const setMaterial = (patch: Partial<MaterialDraft>) => update((d) => ({ ...d, ...patch }));
  const setExercise = (key: string, patch: Partial<DraftExercise>) =>
    update((d) => ({ ...d, exercises: d.exercises.map((e) => (e.key === key ? { ...e, ...patch } : e)) }));

  const included = draft.exercises.filter((e) => e.include).length;

  function onSave() {
    save.mutate(draft as MaterialDraft, {
      onSuccess: (saved) => {
        clear();
        router.replace({ pathname: '/material/[id]', params: { id: saved.material_id } });
      },
    });
  }

  function onDiscard() {
    Alert.alert('Descartar rascunho?', 'O que você revisou até agora será perdido.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: () => {
          clear();
          router.replace('/plan');
        },
      },
    ]);
  }

  return (
    <Screen>
      <BackButton />
      <Title>Revisar material</Title>
      <Subtitle>Confira e corrija antes de salvar. Nada é salvo até você tocar em "Salvar material".</Subtitle>

      <Card>
        <TextField label="Título do material" value={draft.title} onChangeText={(title) => setMaterial({ title })} />
        <SectionLabel>Instrumento</SectionLabel>
        <View style={styles.row}>
          {(instruments ?? []).map((i) => (
            <Chip
              key={i.id}
              label={i.name}
              active={draft.instrumentId === i.id}
              onPress={() => setMaterial({ instrumentId: i.id })}
            />
          ))}
        </View>
        {!draft.instrumentId ? <ErrorText>Escolha o instrumento para salvar.</ErrorText> : null}
        <TextField label="Nível" value={draft.level ?? ''} onChangeText={(level) => setMaterial({ level: level || null })} />
      </Card>

      <SectionLabel>Exercícios ({included} incluídos)</SectionLabel>
      {draft.exercises.map((e) => (
        <Card key={e.key} highlight={e.include}>
          <View style={styles.switchRow}>
            <Text style={styles.label}>Incluir</Text>
            <Switch value={e.include} onValueChange={(include) => setExercise(e.key, { include })} />
          </View>
          <TextField label="Título" value={e.title} onChangeText={(title) => setExercise(e.key, { title })} />
          <TextField
            label="Descrição"
            value={e.description}
            multiline
            onChangeText={(description) => setExercise(e.key, { description })}
          />
          <TextField label="Objetivo" value={e.objective} onChangeText={(objective) => setExercise(e.key, { objective })} />
          <TextField
            label="BPM recomendado"
            keyboardType="number-pad"
            value={e.recommendedBpm?.toString() ?? ''}
            onChangeText={(t) => setExercise(e.key, { recommendedBpm: numberOrNull(t) })}
          />
          <TextField
            label="Duração (min)"
            keyboardType="number-pad"
            value={e.durationMinutes?.toString() ?? ''}
            onChangeText={(t) => setExercise(e.key, { durationMinutes: numberOrNull(t) })}
          />
          <TextField label="Padrão" value={e.pattern} onChangeText={(pattern) => setExercise(e.key, { pattern })} />
          <Text style={styles.meta}>
            {e.sourcePages.length ? `p. ${e.sourcePages.join(', ')}` : 'Sem página indicada'}
          </Text>
          {e.dependsOnScore ? (
            <Text style={styles.warn}>A partitura não é lida pela IA; consulte a apostila.</Text>
          ) : null}
          {e.goalSuggestion ? (
            <View style={styles.switchRow}>
              <Text style={styles.label}>
                Criar meta {e.goalSuggestion.startBpm}→{e.goalSuggestion.targetBpm} BPM
              </Text>
              <Switch
                value={e.goalSuggestion.enabled}
                onValueChange={(enabled) =>
                  setExercise(e.key, { goalSuggestion: { ...e.goalSuggestion!, enabled } })
                }
              />
            </View>
          ) : null}
        </Card>
      ))}

      <Card>
        <Button
          title={rulesOpen ? 'Ocultar regras e rotina' : 'Ver regras e rotina'}
          variant="ghost"
          onPress={() => setRulesOpen((v) => !v)}
        />
        {rulesOpen ? (
          <View style={{ gap: spacing.sm }}>
            {draft.generalRules.map((r, i) => (
              <Text key={i} style={styles.meta}>
                • {r.texto}
              </Text>
            ))}
            {draft.routine ? (
              <Text style={styles.meta}>
                Rotina: {draft.routine.titulo ?? 'sem título'}
                {draft.routine.duracao_total_minutos ? ` · ${draft.routine.duracao_total_minutos} min` : ''}
                {draft.routine.ordem.length ? `\n${draft.routine.ordem.join(' → ')}` : ''}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Card>

      <ErrorText>{save.isError ? friendlyImportError(save.error) : null}</ErrorText>
      <Button
        title="Salvar material"
        onPress={onSave}
        loading={save.isPending}
        disabled={!draft.instrumentId || included === 0}
      />
      <Button title="Descartar" variant="danger" onPress={onDiscard} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  label: { color: colors.text, fontSize: 14, fontFamily: fonts.bodySemi, flex: 1 },
  meta: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
  warn: { color: colors.textDim, fontSize: 13, fontFamily: fonts.body },
});
