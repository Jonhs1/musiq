import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

/** Logo (cobra + 4 estrelas) e nome SnakeTune */
export function Brand({ size = 150 }: { size?: number }) {
  return (
    <View style={styles.wrap}>
      <Image
        source={require('../../assets/images/splash-icon.png')}
        style={{ width: size, height: size * 1.37 }}
        resizeMode="contain"
      />
      <Text style={styles.name}>
        Snake<Text style={{ color: colors.primarySoft }}>Tune</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  name: { color: colors.text, fontSize: 34, fontFamily: fonts.titleBold },
});
