import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { AudioRecorder as AudioRecorderInstance } from 'react-native-audio-api';
import { frequencyToNote, NoteReading } from './notes';
import { detectPitch } from './pitch';

export type TunerStatus = 'idle' | 'requesting' | 'denied' | 'unavailable' | 'listening' | 'error';

const REQUESTED_RATE = 44100;
const BUFFER_LENGTH = 4096;
const WINDOW = 8192; // ~186 ms: cabe 2+ períodos até do B0 (30,87 Hz)
const MIN_CLARITY = 0.85;
const MIN_GAP_MS = 80; // ~10 leituras por segundo
const SILENCE_MS = 600; // sem som por esse tempo → agulha em repouso
const SMOOTHING = 5;

type AudioApi = typeof import('react-native-audio-api');

// O módulo é nativo: no Expo Go ele não existe. Carregar só aqui, protegido, evita derrubar a tela.
function loadAudioApi(): AudioApi | null {
  try {
    return require('react-native-audio-api') as AudioApi;
  } catch {
    return null;
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Liga o microfone enquanto `enabled` for true e devolve a nota que está sendo tocada */
export function useTuner(enabled: boolean) {
  const [status, setStatus] = useState<TunerStatus>('idle');
  const [reading, setReading] = useState<NoteReading | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const askingPermission = useRef(false);

  // microfone desligado quando o app vai para segundo plano
  // (o diálogo de permissão do Android conta como "segundo plano": ignorar enquanto ele está aberto)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (askingPermission.current) return;
      setForeground(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!enabled || !foreground) {
      setStatus('idle');
      setReading(null);
      return;
    }

    let cancelled = false;
    let recorder: AudioRecorderInstance | null = null;

    const ring = new Float32Array(WINDOW);
    let filled = 0;
    let lastAnalysis = 0;
    let lastSoundAt = 0;
    const recent: number[] = [];

    function onSamples(data: Float32Array, sampleRate: number) {
      const n = data.length;
      if (n >= WINDOW) {
        ring.set(data.subarray(n - WINDOW));
      } else {
        ring.copyWithin(0, n);
        ring.set(data, WINDOW - n);
      }
      filled = Math.min(WINDOW, filled + n);

      const now = Date.now();
      if (filled < WINDOW || now - lastAnalysis < MIN_GAP_MS) return;
      lastAnalysis = now;

      const result = detectPitch(ring, sampleRate);
      if (result && result.clarity >= MIN_CLARITY) {
        lastSoundAt = now;
        recent.push(result.frequency);
        if (recent.length > SMOOTHING) recent.shift();
        if (!cancelled) setReading(frequencyToNote(median(recent)));
      } else if (now - lastSoundAt > SILENCE_MS) {
        recent.length = 0;
        if (!cancelled) setReading(null);
      }
    }

    async function start() {
      setStatus('requesting');
      const api = loadAudioApi();
      if (!api) {
        setStatus('unavailable'); // sem o módulo nativo (Expo Go)
        return;
      }
      try {
        askingPermission.current = true;
        let permission;
        try {
          permission = await api.AudioManager.requestRecordingPermissions();
        } finally {
          askingPermission.current = false;
        }
        if (cancelled) return;
        if (permission !== 'Granted') {
          setStatus('denied');
          return;
        }

        if (Platform.OS === 'ios') {
          api.AudioManager.setSystemOptions({ ios: { category: 'record', mode: 'measurement' } });
          await api.AudioManager.setAudioSessionActivity(true);
          if (cancelled) return;
        }

        recorder = new api.AudioRecorder();
        recorder.onError(() => {
          if (!cancelled) setStatus('error');
        });
        const registered = recorder.onAudioReady(
          { sampleRate: REQUESTED_RATE, bufferLength: BUFFER_LENGTH, channelCount: 1 },
          ({ buffer }) => onSamples(buffer.getChannelData(0), buffer.sampleRate),
        );
        if (registered.status === 'error') {
          console.warn('tuner onAudioReady error:', registered.message);
          if (!cancelled) setStatus('error');
          return;
        }

        const started = await recorder.start();
        if (cancelled) return; // a limpeza abaixo para o recorder
        setStatus(started.status === 'success' ? 'listening' : 'error');
      } catch (e) {
        console.warn('tuner start error:', e);
        if (!cancelled) setStatus('error');
      }
    }

    start();

    return () => {
      cancelled = true;
      try {
        recorder?.clearOnAudioReady();
        recorder?.clearOnError();
        void recorder?.stop();
      } catch (e) {
        console.warn('tuner stop error:', e);
      }
      setReading(null);
    };
  }, [enabled, foreground, attempt]);

  return { status, reading, retry };
}