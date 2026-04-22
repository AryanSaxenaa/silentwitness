FROM python:3.11-slim

WORKDIR /app

# ---- Build-time toggles ----
# PRELOAD_MODELS=1 (default): download CLIP + Whisper at build time (faster first request, slower build)
# PRELOAD_MODELS=0: skip model preloading (faster build, models download on first use)
ARG PRELOAD_MODELS=1

# ---- Base system deps (OpenCV + ffmpeg runtime) ----
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    ffmpeg \
    libavcodec-dev \
    libavformat-dev \
    libavdevice-dev \
    && rm -rf /var/lib/apt/lists/*

# ---- Python tooling ----
# Keep setuptools pinned for whisper/pkg_resources compatibility.
RUN pip install --no-cache-dir --upgrade pip wheel \
    && pip install --no-cache-dir setuptools==65.7.0

# ---- Dependency layering for cache reuse ----
# Install Python deps before app code so code changes don't invalidate heavy ML layers.
# Force CPU-only torch wheel resolution to avoid large CUDA downloads.
ENV PIP_EXTRA_INDEX_URL=https://download.pytorch.org/whl/cpu
ENV PIP_PREFER_BINARY=1
COPY requirements.txt /app/requirements.txt
COPY actian_vectorai-0.1.0b2-py3-none-any.whl /app/actian_vectorai-0.1.0b2-py3-none-any.whl
RUN pip install --no-cache-dir --no-build-isolation -r /app/requirements.txt

# ---- Optional model preload layer ----
# This stays cacheable across code changes.
RUN if [ "$PRELOAD_MODELS" = "1" ]; then \
      python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('clip-ViT-B-32')" && \
      python -c "import whisper; whisper.load_model('tiny')"; \
    else \
      echo "Skipping model preload (PRELOAD_MODELS=$PRELOAD_MODELS)"; \
    fi

# ---- App code (changes frequently; keep near end) ----
COPY . /app

RUN mkdir -p /app/footage /app/data/thumbnails

# Use --workers 1 so model singletons are shared in-process.
# Force the standard asyncio loop; grpc+uvloop emitted noisy completion-queue
# errors during live testing even though requests succeeded.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--loop", "asyncio"]
