import { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors } from '../../lib/theme';

const MAX_SIZE = 300;
const MAX_ANGLE = 70; // graus para cada lado (±50 centavos)
const TICKS = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];

function angleFor(cents: number) {
  const clamped = Math.max(-50, Math.min(50, cents));
  return (clamped / 50) * MAX_ANGLE;
}

/** Arco com marcas e uma agulha: no centro = afinado, esquerda = abaixo, direita = acima */
export function TunerMeter({ cents, inTune }: { cents: number | null; inTune: boolean }) {
  // cabe em telas estreitas (24 de margem de cada lado)
  const { width } = useWindowDimensions();
  const SIZE = Math.max(220, Math.min(MAX_SIZE, width - 48));
  const HALF = SIZE / 2;
  const angle = useSharedValue(0);

  useEffect(() => {
    angle.value = withTiming(cents === null ? 0 : angleFor(cents), { duration: 140 });
  }, [cents, angle]);

  const needleStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));

  const active = cents !== null;
  const needleColor = !active ? colors.borderStrong : inTune ? colors.green : colors.primarySoft;

  const layer = { position: 'absolute', top: 0, left: 0, width: SIZE, height: SIZE, alignItems: 'center' } as const;

  return (
    <View style={{ width: SIZE, height: HALF + 18, overflow: 'hidden', alignSelf: 'center' }}>
      {TICKS.map((tick) => {
        const major = tick === 0;
        return (
          <View key={tick} style={[layer, { transform: [{ rotate: `${angleFor(tick)}deg` }] }]}>
            <View
              style={{
                width: 3,
                borderRadius: 2,
                marginTop: 4,
                height: major ? 24 : 14,
                backgroundColor: major ? (inTune && active ? colors.green : colors.textMuted) : colors.borderStrong,
              }}
            />
          </View>
        );
      })}
      <Animated.View style={[layer, needleStyle]}>
        <View
          style={{
            width: 4,
            height: HALF - 36,
            borderRadius: 2,
            marginTop: 30,
            backgroundColor: needleColor,
            opacity: active ? 1 : 0.5,
          }}
        />
      </Animated.View>
      <View
        style={{
          position: 'absolute',
          left: HALF - 9,
          top: HALF - 9,
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: needleColor,
        }}
      />
    </View>
  );
}