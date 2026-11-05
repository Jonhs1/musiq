import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Brand } from '../../components/Brand';
import { Button, ErrorText, Reveal, Screen, TextField } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { colors, fonts, spacing } from '../../lib/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Informe e-mail e senha.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setError('E-mail ou senha incorretos.');
    // Em caso de sucesso, a navegação é automática (ver app/_layout.tsx)
  }

  return (
    <Screen>
      <Reveal index={0} style={{ alignItems: 'center', marginTop: spacing.md }}>
        <Brand />
        <Text style={styles.subtitle}>Entre para continuar sua evolução.</Text>
      </Reveal>
      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextField
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Entrar" onPress={handleLogin} loading={loading} />
      <Link href="/signup" style={styles.link}>
        Não tem conta? Cadastre-se
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: colors.textMuted, fontSize: 15, fontFamily: fonts.body, marginTop: spacing.xs, marginBottom: spacing.sm },
  link: { color: colors.primarySoft, textAlign: 'center', marginTop: spacing.md, fontSize: 15, fontFamily: fonts.bodyMedium },
});