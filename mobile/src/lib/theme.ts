export const colors = {
  // Base: cinza escuro
  backgroundDeep: '#0E0D12',
  background: '#131217',
  surface: '#1B1A22',
  surfaceHigh: '#23212C',
  border: '#2C2A37',
  borderStrong: '#3A3748',

  // Roxo (cor da marca)
  primary: '#8A4DFF',
  primaryDeep: '#6C2BD9',
  primarySoft: '#C19BFF',
  primaryTint: 'rgba(138,77,255,0.16)',
  onPrimary: '#FFFFFF',

  // Texto
  text: '#EDE7EE',
  textMuted: '#A59EB3',
  textDim: '#8F889D',

  // Acentos (só em detalhes)
  magenta: '#FF3FA4',
  green: '#3DDC97',
  gold: '#F2B84B',
  silver: '#C9C3D4',
  bronze: '#D9955B',
  danger: '#FF5C7A',
} as const;

export const gradients = {
  primary: ['#7A3BEF', '#9A63FF'] as [string, string],
  glow: ['rgba(138,77,255,0.20)', 'rgba(138,77,255,0)'] as [string, string],
  me: ['#2B2050', '#1B1A22'] as [string, string],
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 12, md: 18, lg: 24, xl: 28, pill: 999 } as const;

// Chakra Petch: títulos e números · Inter: textos e botões
export const fonts = {
  title: 'ChakraPetch_600SemiBold',
  titleBold: 'ChakraPetch_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
} as const;
