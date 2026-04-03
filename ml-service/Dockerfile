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

# Copy the model file — must exist at ml-service/model.hdf5 on the host
COPY model.hdf5 .

ENV MODEL_PATH=/app/model.hdf5
ENV LAST_CONV_LAYER_NAME=global_average_pooling2d

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]