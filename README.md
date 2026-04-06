# 🎙️ PipoRadio — AI Music Studio Pro

Estación de trabajo musical con IA. Genera canciones con calidad de estudio, procesa tu voz, separa stems y mezcla todo en el navegador — sin instalaciones.

🌐 **Demo en vivo:** [https://TU-USUARIO.github.io/piporadio](https://TU-USUARIO.github.io/piporadio)

---

## ✨ Características

- 🎸 **Síntesis instrumental** — additive synthesis con perfiles harmónicos por instrumento (acordeón, tololoche, trompeta, piano, violines, bajo 808, etc.)
- 🥁 **Batería con physical modeling** — kick con pitch-drop físico, snare con noise burst, hi-hats, congas, clave
- 🎤 **Vocal Chain profesional** — 12 etapas: HPF → De-esser × 2 → Compresor dual → EQ 4 bandas → Harmonic Exciter → Plate Reverb → Limiter
- 🧬 **DNA de estilo** — sube una canción de referencia y el sistema detecta BPM, tonalidad, género y produce un prompt preciso
- 🎚️ **Mixer Pro multitrack** — faders, mute/solo, VU meters, panorámica, cadena master
- 🎛️ **Auto-Mix** — optimización automática de mezcla por género
- 📦 **Export WAV/ZIP** — stems individuales o mezcla final lossless
- 🔌 **Backend-ready** — hooks para FastAPI + librosa + Demucs + Dolby.io

### 🎵 Plantillas de artista incluidas
Los Acosta · Los Temerarios · Liberación · Samuray · Tropicalisimo Apache · Los Chucos de Aguascalientes · Alejandro Fernández · Luis Miguel · Bachata · Cumbia · Ranchera · Pop · Lo-Fi

---

## 🚀 Deploy en GitHub Pages (gratis, en 5 minutos)

### Paso 1 — Crear el repositorio

1. Ve a [github.com/new](https://github.com/new)
2. Nombre: `piporadio`
3. Marca **"Public"**
4. **NO** inicialices con README (ya tienes uno)
5. Clic en **"Create repository"**

### Paso 2 — Subir los archivos

**Opción A — Desde GitHub.com (sin instalar nada):**
1. En tu repositorio vacío, haz clic en **"uploading an existing file"**
2. Arrastra toda la carpeta `docs/` (o sube `index.html` directamente)
3. También sube `README.md`, `_config.yml` y `backend/`
4. Commit: `"Initial commit — PipoRadio v3"`

**Opción B — Con Git en terminal:**
```bash
cd piporadio-repo
git init
git add .
git commit -m "Initial commit — PipoRadio v3"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/piporadio.git
git push -u origin main
```

### Paso 3 — Activar GitHub Pages

1. En tu repo → **Settings** → **Pages** (menú izquierdo)
2. Source: **"Deploy from a branch"**
3. Branch: `main` / Folder: `/docs`
4. Clic en **Save**
5. En ~2 minutos tu app estará en: `https://TU-USUARIO.github.io/piporadio`

---

## 🔑 APIs de terceros (opcionales pero recomendadas)

Configúralas en **Ajustes & API** dentro de la app:

### 1. Anthropic Claude — Generación de letras con IA
- Registro: [console.anthropic.com](https://console.anthropic.com)
- Plan: Free tier ($5 de crédito gratuito al registrarse)
- Uso: Generación de letras contextualizadas al género y mood
- Pega tu `sk-ant-...` key en Ajustes → Anthropic API Key

### 2. Suno AI — Generación de música real (el siguiente nivel)
- Registro: [suno.com](https://suno.com)
- API: [suno.com/api](https://suno.com/api) (lista de espera / Pro plan)
- Uso: En lugar de síntesis local, envía el prompt generado a Suno y recibe audio de calidad profesional real
- Cuando tengas acceso, pega tu key en Ajustes → Suno API Key

### 3. ElevenLabs — Clonación de voz real
- Registro: [elevenlabs.io](https://elevenlabs.io)
- Plan: Free tier (10,000 caracteres/mes)
- Uso: Sube tu muestra de voz y clona tu timbre real para cantarla sobre la canción generada
- Pega tu key en Ajustes → ElevenLabs API Key

### 4. Moises.ai — Separación de stems real (Demucs en la nube)
- Registro: [moises.ai/api](https://moises.ai/es/api/)
- Uso: Separa vocals, drums, bass, other de cualquier canción con IA
- Pega tu key en Ajustes → Moises.ai API Key

---

## 🖥️ Backend FastAPI (para análisis musical real)

Si quieres análisis real con `librosa` en vez de la estimación del navegador:

### Instalación rápida

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### En la app
Ajustes → Arquitectura Backend → URL: `http://localhost:8000` → Probar conexión

### Deploy gratuito del backend
- **Railway.app** — [railway.app](https://railway.app) — gratis hasta 500h/mes
- **Render.com** — [render.com](https://render.com) — gratis con sleep
- **Fly.io** — [fly.io](https://fly.io) — gratis tier disponible

---

## 📁 Estructura del repositorio

```
piporadio/
├── docs/
│   └── index.html          ← La app completa (single-file)
├── backend/
│   ├── main.py             ← FastAPI server
│   ├── requirements.txt    ← Dependencias Python
│   └── README.md           ← Instrucciones del backend
├── _config.yml             ← Config de GitHub Pages
└── README.md               ← Este archivo
```

---

## 🛠️ Desarrollo local

No necesitas servidor — abre `docs/index.html` directamente en Chrome/Edge.

> ⚠️ **Importante:** Algunas APIs (ElevenLabs, Suno) requieren HTTPS. Para desarrollo local con HTTPS usa:
> ```bash
> npx serve docs --ssl-cert cert.pem --ssl-key key.pem
> ```
> O simplemente despliega en GitHub Pages donde ya tienes HTTPS.

---

## 📜 Licencia

MIT — úsalo, modifícalo y distribúyelo libremente.

---

*Hecho con ❤️ en Aguascalientes, México 🇲🇽*
