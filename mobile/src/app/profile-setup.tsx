import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorText, Screen, TextField } from '../components/ui';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../lib/theme';
import { INSTRUMENT_EMOJI, useInstruments, useProfile } from '../features/profile/api';

type Avatar = { uri: string; base64: string; mimeType: string };

export default function ProfileSetup() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const { data: instruments } = useInstruments();

  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [selected, setSelected] = useState<string[]>([]); // o primeiro é o principal
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.full_name) setFullName((current) => current || profile.full_name!);
  }, [profile]);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      setError('Não foi possível ler a foto. Tente outra imagem.');
      return;
    }
    setError(null);
    setAvatar({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' });
  }

  function toggleInstrument(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((i) => i !== id) : [...current, id],
    );
  }

  async function handleSave() {
    setError(null);
    const nick = nickname.trim();
    if (nick.length < 3 || nick.length > 20) return setError('O apelido precisa ter de 3 a 20 caracteres.');
    if (selected.length === 0) return setError('Escolha pelo menos um instrumento.');

    const userId = session!.user.id;
    setSaving(true);
    try {
      let avatarUrl: string | undefined;
      if (avatar) {
        const extension = avatar.mimeType === 'image/png' ? 'png' : 'jpg';
        const path = `${userId}/avatar.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, decode(avatar.base64), { contentType: avatar.mimeType, upsert: true });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        avatarUrl = `${data.publicUrl}?t=${Date.now()}`;
      }

      const { error: instrumentsError } = await supabase.from('user_instruments').upsert(
        selected.map((id, index) => ({
          user_id: userId,
          instrument_id: id,
          is_primary: index === 0,
        })),
        { onConflict: 'user_id,instrument_id' },
      );
      if (instrumentsError) throw instrumentsError;

      // O apelido é salvo por último: é ele que marca o perfil como completo
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          nickname: nick,
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        })
        .eq('id', userId);

      if (profileError) {
        if (profileError.code === '23505') return setError('Esse apelido já está em uso.');
        throw profileError;
      }

      await queryClient.invalidateQueries({ queryKey: ['my-instruments', userId] });
      await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    } catch (e) {
      console.warn('profile-setup error:', e);
      const detail = e instanceof Error ? e.message : String(e);
      setError(`Não foi possível salvar: ${detail}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Seu perfil</Text>

      <Pressable onPress={pickImage} style={styles.avatarWrap}>
        {avatar ? (
          <Image source={{ uri: avatar.uri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Text style={styles.avatarHint}>Adicionar foto</Text>
          </View>
        )}
      </Pressable>

      <TextField label="Nome" value={fullName} onChangeText={setFullName} />
      <TextField
        label="Apelido (aparece no ranking)"
        value={nickname}
        onChangeText={setNickname}
        autoCapitalize="none"
        maxLength={20}
      />

      <Text style={styles.section}>Quais instrumentos você toca?</Text>
      <Text style={styles.hint}>O primeiro que você escolher será o principal.</Text>
      <View style={styles.grid}>
        {instruments?.map((instrument) => {
          const index = selected.indexOf(instrument.id);
          const isSelected = index !== -1;
          return (
            <Pressable
              key={instrument.id}
              onPress={() => toggleInstrument(instrument.id)}
              style={[styles.card, isSelected && styles.cardSelected]}
            >
              <Text style={styles.emoji}>{INSTRUMENT_EMOJI[instrument.id] ?? '🎵'}</Text>
              <Text style={styles.cardText}>{instrument.name}</Text>
              {isSelected && index === 0 ? <Text style={styles.primaryTag}>principal</Text> : null}
            </Pressable>
          );
        })}
      </View>

      <ErrorText>{error}</ErrorText>
      <Button title="Salvar e continuar" onPress={handleSave} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: '700', marginTop: spacing.md },
  avatarWrap: { alignSelf: 'center', marginVertical: spacing.sm },
  avatar: { width: 112, height: 112, borderRadius: 56 },
  avatarEmpty: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: { color: colors.textMuted, fontSize: 13 },
  section: { color: colors.text, fontSize: 18, fontWeight: '600', marginTop: spacing.md },
  hint: { color: colors.textMuted, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    width: '48%',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardSelected: { borderColor: colors.primary },
  emoji: { fontSize: 32 },
  cardText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  primaryTag: { color: colors.primary, fontSize: 11 },
});