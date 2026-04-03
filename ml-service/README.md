# KneeVision ML Service

This service hosts the trained AI model used by KneeVision for knee X-ray severity prediction.

It is responsible for:
- loading the trained `model.hdf5`
- receiving an uploaded X-ray image
- generating the predicted KL grade
- returning confidence, class probabilities, and Grad-CAM explanation output

## Prerequisite
Download model from (https://drive.google.com/file/d/1HKJuqN7yRDayQL-RXbdH0FssprPspFZl/view?usp=share_link)

Before running the ML service, make sure the model file is available locally:

```text
STARLABS/ml-service/model.hdf5
```

The application inside the Docker container looks for the model at:

```text
/app/model.hdf5
```

Note:
- `/app` is the working directory inside the container, not a folder on your local machine.
- The recommended local location is `ml-service/model.hdf5`.

## Run ML Service Only with Docker

From the project root:

```bash
docker build -t kneevision-ml ./ml-service
docker run --name kneevision-ml-container -p 8000:8000 \
  -v $(pwd)/ml-service/model.hdf5:/app/model.hdf5:ro \
  kneevision-ml
```

Or from the `ml-service` folder:

```bash
cd ml-service
docker build -t kneevision-ml .
docker run --name kneevision-ml-container -p 8000:8000 \
  -v $(pwd)/model.hdf5:/app/model.hdf5:ro \
  kneevision-ml
```

Once the container starts successfully, the service will be available at:

`http://localhost:8000`

## Run Full Project with Docker Compose

From the project root:

```bash
cd infra
docker compose up --build
```

This starts:
- MongoDB
- Backend
- Frontend
- ML service

Default local URLs:
- Frontend: `http://localhost`
- Backend: `http://localhost:4000`
- ML service: `http://localhost:8000`

### Important Compose Note

For Docker Compose to work correctly, make sure the `ml-service` section in `infra/docker-compose.yml` includes a model volume mount like this:

```yaml
volumes:
  - ../ml-service/model.hdf5:/app/model.hdf5:ro
```

Without this mount, the container may not be able to find the model file.

In Docker Compose mode, the backend connects to the ML service through:

```env
ML_SERVICE_URL=http://ml-service:8000
```

## Development Mode with Docker Compose

```bash
cd infra
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

This enables:
- frontend hot reload
- backend watch mode
- ml-service reload mode

## Available Endpoints

### Health Check

```http
GET /health
```

Example:
`http://localhost:8000/health`

Expected response:

```json
{ "status": "ok" }
```

### Prediction

```http
POST /predict
```

This endpoint accepts an image file upload (`png`, `jpg`, `jpeg`) and returns:
- predicted grade
- confidence
- severity label
- class probabilities
- summary
- Grad-CAM heatmap image as base64

## Integration with Backend

The main backend connects to this service through:

```env
ML_SERVICE_URL=http://localhost:8000
```

When running with Docker Compose, the backend uses:

```env
ML_SERVICE_URL=http://ml-service:8000
```

The backend endpoint:

```http
POST /api/v1/predict
```

will forward the saved uploaded image to this ML service and return the prediction result to the frontend.

## Notes

```bash
docker run --name kneevision-ml-container ...
```

creates a new container from the `kneevision-ml` image and gives it the custom name `kneevision-ml-container`, which makes it easier to identify and manage later in Docker Desktop.

- If you run `docker run` multiple times without reusing the same container, Docker will create multiple stopped containers.
- If a container named `kneevision-ml-container` already exists, start it instead of creating a new one:

```bash
docker start kneevision-ml-container
```

- To stop the container:

```bash
docker stop kneevision-ml-container
```

- The ML service currently runs on CPU in local development.
- If the model file changes, rebuild the image or restart the container as needed.
- If port `8000` is already in use, update the port mapping and related backend configuration.
