import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../../components/ui';
import { useAchievements, useUnlockedAchievements } from '../../../features/achievements/api';
import { colors, radius, spacing } from '../../../lib/theme';

export default function Achievements() {
  const { data: achievements, isLoading } = useAchievements();
  const { data: unlocked, refetch } = useUnlockedAchievements();

  // Atualiza ao voltar para esta aba (ex.: depois de uma prática)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const unlockedById = new Map(unlocked?.map((item) => [item.achievement_id, item.unlocked_at]));
  const total = achievements?.length ?? 0;

  return (
    <Screen>
      <Text style={styles.title}>Conquistas</Text>
      <Text style={styles.subtitle}>
        {unlockedById.size} de {total} desbloqueadas
      </Text>

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      <View style={{ gap: spacing.sm }}>
        {achievements?.map((achievement) => {
          const unlockedAt = unlockedById.get(achievement.id);
          const isUnlocked = !!unlockedAt;
          return (
            <View key={achievement.id} style={[styles.card, !isUnlocked && styles.cardLocked]}>
              <Text style={styles.icon}>{isUnlocked ? '🏅' : '🔒'}</Text>
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
            </View>
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
  title: { color: colors.text, fontSize: 28, fontWeight: '700', marginTop: spacing.md },
  subtitle: { color: colors.textMuted, fontSize: 14 },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
  },
  cardLocked: { borderColor: colors.border },
  icon: { fontSize: 28 },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  textLocked: { color: colors.textMuted },
  description: { color: colors.textMuted, fontSize: 13 },
  meta: { color: colors.primary, fontSize: 12 },
  note: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md },
});