import { ComponentType, forwardRef, Ref, useCallback, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView as RNWebView, WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { METRONOME_HTML } from './engineHtml';

// Os tipos do react-native-webview (class component) não casam com o JSX do React 19.
// O componente é o mesmo em tempo de execução, só ajustamos o tipo.
const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<RNWebView> }>;

export type Subdivision = 'none' | 'eighth' | 'triplet' | 'sixteenth';

export type MetronomeConfig = {
  bpm: number;
  beatsPerBar: number;
  beatUnit: 4 | 8;
  subdivision: Subdivision;
  accentFirst: boolean;
  countInBars: number;
  volume: number; // 0 a 1
  ramp: { enabled: boolean; startBpm: number; endBpm: number; step: number; everySeconds: number };
  silent: { enabled: boolean; barsOn: number; barsOff: number };
};

export type BeatEvent = {
  bar: number;
  pulse: number;
  bpm: number;
  audible: boolean;
  countIn: boolean;
};

export type EngineStatus = {
  state: string;
  sampleRate: number;
  baseLatency: number;
  underruns: number;
  maxGapMs: number;
};

export type MetronomeHandle = {
  start: (config: MetronomeConfig) => void;
  stop: () => void;
  update: (partial: Partial<MetronomeConfig>) => void;
};

type Props = {
  onBeat?: (event: BeatEvent) => void;
  onStatus?: (status: EngineStatus) => void;
  onStopped?: () => void;
  onError?: (message: string) => void;
};

export const Metronome = forwardRef<MetronomeHandle, Props>(function Metronome(props, ref) {
  const webRef = useRef<RNWebView>(null);
  const ready = useRef(false);
  const pending = useRef<object | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const send = useCallback((message: object) => {
    if (!ready.current) {
      pending.current = message; // guarda só a última ordem até a página carregar
      return;
    }
    webRef.current?.injectJavaScript(
      `window.Metro && window.Metro.handle(${JSON.stringify(message)}); true;`,
    );
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      start: (config) => send({ type: 'start', cfg: config }),
      stop: () => send({ type: 'stop' }),
      update: (partial) => send({ type: 'update', partial }),
    }),
    [send],
  );

  function onMessage(event: WebViewMessageEvent) {
    let data: any;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    switch (data.type) {
      case 'ready': {
        ready.current = true;
        if (pending.current) {
          const message = pending.current;
          pending.current = null;
          send(message);
        }
        break;
      }
      case 'beat':
        propsRef.current.onBeat?.(data as BeatEvent);
        break;
      case 'status':
        propsRef.current.onStatus?.(data as EngineStatus);
        break;
      case 'stopped':
        propsRef.current.onStopped?.();
        break;
      case 'error':
        propsRef.current.onError?.(String(data.message));
        break;
    }
  }

  return (
    <WebView
      ref={webRef}
      source={{ html: METRONOME_HTML }}
      originWhitelist={['*']}
      onMessage={onMessage}
      javaScriptEnabled
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback
      pointerEvents="none"
      style={styles.hidden}
      onError={() => propsRef.current.onError?.('Falha ao carregar o motor de áudio.')}
    />
  );
});

// A WebView fica "invisível", mas montada na tela (precisa estar na hierarquia para rodar)
const styles = StyleSheet.create({
  hidden: { position: 'absolute', top: 0, left: 0, width: 1, height: 1, opacity: 0.01 },
});