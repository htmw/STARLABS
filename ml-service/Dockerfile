FROM python:3.11-slim

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
COPY kneevision_final.db .
COPY reference_cases/ ./reference_cases/

# Copy the model file — must exist at ml-service/best_model_b4.pt on the host
ENV MODEL_PATH=/app/best_model_b4.pt

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]