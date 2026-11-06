import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, gradients, radius, spacing } from '../lib/theme';
import { Icon, IconName } from './Icon';

/** Tela com fundo escuro, brilho roxo suave no topo e rolagem */
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={gradients.glow} style={styles.glow} pointerEvents="none" />
      {scroll ? (
        <KeyboardAwareScrollView
          bottomOffset={24}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </KeyboardAwareScrollView>
      ) : (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>{children}</View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

/** Entrada suave (sobe e aparece). Use `index` para escalonar itens de uma lista. */
export function Reveal({
  children,
  index = 0,
  style,
}: {
  children: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  'use no memo';
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(Math.min(index, 8) * 55, withTiming(1, { duration: 380 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // só opacidade + transform: não mexe no layout, então nunca sobrepõe cartões
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 14 }],
  }));
  return (
    <Animated.View collapsable={false} style={[style, animated]}>
      {children}
    </Animated.View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Card({
  children,
  style,
  highlight,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  highlight?: boolean;
}) {
  return <View style={[styles.card, highlight && styles.cardHighlight, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  icon,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'soft' | 'danger';
  icon?: IconName;
}) {
  const off = disabled || loading;
  const textColor =
    variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.danger : variant === 'soft' ? colors.primarySoft : colors.text;

  const content = loading ? (
    <ActivityIndicator color={textColor} />
  ) : (
    <View style={styles.buttonContent}>
      {icon ? <Icon name={icon} size={18} color={textColor} /> : null}
      <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.buttonWrap,
        variant === 'primary' && styles.buttonShadow,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'soft' && styles.buttonSoft,
        variant === 'danger' && styles.buttonDanger,
        off && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 },
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.buttonFill}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={styles.buttonFill}>{content}</View>
      )}
    </Pressable>
  );
}

/** Botão redondo só com ícone */
export function IconButton({
  name,
  onPress,
  size = 44,
  disabled,
}: {
  name: IconName;
  onPress: () => void;
  size?: number;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        disabled && { opacity: 0.4 },
        pressed && { transform: [{ scale: 0.93 }] },
      ]}
    >
      <Icon name={name} size={size * 0.45} />
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.8 }]}
    >
      {icon}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** Barra de progresso com animação suave */
export function ProgressBar({
  ratio,
  color = colors.primary,
  height = 8,
}: {
  ratio: number;
  color?: string;
  height?: number;
}) {
  const value = useSharedValue(0);
  useEffect(() => {
    value.value = withTiming(Math.max(0, Math.min(1, ratio)), { duration: 700 });
  }, [ratio, value]);
  const style = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: colors.border, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, style]} />
    </View>
  );
}

export function TextField({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string | null }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textDim}
        selectionColor={colors.primarySoft}
        {...props}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        style={[styles.input, focused && styles.inputFocused, error ? { borderColor: colors.danger } : null, props.style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  return children ? <Text style={styles.error}>{children}</Text> : null;
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 280 },
  title: { color: colors.text, fontSize: 30, lineHeight: 36, fontFamily: fonts.titleBold },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20, fontFamily: fonts.body },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontFamily: fonts.title,
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardHighlight: { borderColor: 'rgba(138,77,255,0.55)' },
  buttonWrap: { height: 54, borderRadius: radius.pill, overflow: 'hidden' },
  buttonShadow: {
    shadowColor: '#7A3BEF',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  buttonFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonGhost: { borderWidth: 1, borderColor: colors.borderStrong },
  buttonSoft: { backgroundColor: colors.primaryTint },
  buttonDanger: { borderWidth: 1, borderColor: 'rgba(255,92,122,0.4)' },
  buttonText: { fontSize: 16, fontFamily: fonts.bodySemi },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  chipText: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.bodyMedium },
  chipTextActive: { color: colors.primarySoft, fontFamily: fonts.bodySemi },
  label: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.bodyMedium },
  input: {
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontFamily: fonts.body,
  },
  inputFocused: { borderColor: colors.primary },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
});