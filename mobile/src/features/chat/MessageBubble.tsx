import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { colors, fonts, radius } from '../../lib/theme';
import { Message, useMediaUrl } from './api';

function clock(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function hourLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({
  message,
  mine,
  onLongPress,
}: {
  message: Message;
  mine: boolean;
  onLongPress?: () => void;
}) {
  const deleted = message.deleted_at !== null;
  // só o dono pode apagar, e só enquanto a mensagem existe
  const press = mine && !deleted ? onLongPress : undefined;

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <Pressable
        onLongPress={press}
        delayLongPress={350}
        disabled={!press}
        style={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
          !deleted && message.kind === 'image' && styles.bubbleImage,
          deleted && styles.bubbleDeleted,
        ]}
      >
        {deleted ? (
          <View style={styles.deletedRow}>
            <Icon name="ban-outline" size={14} color={colors.textMuted} />
            <Text style={styles.deletedText}>Mensagem apagada</Text>
          </View>
        ) : null}
        {!deleted && message.kind === 'text' ? <Text style={styles.text}>{message.body}</Text> : null}
        {!deleted && message.kind === 'image' ? <ImageContent path={message.media_path} onLongPress={press} /> : null}
        {!deleted && message.kind === 'audio' ? (
          <AudioContent path={message.media_path} durationMs={message.media_duration_ms} />
        ) : null}
        <View style={styles.meta}>
          <Text style={styles.time}>{hourLabel(message.created_at)}</Text>
          {mine && !deleted ? (
            <Icon
              name={message.read_at ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={message.read_at ? colors.green : 'rgba(255,255,255,0.6)'}
            />
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

function ImageContent({ path, onLongPress }: { path: string | null; onLongPress?: () => void }) {
  const { data: url, isLoading } = useMediaUrl(path);
  const [open, setOpen] = useState(false);

  if (isLoading || !url) {
    return (
      <View style={[styles.image, styles.imageLoading]}>
        <ActivityIndicator color={colors.primarySoft} />
      </View>
    );
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} onLongPress={onLongPress} delayLongPress={350}>
        <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.viewer} onPress={() => setOpen(false)}>
          <Image source={{ uri: url }} style={styles.viewerImage} resizeMode="contain" />
        </Pressable>
      </Modal>
    </>
  );
}

function AudioContent({ path, durationMs }: { path: string | null; durationMs: number | null }) {
  const { data: url } = useMediaUrl(path);
  if (!url) {
    return (
      <View style={styles.audio}>
        <ActivityIndicator color={colors.primarySoft} />
      </View>
    );
  }
  return <AudioPlayer url={url} durationMs={durationMs} />;
}

function AudioPlayer({ url, durationMs }: { url: string; durationMs: number | null }) {
  const player = useAudioPlayer({ uri: url });
  const status = useAudioPlayerStatus(player);

  const total = status.duration > 0 ? status.duration : (durationMs ?? 0) / 1000;
  const ratio = total > 0 ? Math.min(1, status.currentTime / total) : 0;

  async function toggle() {
    if (status.playing) {
      player.pause();
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    if (status.didJustFinish || (total > 0 && status.currentTime >= total - 0.1)) {
      await player.seekTo(0);
    }
    player.play();
  }

  return (
    <View style={styles.audio}>
      <Pressable onPress={toggle} style={styles.play} hitSlop={6}>
        <Icon name={status.playing ? 'pause' : 'play'} size={18} color={colors.onPrimary} />
      </Pressable>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${ratio * 100}%` }]} />
        </View>
        <Text style={styles.audioTime}>{status.playing || status.currentTime > 0 ? clock(status.currentTime) : clock(total)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 16, marginVertical: 3 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, borderRadius: radius.md, gap: 2 },
  bubbleMine: { backgroundColor: colors.primaryDeep, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 6 },
  bubbleImage: { padding: 4 },
  bubbleDeleted: { opacity: 0.75 },
  deletedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deletedText: { color: colors.textMuted, fontSize: 14, fontStyle: 'italic', fontFamily: fonts.body },
  text: { color: colors.text, fontSize: 15, lineHeight: 21, fontFamily: fonts.body },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', paddingRight: 4 },
  time: { color: 'rgba(237,231,238,0.55)', fontSize: 11, fontFamily: fonts.body },
  image: { width: 220, height: 220, borderRadius: radius.sm },
  imageLoading: { backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  viewer: { flex: 1, backgroundColor: 'rgba(8,7,12,0.95)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '85%' },
  audio: { flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 190 },
  play: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  trackFill: { height: 5, borderRadius: 3, backgroundColor: colors.primarySoft },
  audioTime: { color: 'rgba(237,231,238,0.7)', fontSize: 12, fontFamily: fonts.body },
});