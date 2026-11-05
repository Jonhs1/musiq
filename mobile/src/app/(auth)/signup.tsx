import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Brand } from '../../components/Brand';
import { Button, ErrorText, Reveal, Screen, TextField } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { colors, fonts, spacing } from '../../lib/theme';

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSignup() {
    setError(null);
    setInfo(null);
    if (!email.trim()) return setError('Informe um e-mail.');
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() || null } },
    });
    setLoading(false);

      if (error) {
      console.warn('signUp error:', error.code, error.message);
      setError(
        error.message.toLowerCase().includes('already')
          ? 'Esse e-mail já está cadastrado.'
          : `Não foi possível criar a conta (${error.code ?? 'erro desconhecido'}).`,
      );
      return;
    }
    // Se a confirmação de e-mail estiver ligada, não há sessão ainda
    if (!data.session) setInfo('Conta criada! Confirme seu e-mail para entrar.');
  }

  return (
    <Screen>
      <Reveal index={0} style={{ alignItems: 'center', marginTop: spacing.md }}>
        <Brand size={110} />
        <Text style={styles.title}>Criar conta</Text>
      </Reveal>
      <TextField label="Nome" value={fullName} onChangeText={setFullName} autoComplete="name" />
      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextField
        label="Senha (mín. 8 caracteres)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />
      <ErrorText>{error}</ErrorText>
      {info ? <Text style={styles.info}>{info}</Text> : null}
      <Button title="Cadastrar" onPress={handleSignup} loading={loading} />
      <Link href="/login" style={styles.link}>
        Já tem conta? Entrar
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 22, fontFamily: fonts.title, marginTop: spacing.sm, marginBottom: spacing.xs },
  info: { color: colors.green, fontSize: 14, fontFamily: fonts.body },
  link: { color: colors.primarySoft, textAlign: 'center', marginTop: spacing.md, fontSize: 15, fontFamily: fonts.bodyMedium },
});