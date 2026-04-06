# PipoRadio Backend

FastAPI server para análisis musical real con librosa y separación de stems con Demucs.

## Instalación rápida

```bash
# Requisitos: Python 3.10+ y ffmpeg
pip install -r requirements.txt

# Iniciar servidor
uvicorn main:app --reload --port 8000
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servidor y módulos |
| POST | `/analyze` | Análisis de audio: BPM, key, género, instrumentos |
| POST | `/upload-voice` | Subir muestra de voz + análisis de pitch |
| POST | `/separate-stems` | Separar en vocals/drums/bass/other con Demucs |
| POST | `/master` | Masterización básica: normalización + compresión |
| GET | `/stems/{nombre}` | Descargar stem individual |

## Deploy gratuito en Railway

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Selecciona tu repo → carpeta `backend/`
3. Agrega variable de entorno: `PORT=8000`
4. Copia la URL pública a PipoRadio → Ajustes → URL del Backend

## Integración con Dolby.io (masterización profesional)

```python
import httpx

async def master_with_dolby(file_url: str, api_key: str):
    async with httpx.AsyncClient() as client:
        # 1. Upload
        upload = await client.post(
            "https://api.dolby.com/media/input",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"url": file_url}
        )
        # 2. Enhance
        job = await client.post(
            "https://api.dolby.com/media/enhance",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"input": upload.json()["url"], "output": "dlb://out/mastered.wav"}
        )
        return job.json()
```
