// Página HTML executada dentro de uma WebView. Usa a Web Audio API com o agendador
// "dois relógios": um laço curto agenda os cliques com antecedência no relógio do áudio.
export const METRONOME_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="background:#000;margin:0">
<script>
(function () {
  var LOOKAHEAD_MS = 25;
  var SCHEDULE_AHEAD = 0.2;
  var SUBS = { none: 1, eighth: 2, triplet: 3, sixteenth: 4 };

  var ctx = null, master = null, timer = null, silentEl = null;
  var cfg = null, running = false, startToken = 0;
  var nextTime = 0, pulse = 0, sub = 0, bar = 0;
  var rampT0 = 0, barAudible = true;
  var underruns = 0, maxGapMs = 0, lastTick = 0, lastStatus = 0;

  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  // --- Faz o som sair mesmo com a chave de silêncio do iPhone ligada ---
  function makeSilentWav() {
    var sr = 8000, n = sr;
    var buf = new ArrayBuffer(44 + n * 2);
    var v = new DataView(buf);
    function w(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, n * 2, true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }

  function unlockAudioSession() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    try {
      if (!silentEl) {
        silentEl = document.createElement('audio');
        silentEl.src = makeSilentWav();
        silentEl.loop = true;
        silentEl.setAttribute('playsinline', '');
        document.body.appendChild(silentEl);
      }
      var p = silentEl.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  // --- Sons ---
  function click(time, kind) {
    var freq, gain, dur;
    if (kind === 'accent') { freq = 1600; gain = 1.0; dur = 0.06; }
    else if (kind === 'medium') { freq = 1250; gain = 0.8; dur = 0.05; }
    else if (kind === 'beat') { freq = 1000; gain = 0.7; dur = 0.05; }
    else { freq = 750; gain = 0.35; dur = 0.03; }
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  function kindFor(p, s) {
    if (s > 0) return 'sub';
    if (p === 0 && cfg.accentFirst) return 'accent';
    if (cfg.beatUnit === 8 && cfg.beatsPerBar >= 6 && cfg.beatsPerBar % 3 === 0 && p % 3 === 0) return 'medium';
    return 'beat';
  }

  // --- Regras que mudam a cada compasso (aumento de BPM e modo silencioso) ---
  function onBarStart() {
    if (bar < 0) { barAudible = true; return; }
    if (bar === 0) rampT0 = nextTime;
    if (cfg.ramp && cfg.ramp.enabled && bar > 0 && cfg.ramp.everySeconds > 0) {
      var steps = Math.floor((nextTime - rampT0) / cfg.ramp.everySeconds);
      var dir = cfg.ramp.endBpm >= cfg.ramp.startBpm ? 1 : -1;
      var target = cfg.ramp.startBpm + dir * Math.abs(cfg.ramp.step) * steps;
      var lo = Math.min(cfg.ramp.startBpm, cfg.ramp.endBpm);
      var hi = Math.max(cfg.ramp.startBpm, cfg.ramp.endBpm);
      cfg.bpm = Math.max(lo, Math.min(hi, target));
    }
    if (cfg.silent && cfg.silent.enabled) {
      var cycle = cfg.silent.barsOn + cfg.silent.barsOff;
      barAudible = cycle <= 0 || (bar % cycle) < cfg.silent.barsOn;
    } else {
      barAudible = true;
    }
  }

  function scheduleSlot() {
    var audible = barAudible;
    if (audible) click(nextTime, kindFor(pulse, sub));
    if (sub === 0) {
      var evt = { type: 'beat', bar: bar, pulse: pulse, bpm: cfg.bpm, audible: audible, countIn: bar < 0 };
      var delay = Math.max(0, (nextTime - ctx.currentTime) * 1000);
      setTimeout(function () { if (running) post(evt); }, delay);
    }
  }

  function advance() {
    var subCount = SUBS[cfg.subdivision] || 1;
    nextTime += (60 / cfg.bpm) / subCount;
    sub++;
    if (sub >= subCount) {
      sub = 0;
      pulse++;
      if (pulse >= cfg.beatsPerBar) {
        pulse = 0;
        bar++;
        onBarStart();
      }
    }
  }

  function sendStatus() {
    if (!ctx) return;
    post({
      type: 'status',
      state: ctx.state,
      sampleRate: ctx.sampleRate,
      baseLatency: ctx.baseLatency || 0,
      underruns: underruns,
      maxGapMs: Math.round(maxGapMs)
    });
  }

  function tick() {
    var now = ctx.currentTime;
    if (lastTick) {
      var gap = (now - lastTick) * 1000;
      if (gap > maxGapMs) maxGapMs = gap;
    }
    lastTick = now;
    if (nextTime < now) { underruns++; nextTime = now + 0.05; }
    while (nextTime < now + SCHEDULE_AHEAD) {
      scheduleSlot();
      advance();
    }
    if (now - lastStatus > 2) { lastStatus = now; sendStatus(); }
  }

  function begin() {
    running = true;
    bar = -(cfg.countInBars || 0);
    pulse = 0; sub = 0;
    underruns = 0; maxGapMs = 0; lastTick = 0; lastStatus = 0;
    nextTime = ctx.currentTime + 0.15;
    onBarStart();
    timer = setInterval(tick, LOOKAHEAD_MS);
    tick();
    sendStatus();
  }

  function stopInternal() {
    startToken++;
    if (timer) clearInterval(timer);
    timer = null;
    running = false;
    if (silentEl) { try { silentEl.pause(); } catch (e) {} }
  }

  function start(newCfg) {
    stopInternal();
    cfg = newCfg;
    if (cfg.ramp && cfg.ramp.enabled) cfg.bpm = cfg.ramp.startBpm;
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC({ latencyHint: 'interactive' });
        master = ctx.createGain();
        master.connect(ctx.destination);
      }
      master.gain.value = cfg.volume;
      unlockAudioSession();
      var token = ++startToken;
      ctx.resume().then(function () {
        if (token === startToken) begin();
      }, function (e) {
        post({ type: 'error', message: 'resume: ' + e });
      });
      setTimeout(function () {
        if (token === startToken && !running) {
          post({ type: 'error', message: 'O audio nao iniciou (estado: ' + (ctx ? ctx.state : 'sem contexto') + ')' });
        }
      }, 2000);
    } catch (e) {
      post({ type: 'error', message: String(e) });
    }
  }

  function stop() {
    stopInternal();
    post({ type: 'stopped' });
  }

  function update(partial) {
    if (!cfg) return;
    for (var k in partial) cfg[k] = partial[k];
    if (partial.volume !== undefined && master) master.gain.value = cfg.volume;
  }

  window.Metro = {
    handle: function (msg) {
      if (msg.type === 'start') start(msg.cfg);
      else if (msg.type === 'stop') stop();
      else if (msg.type === 'update') update(msg.partial);
    }
  };

  post({ type: 'ready' });
})();
</script>
</body>
</html>`;