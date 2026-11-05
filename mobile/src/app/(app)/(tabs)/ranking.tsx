import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { Screen } from '../../../components/ui';
import { useLeaderboard } from '../../../features/ranking/api';
import { useAuth } from '../../../lib/auth';
import { colors, radius, spacing } from '../../../lib/theme';

const MEDAL_COLORS = [colors.gold, colors.silver, colors.bronze];

export default function Ranking() {
  const { session } = useAuth();
  const { data: rows, isLoading, isError, refetch } = useLeaderboard();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return (
    <Screen>
      <Text style={styles.title}>Ranking</Text>
      <Text style={styles.subtitle}>Classificação geral por XP.</Text>

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {isError ? <Text style={styles.error}>Não foi possível carregar o ranking.</Text> : null}
      {rows && rows.length === 0 ? <Text style={styles.subtitle}>Ninguém no ranking ainda.</Text> : null}

      <View style={{ gap: spacing.sm }}>
        {rows?.map((row) => {
          const isMe = row.user_id === session?.user.id;
          const medal = MEDAL_COLORS[row.rank_position - 1];
          return (
            <View key={row.user_id} style={[styles.row, isMe && styles.rowMe]}>
              <Text style={[styles.position, medal ? { color: medal } : null]}>
                {row.rank_position}
              </Text>
              <Avatar uri={row.avatar_url} name={row.nickname} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.nickname}>
                  {row.nickname}
                  {isMe ? ' (você)' : ''}
                </Text>
                <Text style={styles.level}>Nível {row.level}</Text>
              </View>
              <Text style={styles.xp}>{row.xp} XP</Text>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: '700', marginTop: spacing.md },
  subtitle: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.danger },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowMe: { borderColor: colors.primary },
  position: { color: colors.textMuted, fontSize: 18, fontWeight: '800', width: 28, textAlign: 'center' },
  nickname: { color: colors.text, fontSize: 16, fontWeight: '600' },
  level: { color: colors.textMuted, fontSize: 12 },
  xp: { color: colors.primary, fontSize: 15, fontWeight: '700' },
});