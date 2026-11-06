import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { Icon, InstrumentTile } from '../../../components/Icon';
import { Button, Card, IconButton, ProgressBar, Reveal, Screen, SectionLabel } from '../../../components/ui';
import { useAchievements, useUnlockedAchievements } from '../../../features/achievements/api';
import { unregisterPush } from '../../../features/notifications/usePushNotifications';
import { useMyInstruments, useProfile } from '../../../features/profile/api';
import { levelProgress, levelTitle } from '../../../lib/level';
import { supabase } from '../../../lib/supabase';
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

export default function Profile() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: myInstruments } = useMyInstruments();
  const { data: unlocked } = useUnlockedAchievements();
  const { data: achievements } = useAchievements();

  const xp = profile?.xp ?? 0;
  const progress = levelProgress(xp);

  const unlockedIds = new Set(unlocked?.map((item) => item.achievement_id));
  const preview = (achievements ?? []).filter((item) => unlockedIds.has(item.id)).slice(0, 4);

  return (
    <Screen>
      <Reveal index={0} style={styles.top}>
        <View style={{ flex: 1 }} />
        <IconButton name="pencil" onPress={() => router.push('/edit-profile')} />
      </Reveal>

      <Reveal index={0} style={styles.header}>
        <Avatar uri={profile?.avatar_url} name={profile?.nickname} size={96} ring />
        <Text style={styles.nickname}>{profile?.nickname}</Text>
        {profile?.full_name ? <Text style={styles.fullName}>{profile.full_name}</Text> : null}
      </Reveal>

      <Reveal index={1}>
        <Card highlight>
          <View style={styles.levelRow}>
            <Text style={styles.levelTitle}>
              Nível {progress.level} · {levelTitle(progress.level)}
            </Text>
            <Text style={styles.xpText}>
              {xp} / {progress.next} XP
            </Text>
          </View>
          <ProgressBar ratio={progress.ratio} height={10} />
        </Card>
      </Reveal>

      <Reveal index={2} style={styles.statsRow}>
        <Stat label="Sequência" value={`${profile?.streak_days ?? 0}`} unit="dias" icon="flame" color={colors.magenta} />
        <Stat label="Praticado" value={formatTotalTime(profile?.total_practice_seconds ?? 0)} icon="time-outline" color={colors.primarySoft} />
        <Stat label="Conquistas" value={String(unlocked?.length ?? 0)} icon="ribbon" color={colors.gold} />
      </Reveal>

      <Reveal index={3}>
        <Pressable onPress={() => router.push('/achievements')}>
          <Card>
            <View style={styles.rowBetween}>
              <SectionLabel>Conquistas</SectionLabel>
              <View style={styles.seeAll}>
                <Text style={styles.seeAllText}>Ver todas</Text>
                <Icon name="chevron-forward" size={16} color={colors.primarySoft} />
              </View>
            </View>
            {preview.length > 0 ? (
              <View style={styles.badges}>
                {preview.map((item) => (
                  <View key={item.id} style={styles.badge}>
                    <Icon name="medal" size={22} color={colors.gold} />
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.muted}>Pratique para desbloquear a primeira conquista.</Text>
            )}
          </Card>
        </Pressable>
      </Reveal>

      <Reveal index={4}>
        <SectionLabel>Instrumentos</SectionLabel>
      </Reveal>
      <View style={{ gap: spacing.sm }}>
        {myInstruments?.map((item, index) => (
          <Reveal key={item.instrument_id} index={5 + index}>
            <View style={styles.instrument}>
              <InstrumentTile id={item.instrument_id} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={styles.instrumentName}>{item.instruments.name}</Text>
                <Text style={styles.instrumentLevel}>{LEVEL_LABELS[item.experience_level] ?? ''}</Text>
              </View>
              {item.is_primary ? (
                <View style={styles.primaryTag}>
                  <Icon name="star" size={12} color={colors.primarySoft} />
                  <Text style={styles.primaryTagText}>Principal</Text>
                </View>
              ) : null}
            </View>
          </Reveal>
        ))}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Button
          title="Sair"
          variant="ghost"
          icon="log-out-outline"
          onPress={async () => {
            await unregisterPush();
            await supabase.auth.signOut();
          }}
        />
      </View>
    </Screen>
  );
}

function Stat({
  label,
  value,
  unit,
  icon,
  color,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: 'flame' | 'time-outline' | 'ribbon';
  color: string;
}) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={20} color={color} />
      <Text style={styles.statValue}>
        {value}
        {unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center' },
  header: { alignItems: 'center', gap: 4 },
  nickname: { color: colors.text, fontSize: 28, lineHeight: 34, fontFamily: fonts.titleBold, marginTop: spacing.sm },
  fullName: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.body },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.title },
  xpText: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
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
  statValue: { color: colors.text, fontSize: 17, fontFamily: fonts.titleBold },
  statUnit: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body },
  statLabel: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seeAll: { flexDirection: 'row', alignItems: 'center' },
  seeAllText: { color: colors.primarySoft, fontSize: 13, fontFamily: fonts.bodyMedium },
  badges: { flexDirection: 'row', gap: spacing.sm },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(242,184,75,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
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
  instrumentName: { color: colors.text, fontSize: 16, fontFamily: fonts.bodySemi },
  instrumentLevel: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body },
  primaryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
  },
  primaryTagText: { color: colors.primarySoft, fontSize: 12, fontFamily: fonts.bodySemi },
});