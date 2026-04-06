// ============================================================
// PIPORADIO — MOTOR DE GENERACIÓN CORREGIDO v5
// Reemplaza generateSong, generateWithSuno, pollSuno
// ============================================================

// ── Proxy helper ─────────────────────────────────────────────
function proxyFetch(service, path, options = {}) {
  const base = window.location.origin; // piporadio.vercel.app
  const url  = `${base}/api/proxy?service=${service}&path=${encodeURIComponent(path)}`;
  return fetch(url, options);
}

// ── Extraer audio de la respuesta de udioapi.pro ─────────────
function extractAudioUrl(data) {
  // udioapi.pro puede devolver varias estructuras según el modelo/versión
  if (!data) return null;

  // wait_audio:true → { data: [ { audio_url, song_url, ... } ] }
  if (Array.isArray(data.data) && data.data.length > 0) {
    const item = data.data[0];
    return item.audio_url || item.song_url || item.url || item.audioUrl || null;
  }
  // Respuesta directa
  if (data.audio_url) return data.audio_url;
  if (data.song_url)  return data.song_url;
  if (data.url)       return data.url;

  // { songs: [...] }
  if (Array.isArray(data.songs) && data.songs.length > 0) {
    const s = data.songs[0];
    return s.audio_url || s.song_url || s.url || null;
  }

  return null;
}

// ── Función principal ────────────────────────────────────────
async function generateSong() {
  const udioKey  = localStorage.getItem('udioApiKey') || '';
  const useUdio  = !!udioKey && (localStorage.getItem('useUdioApi') === 'true');
  const promptEl = document.getElementById('songPrompt') || document.getElementById('generatedPrompt');
  const titleEl  = document.getElementById('songTitle');

  const prompt = promptEl ? promptEl.value.trim() : 'Romantic Mexican ballad, emotional, warm tone';
  const title  = titleEl  ? titleEl.value.trim()  : 'Mi Canción';

  // UI feedback
  const btn = document.getElementById('generateBtn') || document.querySelector('[onclick*="generateSong"]');
  const log = document.getElementById('genLog') || document.getElementById('statusLog');
  const setStatus = (msg) => {
    if (log) log.textContent = msg;
    console.log('[GEN]', msg);
  };

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando...'; }

  try {
    if (useUdio) {
      setStatus('🎵 Enviando a Suno V4.5 vía udioapi.pro...');
      await generateWithUdioAPI(prompt, title, udioKey, setStatus);
    } else {
      setStatus('🎹 Síntesis local (configura udioapi.pro para música real)...');
      await generateLocal(prompt, setStatus);
    }
  } catch (err) {
    console.error('generateSong error:', err);
    setStatus(`❌ Error: ${err.message}`);
    // Fallback
    setStatus('⚠️ Usando síntesis local como respaldo...');
    try { await generateLocal(prompt, setStatus); } catch(e2) { setStatus('❌ Falló también la síntesis local.'); }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🎵 Generar Canción'; }
  }
}

// ── udioapi.pro con wait_audio:true ─────────────────────────
async function generateWithUdioAPI(prompt, title, apiKey, setStatus) {
  const model    = localStorage.getItem('udioModel') || 'chirp-v4-5';
  const duration = parseInt(localStorage.getItem('songDuration') || '60');

  setStatus(`🚀 Enviando prompt a Suno (${model})...`);

  // ── Paso 1: Generar ─────────────────────────────────────
  const genRes = await proxyFetch('udio', '/api/v2/generate', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt:     prompt,
      title:      title,
      model:      model,
      duration:   duration,
      wait_audio: true,   // udioapi.pro espera internamente — 1 sola petición
    }),
  });

  if (!genRes.ok) {
    const errText = await genRes.text();
    let errMsg = `HTTP ${genRes.status}`;
    try { errMsg = JSON.parse(errText).message || errMsg; } catch(_) {}

    if (genRes.status === 402) throw new Error('Sin créditos en udioapi.pro — recarga en udioapi.pro/pricing');
    if (genRes.status === 401) throw new Error('API Key inválida — verifica en udioapi.pro/dashboard');
    throw new Error(`udioapi.pro error: ${errMsg}`);
  }

  const genData = await genRes.json();
  console.log('[UDIO] Respuesta generación:', genData);

  // ── Paso 2: Intentar extraer audio directo (wait_audio) ──
  let audioUrl = extractAudioUrl(genData);

  // ── Paso 3: Polling si wait_audio no lo entregó ─────────
  if (!audioUrl) {
    const workId = genData.workId || genData.task_id || genData.id || genData.data?.workId;
    if (!workId) throw new Error('No se recibió workId — respuesta inesperada de udioapi.pro');

    setStatus(`⏳ Procesando en Suno... (ID: ${workId})`);
    audioUrl = await pollForAudio(workId, apiKey, setStatus);
  }

  if (!audioUrl) throw new Error('No se recibió URL de audio después de la generación');

  setStatus('✅ ¡Canción generada! Cargando audio...');
  loadAudioIntoPlayer(audioUrl);
}

