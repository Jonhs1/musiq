import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { BackButton } from '../../../components/BackButton';
import { Icon, InstrumentTile } from '../../../components/Icon';
import { Button, Card, ErrorText, ProgressBar, Reveal, Screen, SectionLabel } from '../../../components/ui';
import { friendlyError, useFriendProfile, useRemoveFriendship } from '../../../features/friends/api';
import { levelProgress, levelTitle } from '../../../lib/level';
import { colors, fonts, radius, spacing } from '../../../lib/theme';

const LEVEL_LABELS = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
} as const;

function formatTotalTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}

export default function FriendProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: profile, isLoading, isError, error } = useFriendProfile(id);
  const remove = useRemoveFriendship();

  if (isLoading) {
    return (
      <Screen>
        <BackButton />
        <ActivityIndicator color={colors.primarySoft} />
      </Screen>
    );
  }

  if (isError || !profile) {
    return (
      <Screen>
        <BackButton />
        <ErrorText>{friendlyError(error)}</ErrorText>
      </Screen>
    );
  }

  const progress = levelProgress(profile.xp);

  function confirmRemove() {
    Alert.alert(
      `Desfazer amizade com ${profile!.nickname}?`,
      'Vocês deixam de aparecer no ranking um do outro. Dá para adicionar de novo depois.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desfazer',
          style: 'destructive',
          onPress: () => remove.mutate(profile!.id, { onSuccess: () => router.back() }),
        },
      ],
    );
  }

  return (
    <Screen>
      <BackButton />

      <Reveal index={0} style={styles.header}>
        <Avatar uri={profile.avatar_url} name={profile.nickname} size={96} ring />
        <Text style={styles.nickname}>{profile.nickname}</Text>
        {profile.full_name ? <Text style={styles.muted}>{profile.full_name}</Text> : null}
        {profile.friends_since ? (
          <Text style={styles.muted}>
            Amigos desde {new Date(profile.friends_since).toLocaleDateString('pt-BR')}
          </Text>
        ) : null}
      </Reveal>

      <Reveal index={1}>
        <Card highlight>
          <View style={styles.rowBetween}>
            <Text style={styles.levelTitle}>
              Nível {progress.level} · {levelTitle(progress.level)}
            </Text>
            <Text style={styles.muted}>
              {profile.xp} / {progress.next} XP
            </Text>
          </View>
          <ProgressBar ratio={progress.ratio} height={10} />
        </Card>
      </Reveal>

      <Reveal index={2} style={styles.stats}>
        <Stat icon="flame" color={colors.magenta} value={`${profile.streak_days} dias`} label="Sequência" />
        <Stat
          icon="time-outline"
          color={colors.primarySoft}
          value={formatTotalTime(profile.total_practice_seconds)}
          label="Praticado"
        />
        <Stat icon="ribbon" color={colors.gold} value={String(profile.achievements.length)} label="Conquistas" />
      </Reveal>

      <Reveal index={3}>
        <SectionLabel>Instrumentos</SectionLabel>
      </Reveal>
      <View style={{ gap: spacing.sm }}>
        {profile.instruments.map((item, index) => (
          <Reveal key={item.instrument_id} index={4 + index}>
            <View style={styles.instrument}>
              <InstrumentTile id={item.instrument_id} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={styles.instrumentName}>{item.name}</Text>
                <Text style={styles.muted}>
                  {LEVEL_LABELS[item.experience_level]} · {item.xp} XP
                </Text>
              </View>
              {item.is_primary ? <Icon name="star" size={16} color={colors.primarySoft} /> : null}
            </View>
          </Reveal>
        ))}
      </View>

      {profile.achievements.length > 0 ? (
        <>
          <SectionLabel>Conquistas</SectionLabel>
          <View style={{ gap: spacing.sm }}>
            {profile.achievements.slice(0, 6).map((item) => (
              <View key={item.achievement_id} style={styles.instrument}>
                <Icon name="medal" size={22} color={colors.gold} />
                <Text style={[styles.instrumentName, { flex: 1 }]}>{item.name}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <View style={{ marginTop: spacing.lg }}>
        <Button title="Desfazer amizade" variant="danger" onPress={confirmRemove} loading={remove.isPending} />
      </View>
    </Screen>
  );
}

function Stat({
  icon,
  color,
  value,
  label,
}: {
  icon: 'flame' | 'time-outline' | 'ribbon';
  color: string;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={20} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 4 },
  nickname: { color: colors.text, fontSize: 28, lineHeight: 34, fontFamily: fonts.titleBold, marginTop: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.title },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { color: colors.text, fontSize: 15, fontFamily: fonts.titleBold },
  instrument: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  instrumentName: { color: colors.text, fontSize: 15, fontFamily: fonts.bodySemi },
});