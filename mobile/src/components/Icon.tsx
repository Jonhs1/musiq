import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ComponentProps, ReactNode } from 'react';
import { View } from 'react-native';
import { colors } from '../lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 22, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

/** Ícone do instrumento (bateria, guitarra, baixo, piano) */
export function InstrumentIcon({ id, size = 24, color = colors.primarySoft }: { id: string; size?: number; color?: string }) {
  if (id === 'drums') return <FontAwesome5 name="drum" size={size * 0.9} color={color} />;
  const name =
    id === 'guitar' ? 'guitar-electric' : id === 'bass' ? 'music-clef-bass' : id === 'piano' ? 'piano' : 'music-note';
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

/** Quadradinho arredondado com o ícone do instrumento */
export function InstrumentTile({ id, size = 48 }: { id: string; size?: number }) {
  return (
    <TileBox size={size}>
      <InstrumentIcon id={id} size={size * 0.5} />
    </TileBox>
  );
}

export function TileBox({ size = 48, children }: { size?: number; children: ReactNode }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.34,
        backgroundColor: colors.primaryTint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}
