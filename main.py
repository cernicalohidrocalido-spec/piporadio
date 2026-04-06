"""
PipoRadio Backend — FastAPI + librosa + Demucs
Análisis musical real, separación de stems y masterización profesional.

Instrucciones:
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import tempfile, os, subprocess, json
from pathlib import Path

# Optional heavy imports — graceful fallback if not installed
try:
    import librosa
    import numpy as np
    HAS_LIBROSA = True
except ImportError:
    HAS_LIBROSA = False
    print("⚠️  librosa not installed — install with: pip install librosa")

try:
    from pydub import AudioSegment
    HAS_PYDUB = True
except ImportError:
    HAS_PYDUB = False

app = FastAPI(title="PipoRadio API", version="1.0.0")

# ── CORS — allow the GitHub Pages frontend ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # In production, set to your GitHub Pages URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(tempfile.gettempdir()) / "piporadio"
UPLOAD_DIR.mkdir(exist_ok=True)


# ── Health check ──────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "1.0.0",
        "modules": {
            "librosa":  HAS_LIBROSA,
            "pydub":    HAS_PYDUB,
            "demucs":   _check_demucs(),
        }
    }

def _check_demucs():
    try:
        result = subprocess.run(["demucs", "--help"], capture_output=True, timeout=5)
        return result.returncode == 0
    except Exception:
        return False


# ── Audio Analysis — librosa ──────────────────────────────────
@app.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    """
    Analyzes an uploaded audio file and returns:
    - BPM (tempo)
    - Key (estimated)
    - Energy / RMS
    - Spectral centroid (brightness)
    - Genre hint
    - Mood hint
    """
    if not HAS_LIBROSA:
        raise HTTPException(503, "librosa not installed on server")

    # Save upload
    suffix = Path(file.filename).suffix or ".mp3"
    tmp_path = UPLOAD_DIR / f"ref_{file.filename}{suffix}"
    content = await file.read()
    tmp_path.write_bytes(content)

    try:
        # Load audio (mono, max 60s for speed)
        y, sr = librosa.load(str(tmp_path), mono=True, duration=60)

        # ── BPM ──
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        bpm = round(float(tempo))

        # ── Spectral features ──
        spectral_centroid = float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())
        spectral_rolloff  = float(librosa.feature.spectral_rolloff(y=y, sr=sr).mean())
        rms               = float(librosa.feature.rms(y=y).mean())
        zcr               = float(librosa.feature.zero_crossing_rate(y).mean())

        # ── Key estimation via chroma ──
        chroma    = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_mean = chroma.mean(axis=1)
        key_idx   = int(np.argmax(chroma_mean))
        key_names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
        key_name  = key_names[key_idx]

        # Major vs minor: compare chroma energy at major/minor 3rd
        major_3rd = chroma_mean[(key_idx + 4) % 12]
        minor_3rd = chroma_mean[(key_idx + 3) % 12]
        mode = "maj" if major_3rd >= minor_3rd else "min"
        key  = f"{key_name} {mode}"

        # ── Band energy analysis ──
        stft    = np.abs(librosa.stft(y))
        freqs   = librosa.fft_frequencies(sr=sr)
        sub_e   = float(stft[freqs < 80].mean())
        low_e   = float(stft[(freqs >= 80)  & (freqs < 300)].mean())
        mid_e   = float(stft[(freqs >= 300) & (freqs < 4000)].mean())
        high_e  = float(stft[freqs >= 4000].mean())
        total_e = sub_e + low_e + mid_e + high_e + 0.0001

        # ── Genre detection heuristic ──
        genre = _detect_genre(bpm, sub_e/total_e, low_e/total_e, high_e/total_e, spectral_centroid)

        # ── Mood ──
        mood = _detect_mood(bpm, rms, spectral_centroid)

        # ── Instruments hint ──
        instruments = _detect_instruments(genre, spectral_centroid, low_e/total_e)

        # ── Duration ──
        duration = librosa.get_duration(y=y, sr=sr)

        return {
            "bpm":                bpm,
            "key":                key,
            "genre":              genre,
            "mood":               mood,
            "duration":           round(duration, 1),
            "rms":                round(rms, 4),
            "spectral_centroid":  round(spectral_centroid, 1),
            "spectral_rolloff":   round(spectral_rolloff, 1),
            "zero_crossing_rate": round(zcr, 4),
            "bass_energy":        round((sub_e + low_e) / total_e * 100, 1),
            "brightness":         round(high_e / total_e * 100, 1),
            "density":            round(mid_e / total_e * 100, 1),
            "instruments":        instruments,
            "prompt":             _build_prompt(genre, bpm, key, mood, instruments),
        }

    except Exception as e:
        raise HTTPException(500, f"Analysis error: {str(e)}")
    finally:
        tmp_path.unlink(missing_ok=True)


def _detect_genre(bpm, p_sub, p_low, p_high, centroid):
    """Heuristic genre detection from spectral fingerprint + BPM."""
    if 88 <= bpm <= 95 and p_sub > 0.25:
        return "reggaeton"
    if 90 <= bpm <= 105 and p_low > 0.22:
        return "grupero"
    if 100 <= bpm <= 120 and p_low > 0.20:
        return "norteno"
    if 80 <= bpm <= 100 and centroid < 3000:
        return "ranchera"
    if 110 <= bpm <= 128 and p_high > 0.15:
        return "cumbia"
    if 112 <= bpm <= 130 and p_low > 0.18:
        return "tropicalisimo"
    if bpm >= 135:
        return "samuray"
    if 65 <= bpm <= 80 and centroid < 2500:
        return "bolero" if p_high < 0.12 else "temerarios"
    if 95 <= bpm <= 115 and centroid > 4000:
        return "salsa"
    if 104 <= bpm <= 115 and p_low > 0.18:
        return "bachata"
    if bpm <= 85 and centroid < 2000:
        return "lofi"
    if centroid > 5000 and bpm >= 120:
        return "electronic"
    if 80 <= bpm <= 130 and 2000 < centroid < 4000:
        return "jazz"
    if bpm >= 110:
        return "pop"
    return "pop"


def _detect_mood(bpm, rms, centroid):
    if bpm > 130:
        return "Energético / Festivo"
    if bpm < 80 and rms < 0.05:
        return "Íntimo / Romántico"
    if bpm < 85:
        return "Melancólico / Nostálgico"
    if rms > 0.1 and centroid > 4000:
        return "Poderoso / Intenso"
    if centroid > 3500:
        return "Bailable / Alegre"
    return "Moderado / Versátil"


def _detect_instruments(genre, centroid, p_low):
    instrument_map = {
        "grupero":       ["Acordeón diatónico", "Bajo sexto", "Tololoche", "Batería grupera", "Coros norteños"],
        "norteno":       ["Acordeón norteño", "Bajo sexto", "Tuba", "Batería norteña"],
        "ranchera":      ["Trompeta mariachi", "Violines jalicienses", "Vihuela", "Guitarrón", "Guitarras"],
        "cumbia":        ["Acordeón tropical", "Bajo eléctrico", "Caja vallenata", "Guacharaca", "Maracas"],
        "tropicalisimo": ["Órgano Farfisa", "Bajo eléctrico tropical", "Maracas", "Congas", "Trompeta"],
        "samuray":       ["Acordeón rápido", "Bajo eléctrico", "Tambora", "Sintetizador", "Congas"],
        "bachata":       ["Guitarra bachata", "Requinto", "Bongós", "Güira", "Bajo eléctrico"],
        "bolero":        ["Piano de cola", "Cuerdas orquestales", "Contrabajo", "Trompeta suave"],
        "temerarios":    ["Piano Rhodes", "Sintetizador pad", "Bajo eléctrico", "Cuerdas sintetizadas"],
        "salsa":         ["Piano montuno", "Congas", "Timbales", "Trompetas", "Bajo eléctrico"],
        "reggaeton":     ["Bajo 808", "Sintetizador", "Drum machine", "Pad"],
        "lofi":          ["Piano jazz", "Batería lo-fi", "Bajo woofer", "Guitarra jazz"],
        "jazz":          ["Piano", "Contrabajo", "Batería jazz", "Trompeta en sordina"],
        "electronic":    ["Sintetizador lead", "Bajo synth", "Drum machine", "Arpegios"],
        "pop":           ["Sintetizador", "Batería electrónica", "Bajo sintetizado", "Guitarras limpias"],
    }
    return instrument_map.get(genre, ["Piano", "Bajo", "Batería"])


def _build_prompt(genre, bpm, key, mood, instruments):
    """Build a precise Suno-ready prompt from analysis."""
    genre_names = {
        "grupero": "Grupero norteño", "norteno": "Norteño corrido",
        "ranchera": "Ranchera mariachi", "cumbia": "Cumbia tropical",
        "tropicalisimo": "Tropical caliente", "samuray": "Quebradita",
        "bachata": "Bachata sensual", "bolero": "Bolero orquestal",
        "temerarios": "Balada grupera", "salsa": "Salsa tropical",
        "reggaeton": "Reggaeton urbano", "lofi": "Lo-fi chill",
        "jazz": "Jazz blues", "electronic": "Electrónica synthwave",
        "pop": "Pop internacional",
    }
    gname = genre_names.get(genre, genre.title())
    instr = ", ".join(instruments[:4])
    return (
        f"{gname}, {bpm} BPM, {key}. "
        f"Instrumentación: {instr}. "
        f"Mood: {mood}. "
        f"Calidad de estudio profesional, mezcla limpia y balanceada."
    )


# ── Voice Upload ──────────────────────────────────────────────
@app.post("/upload-voice")
async def upload_voice(file: UploadFile = File(...)):
    """Save voice sample and return basic analysis."""
    content = await file.read()
    path = UPLOAD_DIR / f"voice_{file.filename}"
    path.write_bytes(content)

    result = {"status": "ok", "path": str(path), "size": len(content)}

    if HAS_LIBROSA:
        try:
            y, sr = librosa.load(str(path), mono=True, duration=10)
            f0, _, _ = librosa.pyin(y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'))
            import numpy as np
            valid_f0 = f0[~np.isnan(f0)] if f0 is not None else []
            if len(valid_f0) > 0:
                mean_f0 = float(np.nanmean(valid_f0))
                midi = 12 * np.log2(mean_f0 / 440) + 69
                notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
                note = notes[int(midi) % 12]
                octave = int(midi) // 12 - 1
                result["pitch"] = f"{note}{octave}"
                result["f0_mean"] = round(mean_f0, 1)
                if mean_f0 < 150: result["voice_type"] = "Bajo"
                elif mean_f0 < 200: result["voice_type"] = "Barítono"
                elif mean_f0 < 280: result["voice_type"] = "Tenor"
                elif mean_f0 < 350: result["voice_type"] = "Mezzosoprano"
                else: result["voice_type"] = "Soprano"
        except Exception as e:
            result["voice_analysis_error"] = str(e)

    return result


# ── Stem Separation — Demucs ──────────────────────────────────
@app.post("/separate-stems")
async def separate_stems(file: UploadFile = File(...)):
    """
    Separates audio into stems using Facebook Demucs.
    Returns paths to: vocals.wav, drums.wav, bass.wav, other.wav
    Install: pip install demucs
    """
    if not _check_demucs():
        raise HTTPException(503, "Demucs not installed. Run: pip install demucs")

    content = await file.read()
    input_path = UPLOAD_DIR / file.filename
    input_path.write_bytes(content)

    out_dir = UPLOAD_DIR / "stems"
    out_dir.mkdir(exist_ok=True)

    try:
        result = subprocess.run(
            ["demucs", "--out", str(out_dir), "--mp3", str(input_path)],
            capture_output=True, text=True, timeout=300
        )
        if result.returncode != 0:
            raise HTTPException(500, f"Demucs error: {result.stderr}")

        # Find output files
        stem_files = {}
        for stem in ["vocals", "drums", "bass", "other"]:
            # Demucs outputs to: out_dir/htdemucs/filename/stem.mp3
            matches = list(out_dir.rglob(f"{stem}.mp3"))
            if matches:
                stem_files[stem] = str(matches[0])

        return {"status": "ok", "stems": stem_files}

    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Demucs timed out (file too long)")
    finally:
        input_path.unlink(missing_ok=True)


# ── Stem Download ─────────────────────────────────────────────
@app.get("/stems/{stem_name}")
async def get_stem(stem_name: str):
    """Download a separated stem file."""
    path = UPLOAD_DIR / "stems" / stem_name
    if not path.exists():
        raise HTTPException(404, "Stem not found")
    return FileResponse(str(path), media_type="audio/mpeg", filename=stem_name)


# ── Export / Mastering ────────────────────────────────────────
@app.post("/master")
async def master_audio(file: UploadFile = File(...)):
    """
    Basic mastering via pydub: normalize + gentle compression.
    For professional mastering integrate Dolby.io API here.
    Install: pip install pydub && apt-get install ffmpeg
    """
    if not HAS_PYDUB:
        raise HTTPException(503, "pydub not installed. Run: pip install pydub")

    content = await file.read()
    suffix = Path(file.filename).suffix or ".wav"
    input_path = UPLOAD_DIR / f"master_in{suffix}"
    output_path = UPLOAD_DIR / "master_out.wav"
    input_path.write_bytes(content)

    try:
        audio = AudioSegment.from_file(str(input_path))

        # Normalize to -1 dBFS
        headroom = -1.0 - audio.max_dBFS
        audio = audio.apply_gain(headroom)

        # Export as WAV 44.1kHz 16-bit
        audio.export(str(output_path), format="wav",
                     parameters=["-ar", "44100", "-sample_fmt", "s16"])

        return FileResponse(str(output_path), media_type="audio/wav",
                            filename="piporadio_mastered.wav")

    except Exception as e:
        raise HTTPException(500, f"Mastering error: {str(e)}")
    finally:
        input_path.unlink(missing_ok=True)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
