import { ReactNode } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { BackButton } from '../../../components/BackButton';
import { Dots } from '../../../components/Dots';
import { Icon } from '../../../components/Icon';
import { Button, Card, Reveal, Screen, SectionLabel, Title } from '../../../components/ui';
import {
  exerciseErrorMessage,
  useDeleteExercise,
  useReportExercise,
  useToggleFavorite,
  useToggleLike,
} from '../../../features/community/api';
import { useExercise } from '../../../features/exercises/api';
import { useAuth } from '../../../lib/auth';
import { DIFFICULTY_LABELS } from '../../../lib/format';
import { colors, fonts, radius, spacing } from '../../../lib/theme';

const VISIBILITY_LABEL = { private: 'Privado', friends: 'Só amigos', public: 'Público' } as const;

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { data: exercise, isLoading, isError, error } = useExercise(id);
  const like = useToggleLike();
  const favorite = useToggleFavorite();
  const report = useReportExercise();
  const remove = useDeleteExercise();

  if (isLoading) {
    return (
      <Screen>
        <BackButton />
        <ActivityIndicator color={colors.primarySoft} />
      </Screen>
    );
  }

  if (isError || !exercise) {
    const gone = error instanceof Error && error.message === 'not_found';
    return (
      <Screen>
        <BackButton />
        <Card>
          <Text style={styles.blockText}>
            {gone ? 'Este exercício não está mais disponível.' : 'Não foi possível carregar o exercício. Verifique a conexão.'}
          </Text>
        </Card>
        <Button title="Voltar" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const isCommunity = exercise.created_by !== null;
  const mine = isCommunity && exercise.created_by === session?.user.id;

  function confirmReport() {
    Alert.alert('Denunciar exercício?', 'Use para conteúdo ofensivo, spam ou fora do tema. Exercícios muito denunciados saem da Comunidade.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Denunciar',
        style: 'destructive',
        onPress: () =>
          report.mutate(
            { id: exercise!.id },
            {
              onSuccess: () => Alert.alert('Obrigado', 'Recebemos a sua denúncia.'),
              onError: (e) => Alert.alert('Não foi possível denunciar', exerciseErrorMessage(e)),
            },
          ),
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert('Apagar exercício?', 'Ele sai da Comunidade e do seu plano. O seu histórico de práticas continua.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () =>
          remove.mutate(exercise!.id, {
            onSuccess: () => router.back(),
            onError: (e) => Alert.alert('Não foi possível apagar', exerciseErrorMessage(e)),
          }),
      },
    ]);
  }

  return (
    <Screen>
      <BackButton />
      <Reveal index={0}>
        <Title>{exercise.title}</Title>
      </Reveal>

      {isCommunity ? (
        <Reveal index={0} style={styles.creatorRow}>
          <Avatar uri={exercise.creator_avatar_url} name={exercise.creator_nickname} size={30} />
          <Text style={styles.creatorText} numberOfLines={1}>
            por {mine ? 'você' : (exercise.creator_nickname ?? 'alguém')}
          </Text>
          {exercise.visibility !== 'public' ? (
            <View style={styles.badge}>
              <Icon name={exercise.visibility === 'private' ? 'lock-closed' : 'people'} size={12} color={colors.textMuted} />
              <Text style={styles.badgeText}>{VISIBILITY_LABEL[exercise.visibility]}</Text>
            </View>
          ) : null}
        </Reveal>
      ) : null}

      <Reveal index={1} style={styles.stats}>
        <Stat label="Dificuldade" value={DIFFICULTY_LABELS[exercise.difficulty]}>
          <Dots level={exercise.difficulty} />
        </Stat>
        <Stat label="BPM sugerido" value={exercise.recommended_bpm ? String(exercise.recommended_bpm) : '—'} />
        <Stat label="Duração" value={exercise.duration_minutes ? `${exercise.duration_minutes} min` : '—'} />
      </Reveal>

      {isCommunity ? (
        <Reveal index={2} style={styles.actions}>
          <Action
            icon={exercise.liked_by_me ? 'heart' : 'heart-outline'}
            label={String(exercise.likes_count)}
            active={exercise.liked_by_me}
            activeColor={colors.magenta}
            onPress={() => like.mutate(exercise)}
          />
          <Action
            icon={exercise.favorited_by_me ? 'star' : 'star-outline'}
            label={exercise.favorited_by_me ? 'Favoritado' : 'Favoritar'}
            active={exercise.favorited_by_me}
            activeColor={colors.gold}
            onPress={() => favorite.mutate(exercise)}
          />
          {mine ? (
            <>
              <Action
                icon="create-outline"
                label="Editar"
                onPress={() => router.push({ pathname: '/exercise-form', params: { id: exercise.id } })}
              />
              <Action icon="trash-outline" label="Apagar" danger onPress={confirmDelete} />
            </>
          ) : (
            <Action icon="flag-outline" label="Denunciar" onPress={confirmReport} />
          )}
        </Reveal>
      ) : null}

      {exercise.objective ? (
        <Reveal index={3}>
          <Card>
            <SectionLabel>Objetivo</SectionLabel>
            <Text style={styles.blockText}>{exercise.objective}</Text>
          </Card>
        </Reveal>
      ) : null}

      {exercise.description ? (
        <Reveal index={4}>
          <Card>
            <SectionLabel>Como praticar</SectionLabel>
            <Text style={styles.blockText}>{exercise.description}</Text>
          </Card>
        </Reveal>
      ) : null}

      <Reveal index={5} style={{ marginTop: spacing.sm }}>
        <Button
          title="Iniciar prática"
          icon="play"
          onPress={() => router.push({ pathname: '/practice/[id]', params: { id: exercise.id } })}
        />
      </Reveal>
    </Screen>
  );
}

function Action({
  icon,
  label,
  onPress,
  active,
  activeColor,
  danger,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  onPress: () => void;
  active?: boolean;
  activeColor?: string;
  danger?: boolean;
}) {
  const color = danger ? colors.danger : active ? (activeColor ?? colors.primarySoft) : colors.textMuted;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={20} color={color} />
      <Text style={[styles.actionText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
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
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  creatorText: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.bodyMedium, flexShrink: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  badgeText: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.bodyMedium },
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
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: { fontSize: 12, fontFamily: fonts.bodyMedium },
  blockText: { color: colors.text, fontSize: 15, lineHeight: 23, fontFamily: fonts.body },
});