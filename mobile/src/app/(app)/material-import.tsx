import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackButton } from '../../components/BackButton';
import { Button, Card, ErrorText, Screen, Subtitle, Title } from '../../components/ui';
import { buildDraft } from '../../features/materials/normalize';
import { friendlyImportError, type ImportFile, useImportMaterial } from '../../features/materials/api';
import { useDraftStore } from '../../features/materials/draftStore';
import { colors, fonts, spacing } from '../../lib/theme';

const ACK_KEY = 'musiq:import-ack:v1';
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 6;

type Picked = { uri: string; name: string; mime: ImportFile['mime']; size: number };

function mimeOf(name: string, reported?: string | null): ImportFile['mime'] | null {
  if (reported === 'application/pdf' || reported === 'image/png' || reported === 'image/jpeg') return reported;
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return null;
}

export default function MaterialImport() {
  const router = useRouter();
  const importMaterial = useImportMaterial();
  const setDraft = useDraftStore((s) => s.setDraft);
  const [acked, setAcked] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [remaining, setRemaining] = useState<number>(3);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ACK_KEY)
      .then((value) => setAcked(value === 'sim'))
      .catch(() => setAcked(false));
  }, []);

  async function acceptNotice() {
    await AsyncStorage.setItem(ACK_KEY, 'sim').catch(() => undefined);
    setAcked(true);
  }

  async function pickFiles() {
    setLocalError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/png', 'image/jpeg'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    const items: Picked[] = [];
    for (const asset of result.assets) {
      const mime = mimeOf(asset.name, asset.mimeType);
      if (!mime) {
        setLocalError(friendlyImportError(new Error('arquivo_invalido')));
        return;
      }
      items.push({ uri: asset.uri, name: asset.name, mime, size: asset.size ?? 0 });
    }

    const pdfs = items.filter((i) => i.mime === 'application/pdf').length;
    if ((pdfs === 1 && items.length !== 1) || (pdfs === 0 && items.length > MAX_IMAGES) || items.length === 0) {
      setLocalError(friendlyImportError(new Error('arquivo_invalido')));
      return;
    }
    if (items.reduce((sum, i) => sum + i.size, 0) > MAX_BYTES) {
      setLocalError(friendlyImportError(new Error('arquivo_grande')));
      return;
    }
    setPicked(items);
  }

  async function readAndImport() {
    setLocalError(null);
    try {
      const files: ImportFile[] = [];
      for (const item of picked) {
        const data = await new File(item.uri).base64();
        files.push({ mime: item.mime, data });
      }
      const { result, remaining: left } = await importMaterial.mutateAsync(files);
      setRemaining(left);
      setDraft(buildDraft(result));
      router.push('/material-review');
    } catch (error) {
      setLocalError(friendlyImportError(error));
    }
  }

  if (acked === null) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  if (!acked) {
    return (
      <Screen>
        <BackButton />
        <Title>Antes de começar</Title>
        <Card>
          <Text style={styles.notice}>
            O arquivo que você enviar vai ao Google para leitura por IA. No plano gratuito, o conteúdo pode ser usado
            para melhorar produtos do Google. O MUSIQ não guarda o arquivo: guarda só o texto que você revisar.
          </Text>
          <Text style={styles.notice}>Use só material que você tem o direito de usar.</Text>
        </Card>
        <Button title="Entendi, continuar" onPress={acceptNotice} />
      </Screen>
    );
  }

  const busy = importMaterial.isPending;

  return (
    <Screen>
      <BackButton />
      <Title>Importar material</Title>
      <Subtitle>Envie um PDF ou até 6 fotos da apostila. A IA devolve um rascunho para você revisar antes de salvar.</Subtitle>

      <Card>
        <Text style={styles.label}>Importações restantes hoje: {remaining}</Text>
        <Button title={picked.length ? 'Trocar arquivos' : 'Escolher arquivos'} variant="ghost" onPress={pickFiles} />
        {picked.map((item) => (
          <Text key={item.uri} style={styles.file}>
            {item.name}
          </Text>
        ))}
      </Card>

      {busy ? <Text style={styles.wait}>Isso pode levar até 1 minuto.</Text> : null}
      <ErrorText>{localError ?? (importMaterial.isError ? friendlyImportError(importMaterial.error) : null)}</ErrorText>

      <Button
        title={importMaterial.isError ? 'Tentar de novo' : 'Ler material'}
        onPress={readAndImport}
        loading={busy}
        disabled={picked.length === 0}
      />
      {busy ? null : (
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.link}>Cancelar</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { color: colors.text, fontSize: 14, lineHeight: 20, fontFamily: fonts.body, marginBottom: spacing.sm },
  label: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
  file: { color: colors.text, fontSize: 14, fontFamily: fonts.bodySemi },
  wait: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
  link: { color: colors.primarySoft, fontSize: 14, fontFamily: fonts.bodySemi, textAlign: 'center', paddingVertical: 4 },
});
