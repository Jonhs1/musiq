import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { colors, fonts, radius } from '../../lib/theme';

type Props = {
  onSendText: (text: string) => void;
  onSendImage: (uri: string, contentType: string) => void;
  onSendAudio: (uri: string, durationMs: number) => void;
  busy?: boolean;
};

function clock(ms: number) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function Composer({ onSendText, onSendImage, onSendAudio, busy }: Props) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsed(Date.now() - startedAt.current), 200);
    return () => clearInterval(timer);
  }, [recording]);

  function sendText() {
    const value = text.trim();
    if (!value) return;
    setText('');
    onSendText(value);
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const type = asset.mimeType === 'image/png' || asset.mimeType === 'image/webp' ? asset.mimeType : 'image/jpeg';
    onSendImage(asset.uri, type);
  }

  async function startRecording() {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microfone bloqueado', 'Permita o uso do microfone nas configurações para enviar áudios.');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      setElapsed(0);
      setRecording(true);
    } catch (e) {
      console.warn('recording error:', e);
      Alert.alert('Não foi possível gravar', 'Tente de novo.');
    }
  }

  async function finishRecording(send: boolean) {
    const durationMs = Date.now() - startedAt.current;
    setRecording(false);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch (e) {
      console.warn('stop recording error:', e);
    }
    const uri = recorder.uri;
    if (send && uri && durationMs >= 700) onSendAudio(uri, durationMs);
  }

  if (recording) {
    return (
      <View style={styles.bar}>
        <Pressable onPress={() => finishRecording(false)} style={styles.roundGhost} hitSlop={6}>
          <Icon name="trash-outline" size={20} color={colors.danger} />
        </Pressable>
        <View style={styles.recordingInfo}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>Gravando {clock(elapsed)}</Text>
        </View>
        <Pressable onPress={() => finishRecording(true)} style={styles.send} hitSlop={6}>
          <Icon name="send" size={18} color={colors.onPrimary} />
        </Pressable>
      </View>
    );
  }

  const hasText = text.trim().length > 0;

  return (
    <View style={styles.bar}>
      <Pressable onPress={pickImage} style={styles.roundGhost} hitSlop={6} disabled={busy}>
        <Icon name="image-outline" size={22} color={colors.primarySoft} />
      </Pressable>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Mensagem"
        placeholderTextColor={colors.textDim}
        selectionColor={colors.primarySoft}
        multiline
        maxLength={2000}
        style={styles.input}
      />
      {hasText ? (
        <Pressable onPress={sendText} style={styles.send} hitSlop={6}>
          <Icon name="send" size={18} color={colors.onPrimary} />
        </Pressable>
      ) : (
        <Pressable onPress={startRecording} style={styles.send} hitSlop={6} disabled={busy}>
          <Icon name="mic" size={20} color={colors.onPrimary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.backgroundDeep,
  },
  roundGhost: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.body,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  recordingInfo: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  recText: { color: colors.text, fontSize: 15, fontFamily: fonts.bodyMedium },
});