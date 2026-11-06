import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { Dots } from '../../components/Dots';
import { Icon, InstrumentIcon } from '../../components/Icon';
import { colors, fonts, radius, spacing } from '../../lib/theme';
import { useToggleLike, CommunityExercise } from './api';

const VISIBILITY_LABEL = { private: 'Privado', friends: 'Só amigos', public: 'Público' } as const;

export function ExerciseCard({
  exercise,
  instrumentName,
  onPress,
}: {
  exercise: CommunityExercise;
  instrumentName?: string;
  onPress: () => void;
}) {
  const like = useToggleLike();
  const liked = exercise.liked_by_me;

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.985 }] }]} onPress={onPress}>
      <View style={styles.top}>
        <View style={styles.instrument}>
          <InstrumentIcon id={exercise.instrument_id} size={14} />
          <Text style={styles.instrumentText}>{instrumentName ?? exercise.instrument_id}</Text>
        </View>
        {exercise.visibility !== 'public' ? (
          <View style={styles.badge}>
            <Icon name={exercise.visibility === 'private' ? 'lock-closed' : 'people'} size={11} color={colors.textMuted} />
            <Text style={styles.badgeText}>{VISIBILITY_LABEL[exercise.visibility]}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {exercise.title}
      </Text>

      <View style={styles.meta}>
        <Dots level={exercise.difficulty} />
        {exercise.recommended_bpm ? <Text style={styles.metaText}>{exercise.recommended_bpm} BPM</Text> : null}
        {exercise.duration_minutes ? <Text style={styles.metaText}>{exercise.duration_minutes} min</Text> : null}
      </View>

      <View style={styles.bottom}>
        <View style={styles.creator}>
          <Avatar uri={exercise.creator_avatar_url} name={exercise.creator_nickname} size={24} />
          <Text style={styles.creatorText} numberOfLines={1}>
            {exercise.creator_nickname ?? 'Alguém'}
          </Text>
        </View>
        <Pressable
          hitSlop={10}
          onPress={() => like.mutate(exercise)}
          style={({ pressed }) => [styles.like, pressed && { opacity: 0.7 }]}
        >
          <Icon name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? colors.magenta : colors.textMuted} />
          <Text style={[styles.likeText, liked && { color: colors.magenta }]}>{exercise.likes_count}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  instrument: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
  },
  instrumentText: { color: colors.primarySoft, fontSize: 12, fontFamily: fonts.bodySemi },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeText: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.bodyMedium },
  title: { color: colors.text, fontSize: 17, lineHeight: 23, fontFamily: fonts.title },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  metaText: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  creator: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  creatorText: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.bodyMedium, flexShrink: 1 },
  like: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: spacing.sm },
  likeText: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.bodySemi, minWidth: 14 },
});