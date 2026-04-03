# ── ML Service Dockerfile ──────────────────────────────────────────────────
# The model file (model.hdf5) is NOT baked into this image because it is
# large and tracked in .gitignore.
#
# Instead, mount it at runtime via a Docker volume or bind-mount:
#   -v /path/to/model.hdf5:/app/model.hdf5:ro
#
# Or set MODEL_PATH to an external location (e.g. mounted GCS / S3 fuse).
# ───────────────────────────────────────────────────────────────────────────

FROM python:3.10-slim

WORKDIR /app

# System libraries required by opencv-headless and TensorFlow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer-cached unless requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .

# Model path — override with -e MODEL_PATH=/wherever/model.hdf5
ENV MODEL_PATH=/app/model.hdf5
ENV LAST_CONV_LAYER_NAME=global_average_pooling2d

# The container will fail fast at startup if MODEL_PATH doesn't exist,
# which is intentional — don't serve traffic without a model.
EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
