import { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, fonts, radius, spacing } from '../lib/theme';
import { Icon } from './Icon';
import { Button } from './ui';

function PopStar({ delay }: { delay: number }) {
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withDelay(
      delay,
      withSequence(withSpring(1.35, { damping: 6, stiffness: 180 }), withSpring(1, { damping: 10 })),
    );
  }, [delay, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }, { rotate: `${(1 - scale.value) * -40}deg` }] }));
  return (
    <Animated.View style={style}>
      <Icon name="star" size={34} color={colors.gold} />
    </Animated.View>
  );
}

/** Tela de comemoração depois de salvar uma prática */
export function Celebration({
  visible,
  title,
  message,
  xp,
  onClose,
}: {
  visible: boolean;
  title: string;
  message: string;
  xp?: number | null;
  onClose: () => void;
}) {
  const xpScale = useSharedValue(0.6);
  useEffect(() => {
    if (visible) xpScale.value = withDelay(650, withSpring(1, { damping: 7, stiffness: 150 }));
    else xpScale.value = 0.6;
  }, [visible, xpScale]);
  const xpStyle = useAnimatedStyle(() => ({ transform: [{ scale: xpScale.value }], opacity: withTiming(xpScale.value > 0.6 ? 1 : 0) }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View entering={FadeIn.duration(250)} style={styles.card}>
          <View style={styles.stars}>
            {[0, 1, 2, 3].map((i) => (
              <PopStar key={i} delay={120 + i * 140} />
            ))}
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {xp != null ? (
            <Animated.View style={[styles.xp, xpStyle]}>
              <Icon name="flash" size={18} color={colors.gold} />
              <Text style={styles.xpText}>+{xp} XP</Text>
            </Animated.View>
          ) : null}
          <View style={{ alignSelf: 'stretch', marginTop: spacing.sm }}>
            <Button title="Continuar" onPress={onClose} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,7,12,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(138,77,255,0.5)',
  },
  stars: { flexDirection: 'row', gap: 10, marginBottom: spacing.xs },
  title: { color: colors.text, fontSize: 26, fontFamily: fonts.titleBold, textAlign: 'center' },
  message: { color: colors.textMuted, fontSize: 15, lineHeight: 22, fontFamily: fonts.body, textAlign: 'center' },
  xp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(242,184,75,0.14)',
    marginTop: spacing.xs,
  },
  xpText: { color: colors.gold, fontSize: 20, fontFamily: fonts.titleBold },
});
