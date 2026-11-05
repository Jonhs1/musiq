import { View } from 'react-native';
import { colors } from '../lib/theme';

/** Pontinhos de dificuldade (1 a 5) */
export function Dots({ level }: { level: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <View
          key={n}
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: n <= level ? colors.primary : colors.border,
          }}
        />
      ))}
    </View>
  );
}
