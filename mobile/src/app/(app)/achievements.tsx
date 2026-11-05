import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../../components/BackButton';
import { Icon } from '../../components/Icon';
import { Card, Reveal, Screen, Subtitle, Title } from '../../components/ui';
import { useAchievements, useUnlockedAchievements } from '../../features/achievements/api';
import { colors, fonts, spacing } from '../../lib/theme';

export default function Achievements() {
  const { data: achievements, isLoading } = useAchievements();
  const { data: unlocked, refetch } = useUnlockedAchievements();

  // Atualiza ao abrir a tela (ex.: depois de uma prática)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const unlockedById = new Map(unlocked?.map((item) => [item.achievement_id, item.unlocked_at]));
  const total = achievements?.length ?? 0;

  return (
    <Screen>
      <BackButton />
      <Reveal index={0}>
        <Title>Conquistas</Title>
        <Subtitle>
          {unlockedById.size} de {total} desbloqueadas
        </Subtitle>
      </Reveal>

      {isLoading ? <ActivityIndicator color={colors.primarySoft} /> : null}

      <View style={{ gap: spacing.sm }}>
        {achievements?.map((achievement, index) => {
          const unlockedAt = unlockedById.get(achievement.id);
          const isUnlocked = !!unlockedAt;
          return (
            <Reveal key={achievement.id} index={index + 1}>
              <Card style={[styles.card, isUnlocked && styles.cardUnlocked]}>
                <View style={[styles.icon, isUnlocked && styles.iconUnlocked]}>
                  <Icon
                    name={isUnlocked ? 'medal' : 'lock-closed'}
                    size={22}
                    color={isUnlocked ? colors.gold : colors.textDim}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.name, !isUnlocked && styles.textLocked]}>{achievement.name}</Text>
                  <Text style={styles.description}>{achievement.description}</Text>
                  <Text style={styles.meta}>
                    {isUnlocked
                      ? `Desbloqueada em ${new Date(unlockedAt!).toLocaleDateString('pt-BR')}`
                      : achievement.xp_reward > 0
                        ? `+${achievement.xp_reward} XP`
                        : ''}
                  </Text>
                </View>
              </Card>
            </Reveal>
          );
        })}
      </View>

      <Text style={styles.note}>
        Algumas conquistas dependem da análise de precisão, que chega junto com o metrônomo.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardUnlocked: { borderColor: 'rgba(242,184,75,0.4)' },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconUnlocked: { backgroundColor: 'rgba(242,184,75,0.12)' },
  name: { color: colors.text, fontSize: 16, fontFamily: fonts.bodySemi },
  textLocked: { color: colors.textMuted },
  description: { color: colors.textMuted, fontSize: 13, lineHeight: 18, fontFamily: fonts.body },
  meta: { color: colors.primarySoft, fontSize: 12, fontFamily: fonts.bodyMedium },
  note: { color: colors.textDim, fontSize: 12, fontFamily: fonts.body, marginTop: spacing.md },
});
