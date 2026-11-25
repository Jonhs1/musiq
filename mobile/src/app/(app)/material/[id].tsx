import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../../../components/BackButton';
import { Button, Card, ErrorText, Reveal, Screen, SectionLabel, Subtitle, Title } from '../../../components/ui';
import { friendlyImportError, useAddRoutineToToday, useDeleteMaterial, useMaterial } from '../../../features/materials/api';
import { friendlyError, useCreateGoal } from '../../../features/training/api';
import { colors, fonts, spacing } from '../../../lib/theme';

export default function MaterialScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const materialId = String(id ?? '');
  const { data, isLoading, isError } = useMaterial(materialId);
  const addRoutine = useAddRoutineToToday();
  const remove = useDeleteMaterial();
  const createGoal = useCreateGoal();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Screen>
        <BackButton />
        <ActivityIndicator color={colors.primarySoft} />
      </Screen>
    );
  }
  if (isError || !data) {
    return (
      <Screen>
        <BackButton />
        <ErrorText>Não foi possível abrir este material.</ErrorText>
      </Screen>
    );
  }

  const { material, exercises } = data;
  const routine = material.routine as { titulo: string | null; duracao_total_minutos: number | null; ordem: string[] } | null;

  function addRoutineToday() {
    setNotice(null);
    addRoutine.mutate(materialId, {
      onSuccess: (added) => setNotice(added === 0 ? 'Nada novo para adicionar hoje.' : `${added} exercícios adicionados ao Hoje.`),
    });
  }

  function createRangeGoal(exerciseId: string, min: number, max: number) {
    setNotice(null);
    createGoal.mutate(
      { exerciseId, kind: 'bpm', startBpm: min, targetBpm: max },
      { onSuccess: () => setNotice(`Meta ${min}→${max} BPM criada.`), onError: (e) => setNotice(friendlyError(e)) },
    );
  }

  function confirmDelete() {
    Alert.alert(
      'Excluir material?',
      'Os exercícios e metas desse material serão apagados. O histórico de prática fica, sem o vínculo com o exercício.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => remove.mutate(materialId, { onSuccess: () => router.replace('/plan') }),
        },
      ],
    );
  }

  return (
    <Screen>
      <BackButton />
      <Reveal index={0}>
        <Title>{material.title}</Title>
        <Subtitle>{material.level ?? 'Material importado'}</Subtitle>
      </Reveal>

      {routine ? (
        <Reveal index={1}>
          <SectionLabel>Rotina</SectionLabel>
          <Card>
            <Text style={styles.strong}>{routine.titulo ?? 'Rotina'}</Text>
            {routine.duracao_total_minutos ? (
              <Text style={styles.meta}>{routine.duracao_total_minutos} min no total</Text>
            ) : null}
            {routine.ordem.map((nome, i) => (
              <Text key={`${nome}-${i}`} style={styles.meta}>
                {i + 1}. {nome}
              </Text>
            ))}
            <Button title="Adicionar rotina ao Hoje" variant="soft" onPress={addRoutineToday} loading={addRoutine.isPending} />
          </Card>
        </Reveal>
      ) : null}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {addRoutine.isError ? <ErrorText>{friendlyImportError(addRoutine.error)}</ErrorText> : null}

      <Reveal index={2}>
        <SectionLabel>Exercícios</SectionLabel>
        {exercises.map((e) => {
          const range = e.bpm_range_min && e.bpm_range_max ? `${e.bpm_range_min}–${e.bpm_range_max} BPM` : null;
          return (
            <Card key={e.id}>
              <Pressable onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: e.id } })}>
                <Text style={styles.strong}>{e.title}</Text>
                <Text style={styles.meta}>
                  {[range ?? (e.recommended_bpm ? `${e.recommended_bpm} BPM` : null), e.duration_minutes ? `${e.duration_minutes} min` : null, e.source_page ? `p. ${e.source_page}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </Pressable>
              {e.bpm_range_min && e.bpm_range_max ? (
                <Button
                  title="Criar meta pela faixa"
                  variant="ghost"
                  onPress={() => createRangeGoal(e.id, e.bpm_range_min as number, e.bpm_range_max as number)}
                />
              ) : null}
            </Card>
          );
        })}
      </Reveal>

      <Card>
        <Button
          title={rulesOpen ? 'Ocultar regras da apostila' : 'Ver regras da apostila'}
          variant="ghost"
          onPress={() => setRulesOpen((v) => !v)}
        />
        {rulesOpen
          ? (material.general_rules as { texto: string }[]).map((r, i) => (
              <Text key={i} style={styles.meta}>
                • {r.texto}
              </Text>
            ))
          : null}
      </Card>

      <Button title="Excluir material" variant="danger" onPress={confirmDelete} loading={remove.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  strong: { color: colors.text, fontSize: 15, fontFamily: fonts.bodySemi },
  meta: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
  notice: { color: colors.primarySoft, fontSize: 14, fontFamily: fonts.bodySemi, paddingHorizontal: spacing.xs },
});