// ── Polling con workId correcto ──────────────────────────────
async function pollForAudio(workId, apiKey, setStatus) {
  const MAX_WAIT  = 8 * 60 * 1000; // 8 minutos
  const INTERVAL  = 8000;           // 8 segundos entre intentos
  const start     = Date.now();
  let   attempt   = 0;

  while (Date.now() - start < MAX_WAIT) {
    attempt++;
    const elapsed = Math.floor((Date.now() - start) / 1000);
    setStatus(`⏳ Suno procesando... ${elapsed}s (intento ${attempt})`);

    await new Promise(r => setTimeout(r, INTERVAL));

    try {
      const feedRes = await proxyFetch('udio', `/api/feed?workId=${workId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!feedRes.ok) { console.warn('[POLL] feed error', feedRes.status); continue; }

      const feedData = await feedRes.json();
      console.log(`[POLL] attempt ${attempt}:`, feedData);

      const url = extractAudioUrl(feedData);
      if (url) return url;

      // Verificar estado
      const status = feedData.status || feedData.data?.[0]?.status;
      if (status === 'failed' || status === 'error') throw new Error('Suno reportó error en la generación');

    } catch (pollErr) {
      if (pollErr.message.includes('error en la generación')) throw pollErr;
      console.warn('[POLL] error:', pollErr.message);
    }
  }

  throw new Error('Timeout: Suno tardó más de 8 minutos. Intenta de nuevo.');
}

// ── Cargar audio en el player de la app ─────────────────────
function loadAudioIntoPlayer(url) {
  console.log('[PLAYER] Loading:', url);

  // Buscar wavesurfer instance
  const ws = window.wavesurfer || window.mainWavesurfer || window.waveInstance;
  if (ws && typeof ws.load === 'function') {
    ws.load(url);
  }

  // Buscar <audio> element
  const audioEl = document.getElementById('mainAudio') || document.getElementById('previewAudio') || document.querySelector('audio');
  if (audioEl) {
    audioEl.src = url;
    audioEl.load();
  }

  // Guardar en librería
  const lib = JSON.parse(localStorage.getItem('pipoLibrary') || '[]');
  lib.unshift({ url, title: 'Nueva canción ' + new Date().toLocaleTimeString(), date: Date.now() });
  localStorage.setItem('pipoLibrary', JSON.stringify(lib.slice(0, 50)));

  // Evento custom para que la app lo capture
  window.dispatchEvent(new CustomEvent('songGenerated', { detail: { url } }));

  console.log('[PLAYER] Audio ready:', url);
}

// ── Síntesis local mejorada (fallback) ───────────────────────
async function generateLocal(prompt, setStatus) {
  setStatus('🎹 Generando con síntesis local...');
  const ctx = new AudioContext();
  const dur = 20; // segundos — corto para que no explote el browser
  const sr  = ctx.sampleRate;
  const buf = ctx.createBuffer(2, sr * dur, sr);

  // BPM desde prompt
  const bpmMatch = prompt.match(/(\d{2,3})\s*bpm/i);
  const bpm      = bpmMatch ? parseInt(bpmMatch[1]) : 90;
  const beat     = 60 / bpm;

  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      // Bajo simple
      const bass = Math.sin(2 * Math.PI * 60 * t) * 0.3 * Math.exp(-((t % beat) * 4));
      // Pad
      const pad  = (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 330 * t)) * 0.1;
      // Pulso
      const kick = (t % beat) < 0.05 ? Math.sin(2 * Math.PI * 80 * t) * 0.5 : 0;
      data[i] = (bass + pad + kick) * 0.5 + (Math.random() - 0.5) * 0.005;
    }
  }

  // Reproducir
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();

  // Exportar como WAV blob y cargarlo
  const offCtx  = new OfflineAudioContext(2, sr * dur, sr);
  const offSrc  = offCtx.createBufferSource();
  offSrc.buffer = buf;
  offSrc.connect(offCtx.destination);
  offSrc.start();
  const rendered = await offCtx.startRendering();

  const wavBlob = bufferToWavBlob(rendered);
  const url     = URL.createObjectURL(wavBlob);
  loadAudioIntoPlayer(url);
  setStatus('✅ Síntesis local completa (configura udioapi.pro para calidad profesional)');
}

// ── WAV encoder ──────────────────────────────────────────────
function bufferToWavBlob(buffer) {
  const numCh   = buffer.numberOfChannels;
  const length  = buffer.length * numCh * 2;
  const ab      = new ArrayBuffer(44 + length);
  const view    = new DataView(ab);
  const sr      = buffer.sampleRate;

  const writeStr = (o, s) => { for (let i=0; i<s.length; i++) view.setUint8(o+i, s.charCodeAt(i)); };
  writeStr(0,  'RIFF');
  view.setUint32(4,  36 + length, true);
  writeStr(8,  'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1,  true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * numCh * 2, true);
  view.setUint16(32, numCh * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, length, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}
