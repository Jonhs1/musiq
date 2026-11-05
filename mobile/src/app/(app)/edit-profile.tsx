import { useQueryClient } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { BackButton } from '../../components/BackButton';
import { InstrumentTile } from '../../components/Icon';
import { Button, ErrorText, Screen, SectionLabel, TextField, Title } from '../../components/ui';
import {
  useInstruments,
  useMyInstruments,
  useProfile,
} from '../../features/profile/api';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { colors, fonts, radius, spacing } from '../../lib/theme';

type Level = 'beginner' | 'intermediate' | 'advanced';
type Selected = { id: string; level: Level };
type NewAvatar = { uri: string; base64: string; mimeType: string };

const LEVELS: { key: Level; label: string }[] = [
  { key: 'beginner', label: 'Iniciante' },
  { key: 'intermediate', label: 'Intermediário' },
  { key: 'advanced', label: 'Avançado' },
];

export default function EditProfile() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { data: profile } = useProfile();
  const { data: instruments } = useInstruments();
  const { data: myInstruments } = useMyInstruments();

  const [ready, setReady] = useState(false);
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<NewAvatar | null>(null);
  const [selected, setSelected] = useState<Selected[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preenche o formulário uma única vez, quando os dados chegam
  useEffect(() => {
    if (ready || !profile || !myInstruments) return;
    setFullName(profile.full_name ?? '');
    setNickname(profile.nickname ?? '');
    setSelected(myInstruments.map((item) => ({ id: item.instrument_id, level: item.experience_level })));
    setPrimaryId(myInstruments.find((item) => item.is_primary)?.instrument_id ?? myInstruments[0]?.instrument_id ?? null);
    setReady(true);
  }, [ready, profile, myInstruments]);

  const originalIds = new Set(myInstruments?.map((item) => item.instrument_id) ?? []);

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

  function removeInstrument(id: string, name: string) {
    if (selected.length === 1) {
      setError('Você precisa manter pelo menos um instrumento.');
      return;
    }
    const apply = () => {
      setError(null);
      const remaining = selected.filter((item) => item.id !== id);
      setSelected(remaining);
      if (primaryId === id) setPrimaryId(remaining[0].id);
    };
    if (originalIds.has(id)) {
      Alert.alert(
        `Remover ${name}?`,
        'Seu histórico, seu XP e seus treinos desse instrumento são mantidos. Se você voltar a adicioná-lo, tudo continua de onde parou.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Remover', style: 'destructive', onPress: apply },
        ],
      );
    } else {
      apply();
    }
  }

  function toggleInstrument(id: string, name: string) {
    const isSelected = selected.some((item) => item.id === id);
    if (isSelected) {
      removeInstrument(id, name);
    } else {
      setError(null);
      setSelected((current) => [...current, { id, level: 'beginner' }]);
      if (!primaryId) setPrimaryId(id);
    }
  }

  function setLevel(id: string, level: Level) {
    setSelected((current) => current.map((item) => (item.id === id ? { ...item, level } : item)));
  }

  async function handleSave() {
    setError(null);
    const nick = nickname.trim();
    if (nick.length < 3 || nick.length > 20) return setError('O apelido precisa ter de 3 a 20 caracteres.');
    if (selected.length === 0 || !primaryId) return setError('Escolha pelo menos um instrumento.');

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

      // Perfil primeiro: se o apelido já estiver em uso, nada mais é alterado
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

      const { error: instrumentsError } = await supabase.rpc('set_my_instruments', {
        p_items: selected.map((item) => ({
          instrument_id: item.id,
          is_primary: item.id === primaryId,
          experience_level: item.level,
        })),
      });
      if (instrumentsError) throw instrumentsError;

      // O plano da semana depende dos instrumentos e dos níveis: refaz de hoje em diante (sem travar a tela)
      const changedPlan =
        selected.length !== originalIds.size ||
        selected.some((item) => {
          const before = myInstruments?.find((mine) => mine.instrument_id === item.id);
          return !before || before.experience_level !== item.level;
        });
      if (changedPlan) {
        supabase
          .rpc('get_my_weekly_plan', { p_regenerate: true })
          .then(() => queryClient.invalidateQueries({ queryKey: ['plan'] }));
      }

      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['my-instruments', userId] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      router.back();
    } catch (e) {
      console.warn('edit-profile error:', e);
      const detail = e instanceof Error ? e.message : String(e);
      setError(`Não foi possível salvar: ${detail}`);
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <Screen>
        <BackButton />
        <Text style={styles.muted}>Carregando…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackButton />
      <Title>Editar perfil</Title>

      <Pressable onPress={pickImage} style={styles.avatarWrap}>
        {avatar ? (
          <Avatar uri={avatar.uri} name={nickname} size={112} ring />
        ) : (
          <Avatar uri={profile?.avatar_url} name={nickname} size={112} ring />
        )}
        <Text style={styles.avatarHint}>Alterar foto</Text>
      </Pressable>

      <TextField label="Nome" value={fullName} onChangeText={setFullName} />
      <TextField
        label="Apelido (aparece no ranking)"
        value={nickname}
        onChangeText={setNickname}
        autoCapitalize="none"
        maxLength={20}
      />

      <SectionLabel>Seus instrumentos</SectionLabel>
      <Text style={styles.muted}>Toque para adicionar ou remover. Defina o nível e o instrumento principal.</Text>

      <View style={{ gap: spacing.sm }}>
        {instruments?.map((instrument) => {
          const current = selected.find((item) => item.id === instrument.id);
          const isPrimary = primaryId === instrument.id;
          return (
            <View key={instrument.id} style={[styles.card, current && styles.cardSelected]}>
              <Pressable style={styles.cardHeader} onPress={() => toggleInstrument(instrument.id, instrument.name)}>
                <InstrumentTile id={instrument.id} size={44} />
                <Text style={styles.cardName}>{instrument.name}</Text>
                <Text style={[styles.toggle, current && { color: colors.green }]}>
                  {current ? 'Tenho' : 'Adicionar'}
                </Text>
              </Pressable>

              {current ? (
                <View style={{ gap: spacing.sm }}>
                  <View style={styles.levels}>
                    {LEVELS.map((level) => (
                      <Pressable
                        key={level.key}
                        onPress={() => setLevel(instrument.id, level.key)}
                        style={[styles.level, current.level === level.key && styles.levelActive]}
                      >
                        <Text style={[styles.levelText, current.level === level.key && styles.levelTextActive]}>
                          {level.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable onPress={() => setPrimaryId(instrument.id)} disabled={isPrimary}>
                    <Text style={[styles.primary, isPrimary && { color: colors.primarySoft }]}>
                      {isPrimary ? 'Instrumento principal' : 'Tornar principal'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <ErrorText>{error}</ErrorText>
      <Button title="Salvar alterações" onPress={handleSave} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
  avatarWrap: { alignSelf: 'center', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.sm },
  avatarHint: { color: colors.primarySoft, fontSize: 14, fontFamily: fonts.bodySemi },
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardSelected: { borderColor: 'rgba(138,77,255,0.55)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardName: { color: colors.text, fontSize: 17, fontFamily: fonts.title, flex: 1 },
  toggle: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.bodySemi },
  levels: { flexDirection: 'row', gap: spacing.xs },
  level: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  levelActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  levelText: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.bodyMedium },
  levelTextActive: { color: colors.primarySoft, fontFamily: fonts.bodySemi },
  primary: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.bodyMedium },
});
